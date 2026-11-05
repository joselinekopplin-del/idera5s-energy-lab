import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCENARIOS = [
  ['urban', '城市通勤'], ['express', '城市快速路'], ['highway80', '高速 80 km/h'],
  ['highway100', '高速 100 km/h'], ['highway110', '高速 110 km/h'], ['highway120', '高速 120 km/h'],
  ['acceleration', '急加速'], ['braking', '减速制动'], ['mountain', '山区道路'],
  ['winterMinus10', '冬季 −10°C'], ['winter0', '冬季 0°C'], ['summer30', '夏季 30°C'],
  ['summer35', '夏季 35°C'], ['fullLoad', '满载行驶'], ['longTrip', '长途混动'], ['socHold', '电量保持'],
].map(([id, label]) => ({ id, label }));
export const STRATEGIES = [
  ['EVPriority', '纯电优先', 'EV Priority'], ['Rule_Based', '规则控制', 'Rule-Based'],
  ['SOCHold', '电量保持', 'SOC Hold'], ['ECMS', '等效燃油最小化', 'ECMS'],
].map(([id, label, sourceName]) => ({ id, label, sourceName }));
export const SPEED_SEMANTICS = 'prescribed_reference_not_measured';
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** RFC 4180-style CSV parser; never evaluate source content as code. */
export function parseCSV(text) {
  const records = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((value) => value !== '')) records.push(row);
      row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('Unterminated quoted CSV field');
  if (field !== '' || row.length) { row.push(field); records.push(row); }
  if (records.length < 2) throw new Error('CSV requires a header and data');
  const [fields, ...rows] = records;
  if (new Set(fields).size !== fields.length || fields.some((field) => !field)) throw new Error('Duplicate or empty CSV header');
  for (const [i, values] of rows.entries()) {
    if (values.length !== fields.length) throw new Error(`CSV row ${i + 2}: expected ${fields.length} cells, got ${values.length}`);
  }
  return { fields, rows };
}

export function numericCell(value, location) {
  if (/^[+-]?(?:NaN|Inf(?:inity)?)$/i.test(value.trim())) return null;
  if (value.trim() === '') throw new Error(`Empty numeric value: ${location}`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid numeric value: ${location}`);
  return number;
}

const FIELD_INFO = {
  Time_s: ['时间', 's'], Speed_mps: ['参考速度', 'm/s', SPEED_SEMANTICS],
  SOC: ['电池 SOC', 'fraction'], Engine_W: ['发动机机械功率', 'W'],
  Motor_W: ['电机机械功率', 'W', 'positive_drive_negative_generation'],
  Battery_W: ['电池端功率', 'W', 'positive_discharge_negative_charge'],
  Fuel_W: ['燃油化学功率', 'W'], Chemical_W: ['电池化学功率', 'W'],
  Regen_W: ['制动回收直流功率', 'W', 'positive_generated_DC_before_auxiliaries'],
  Friction_W: ['摩擦制动功率', 'W'], Aux_W: ['已满足辅助负载', 'W'],
  Loss_W: ['总损耗', 'W'], Unmet_W: ['未满足驱动功率', 'W'], Balance_W: ['能量守恒残差', 'W'],
  Battery_C: ['电池温度（模型计算）', '°C'], Motor_C: ['电机温度（模型计算）', '°C'],
  FuelRemaining_L: ['剩余燃油', 'L'], EngineStarts: ['该采样步发动机启动事件', '0_or_1'],
  ModeCode: ['运行模式编码', 'code'], Demand_W: ['参考轮端需求功率', 'W'], Wheel_W: ['模型轮端供给功率', 'W'],
  Current_A: ['电池电流', 'A'], Voltage_V: ['电池端电压', 'V'], EngineRPM: ['发动机转速', 'rpm'],
  EngineEta: ['发动机效率（通用近似模型）', 'fraction'], MotorEta: ['电机效率（通用近似模型）', 'fraction'],
  BatteryLoss_W: ['电池损耗', 'W'], MotorLoss_W: ['电机损耗', 'W'], EngineLoss_W: ['发动机损耗', 'W'],
  GearLoss_W: ['传动损耗', 'W'], AuxUnmet_W: ['未满足辅助负载', 'W'], Kinetic_W: ['惯性需求', 'W'],
  Rolling_W: ['滚阻需求', 'W'], Aero_W: ['空气阻力需求', 'W'], Grade_W: ['坡度需求', 'W'],
  Distance_km: ['参考累计里程', 'km', SPEED_SEMANTICS], FuelUsed_L: ['累计燃油消耗', 'L'],
  BatteryNet_kWh: ['电池累计净耗电（化学能）', 'kWh'], Regen_kWh: ['累计回收直流电量', 'kWh'],
  AvailableBattery_kWh: ['SOC 窗口内剩余电量估算', 'kWh'],
  EstimatedEVRange_km: ['当前纯电工况续航外推（非认证）', 'km', 'null_when_estimation_conditions_not_met'],
};

export async function exportDataset(projectRoot = path.resolve(webRoot, '..'), outputRoot = path.join(webRoot, 'public', 'data')) {
  const inputRoot = path.join(projectRoot, 'results');
  const summaryBytes = await readFile(path.join(inputRoot, 'scenario_summary.csv'));
  const rawSummary = parseCSV(summaryBytes.toString('utf8'));
  const summaryRows = rawSummary.rows.map((row) => Object.fromEntries(rawSummary.fields.map((field, i) => [field, row[i]])));
  if (summaryRows.length !== 64) throw new Error(`Expected 64 official runs, got ${summaryRows.length}`);

  const scientificFiles = ['+ems/simulate.m', '+ems/summarize.m', '+ems/actuate.m', '+ems/step.m',
    '+ems/demand.m', '+ems/engine.m', '+ems/motor.m', '+ems/limits.m', '+ems/auxiliary.m', '+ems/initial.m',
    'parameters/vehicle_parameters.m', 'controllers/select_engine_power.m', 'scenarios/make_scenario.m', 'scenarios/scenario_catalog.m'];
  const scientificSources = [];
  for (const file of scientificFiles) scientificSources.push({ file, sha256: sha256(await readFile(path.join(projectRoot, file))) });
  const sourceRecords = [];
  for (const scenario of SCENARIOS) {
    for (const strategy of STRATEGIES) {
      const id = `${scenario.id}_${strategy.id}`;
      const matches = summaryRows.filter((row) => row.Scenario === scenario.id && row.Strategy === strategy.sourceName);
      if (matches.length !== 1) throw new Error(`Expected one summary row for ${id}`);
      const source = {
        csv: `results/${id}.csv`, sha256: sha256(await readFile(path.join(inputRoot, `${id}.csv`))),
        mat: `results/${id}.mat`, matSha256: sha256(await readFile(path.join(inputRoot, `${id}.mat`))),
      };
      sourceRecords.push({ id, scenario, strategy, source, summaryRow: matches[0] });
    }
  }
  const summarySource = { file: 'results/scenario_summary.csv', sha256: sha256(summaryBytes) };
  const datasetHash = sha256(JSON.stringify({ summarySource, scientificSources, sources: sourceRecords.map((run) => run.source) }));
  const version = `matlab-csv-${datasetHash.slice(0, 16)}`;
  await mkdir(outputRoot, { recursive: true });
  const runs = [];
  let fieldMetadata;
  for (const record of sourceRecords) {
    const { id, scenario, strategy, source, summaryRow } = record;
    const csv = await readFile(path.join(inputRoot, `${id}.csv`));
    if (sha256(csv) !== source.sha256) throw new Error(`Source changed during export: ${id}`);
    const { fields, rows: csvRows } = parseCSV(csv.toString('utf8'));
    if (fieldMetadata && JSON.stringify(fields) !== JSON.stringify(fieldMetadata.map((field) => field.name))) throw new Error(`Field order changed: ${id}`);
    fieldMetadata = fields.map((name) => {
      if (!FIELD_INFO[name]) throw new Error(`Undocumented field: ${name}`);
      const [label, unit, semantics] = FIELD_INFO[name];
      return { name, label, unit, ...(semantics ? { semantics } : {}) };
    });
    const nonFiniteByField = {};
    const rows = csvRows.map((row, rowIndex) => row.map((value, fieldIndex) => {
      const numeric = numericCell(value, `${id}:${rowIndex + 2}:${fields[fieldIndex]}`);
      if (numeric === null) nonFiniteByField[fields[fieldIndex]] = (nonFiniteByField[fields[fieldIndex]] ?? 0) + 1;
      return numeric;
    }));
    const t = fields.indexOf('Time_s');
    if (t < 0 || rows.length < 2 || rows.some((row, i) => row[t] === null || (i > 0 && row[t] <= rows[i - 1][t]))) throw new Error(`Invalid time axis: ${id}`);
    const sampleInterval_s = rows[1][t] - rows[0][t];
    if (rows.some((row, i) => i > 0 && Math.abs(row[t] - rows[i - 1][t] - sampleInterval_s) > 1e-9)) throw new Error(`Nonuniform time axis requires a new schema: ${id}`);
    const summary = Object.fromEntries(Object.entries(summaryRow).filter(([key]) => !['Scenario', 'Strategy'].includes(key)).map(([key, value]) => [key, numericCell(value, `${id}:summary:${key}`)]));
    if (![0, 1].includes(summary.Feasible)) throw new Error(`Missing feasibility: ${id}`);
    const feasible = summary.Feasible === 1;
    const shared = {
      id, scenario: scenario.id, scenarioLabel: scenario.label, strategy: strategy.id, strategyLabel: strategy.label,
      feasible, duration_s: rows.at(-1)[t] + sampleInterval_s - rows[0][t],
      startTime_s: rows[0][t], endTime_s: rows.at(-1)[t], sampleInterval_s,
      sampleCount: rows.length, summary, source,
    };
    const run = {
      schemaVersion: 1, version, ...shared, speedSemantics: SPEED_SEMANTICS,
      fields, rows, nonFiniteByField,
      engineRunningRule: 'EngineRPM > 0; derived from saved engine RPM, not ModeCode',
    };
    const json = JSON.stringify(run) + '\n';
    await writeFile(path.join(outputRoot, `${id}.json`), json, 'utf8');
    runs.push({ ...shared, file: `data/${id}.json`, bytes: Buffer.byteLength(json), sha256: sha256(json), nonFiniteByField });
  }
  if (sha256(await readFile(path.join(inputRoot, 'scenario_summary.csv'))) !== summarySource.sha256) throw new Error('Summary changed during export');
  const catalog = {
    schemaVersion: 1, version, datasetHash, sourceFormat: 'MATLAB saved CSV, with companion MAT digests',
    playbackOnly: true, scientificSolverInBrowser: false, speedSemantics: SPEED_SEMANTICS,
    provenance: {
      summary: summarySource, scientificSources,
      method: 'Prescribed-speed backward quasi-static engineering model; custom synthetic cycles; not certified CLTC/WLTC.',
      precision: 'Every numeric CSV cell is parsed as an IEEE-754 double without rounding or resampling; MATLAB CSV serialization precision is retained. NaN/Inf become JSON null, never zero.',
      matUsage: 'Companion MAT files are hashed for provenance only. Numeric JSON values come from the saved CSV exports; no MATLAB simulation is rerun.',
      caution: 'Reference speed and reference distance are not achieved vehicle motion. Feasible is copied from the official summary. Internal parts and efficiencies are educational approximations.',
      feasibilityRule: 'Saved MATLAB summary: Unmet_kWh < 1e-4 and AuxUnmet_kWh < 1e-4. No web-side reclassification.',
    },
    counts: { runs: runs.length, scenarios: SCENARIOS.length, strategies: STRATEGIES.length, infeasible: runs.filter((run) => !run.feasible).length },
    scenarios: SCENARIOS, strategies: STRATEGIES, fields: fieldMetadata,
    modes: ['停车 / 辅助负载', '纯电驱动', '混合驱动 / 发动机运行', '制动回收', '发动机驱动并充电'],
    runs,
  };
  if (catalog.counts.infeasible !== 3) throw new Error(`Expected 3 preserved infeasible results, got ${catalog.counts.infeasible}; review source changes explicitly`);
  await writeFile(path.join(outputRoot, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  return catalog;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--source')) throw new Error('Usage: node scripts/export-data.mjs [--source MATLAB-project-root]');
  const catalog = await exportDataset(args[1] ? path.resolve(args[1]) : undefined);
  console.log(JSON.stringify({ version: catalog.version, ...catalog.counts, bytes: catalog.runs.reduce((sum, run) => sum + run.bytes, 0) }, null, 2));
}
