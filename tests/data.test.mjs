import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCSV, numericCell, sha256, SCENARIOS, STRATEGIES, SPEED_SEMANTICS } from '../scripts/export-data.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(webRoot, 'public');
const projectRoot = path.resolve(webRoot, '..');
const catalog = JSON.parse(await readFile(path.join(publicRoot, 'data/catalog.json'), 'utf8'));
const readRun = async (descriptor) => {
  const bytes = await readFile(path.join(publicRoot, descriptor.file));
  return { bytes, run: JSON.parse(bytes.toString('utf8')) };
};
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), `${message}: ${actual} != ${expected}`);

test('catalog preserves the complete 16 × 4 matrix and exactly three saved infeasible runs', () => {
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.playbackOnly, true);
  assert.equal(catalog.scientificSolverInBrowser, false);
  assert.equal(catalog.speedSemantics, SPEED_SEMANTICS);
  assert.deepEqual(catalog.scenarios, SCENARIOS);
  assert.deepEqual(catalog.strategies, STRATEGIES);
  assert.deepEqual(catalog.counts, { runs: 64, scenarios: 16, strategies: 4, infeasible: 3 });
  assert.equal(new Set(catalog.runs.map((run) => run.id)).size, 64);
  for (const scenario of SCENARIOS) for (const strategy of STRATEGIES) {
    assert.equal(catalog.runs.filter((run) => run.scenario === scenario.id && run.strategy === strategy.id).length, 1);
  }
  assert.deepEqual(catalog.runs.filter((run) => !run.feasible).map((run) => run.id).sort(),
    ['winterMinus10_EVPriority', 'winterMinus10_Rule_Based', 'winterMinus10_SOCHold'].sort());
});

test('all 64 files pass SHA-256, schema, time axis, no-resampling and summary consistency checks', async () => {
  let totalRows = 0, nullValues = 0, negativeMotorSamples = 0, negativeBatterySamples = 0;
  for (const descriptor of catalog.runs) {
    const { bytes, run } = await readRun(descriptor);
    assert.equal(bytes.byteLength, descriptor.bytes);
    assert.equal(sha256(bytes), descriptor.sha256, `${descriptor.id} content digest`);
    assert.equal(run.version, catalog.version);
    assert.equal(run.id, descriptor.id);
    assert.equal(run.speedSemantics, SPEED_SEMANTICS);
    assert.equal(run.rows.length, descriptor.sampleCount);
    assert.deepEqual(run.source, descriptor.source);
    assert.deepEqual(run.summary, descriptor.summary);
    assert.deepEqual(run.fields, catalog.fields.map((field) => field.name));
    assert.equal(run.fields.length, 41);
    assert.ok(!run.fields.some((field) => /actual.*speed|achieved.*speed/i.test(field)));
    const column = (name) => run.fields.indexOf(name);
    const get = (row, name) => row[column(name)];
    const nonFiniteByField = {};
    let previousTime = -Infinity, starts = 0, regen = 0, chemical = 0;
    for (const row of run.rows) {
      assert.equal(row.length, run.fields.length);
      for (const [i, value] of row.entries()) {
        assert.ok(value === null || (typeof value === 'number' && Number.isFinite(value)), `${run.id}:${i} invalid value`);
        if (value === null) { nullValues++; nonFiniteByField[run.fields[i]] = (nonFiniteByField[run.fields[i]] ?? 0) + 1; }
      }
      const time = get(row, 'Time_s');
      assert.ok(time > previousTime);
      if (previousTime !== -Infinity) close(time - previousTime, descriptor.sampleInterval_s, `${run.id}: time step`);
      previousTime = time;
      starts += get(row, 'EngineStarts');
      regen += get(row, 'Regen_W') * descriptor.sampleInterval_s / 3.6e6;
      chemical += get(row, 'Chemical_W') * descriptor.sampleInterval_s / 3.6e6;
      if (get(row, 'Motor_W') < -1) negativeMotorSamples++;
      if (get(row, 'Battery_W') < -1) negativeBatterySamples++;
    }
    assert.deepEqual(nonFiniteByField, run.nonFiniteByField);
    close(get(run.rows[0], 'Time_s'), descriptor.startTime_s, `${run.id}: first time`);
    close(get(run.rows.at(-1), 'Time_s'), descriptor.endTime_s, `${run.id}: last time`);
    close(descriptor.duration_s, descriptor.sampleCount * descriptor.sampleInterval_s, `${run.id}: duration`);
    const final = run.rows.at(-1);
    for (const [field, summaryField] of [['SOC', 'SOC_end'], ['FuelUsed_L', 'Fuel_L'], ['Distance_km', 'Distance_km'], ['BatteryNet_kWh', 'BatteryNet_kWh'], ['Regen_kWh', 'Regen_kWh']]) {
      close(get(final, field), descriptor.summary[summaryField], `${run.id}:${field}`);
    }
    close(starts, descriptor.summary.EngineStarts, `${run.id}: starts are events, not accumulated values`);
    close(regen, descriptor.summary.Regen_kWh, `${run.id}: DC recovery integral`);
    close(chemical, descriptor.summary.BatteryNet_kWh, `${run.id}: battery chemical energy integral`);
    assert.equal(descriptor.feasible, descriptor.summary.Feasible === 1);
    totalRows += run.rows.length;
  }
  assert.ok(totalRows > 100000, 'full-resolution samples were retained');
  assert.ok(nullValues > 0, 'invalid range estimates remain null');
  assert.ok(negativeMotorSamples > 0 && negativeBatterySamples > 0, 'signed regeneration data retained');
});

test('CSV parsing preserves quoted data and rejects malformed rows and numeric cells', () => {
  assert.deepEqual(parseCSV('\uFEFFA,B\r\n"x,y","a""b"\r\n'), { fields: ['A', 'B'], rows: [['x,y', 'a"b']] });
  assert.throws(() => parseCSV('A,B\n1\n'), /expected 2 cells/);
  assert.throws(() => parseCSV('A,A\n1,2'), /Duplicate/);
  assert.throws(() => parseCSV('A,B\n"1,2'), /Unterminated/);
  assert.equal(numericCell('NaN', 'fixture'), null);
  assert.equal(numericCell('-Inf', 'fixture'), null);
  assert.equal(numericCell('0.849994180169552', 'fixture'), 0.849994180169552);
  assert.throws(() => numericCell('', 'fixture'), /Empty/);
  assert.throws(() => numericCell('not-a-number', 'fixture'), /Invalid/);
});

test('public catalog contains only relative provenance paths and no runtime credentials', () => {
  const text = JSON.stringify(catalog);
  assert.ok(!/[A-Za-z]:[\\/]|\/Users\/|\/home\//.test(text));
  assert.ok(!/sk-proj-|gh[pousr]_[A-Za-z0-9]|github_pat_/i.test(text));
  for (const run of catalog.runs) {
    assert.match(run.file, /^data\/[A-Za-z0-9_]+\.json$/);
    assert.match(run.source.sha256, /^[a-f0-9]{64}$/);
    assert.match(run.source.matSha256, /^[a-f0-9]{64}$/);
    assert.ok(!run.file.includes('..'));
  }
});

test('local provenance: every public cell equals its saved CSV double and all source hashes are unchanged',
  { skip: !existsSync(path.join(projectRoot, 'results', 'scenario_summary.csv')) ? 'Standalone website checkout: MATLAB source files are intentionally not published' : false }, async () => {
    assert.equal(sha256(await readFile(path.join(projectRoot, catalog.provenance.summary.file))), catalog.provenance.summary.sha256);
    for (const source of catalog.provenance.scientificSources) {
      assert.equal(sha256(await readFile(path.join(projectRoot, source.file))), source.sha256, source.file);
    }
    for (const descriptor of catalog.runs) {
      const { run } = await readRun(descriptor);
      const csvBytes = await readFile(path.join(projectRoot, descriptor.source.csv));
      assert.equal(sha256(csvBytes), descriptor.source.sha256, descriptor.source.csv);
      assert.equal(sha256(await readFile(path.join(projectRoot, descriptor.source.mat))), descriptor.source.matSha256, descriptor.source.mat);
      const csv = parseCSV(csvBytes.toString('utf8'));
      assert.deepEqual(csv.fields, run.fields);
      assert.equal(csv.rows.length, run.rows.length);
      for (let i = 0; i < csv.rows.length; i++) for (let j = 0; j < csv.fields.length; j++) {
        assert.equal(run.rows[i][j], numericCell(csv.rows[i][j], `${run.id}:${i}:${j}`));
      }
    }
  });
