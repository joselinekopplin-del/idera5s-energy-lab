export type NumericValue = number | null;
export type Summary = Record<string, NumericValue>;
export interface SourceRecord {
  csv: string;
  sha256: string;
  mat: string;
  matSha256: string;
}
export interface RunInfo {
  id: string;
  scenario: string;
  scenarioLabel: string;
  strategy: string;
  strategyLabel: string;
  feasible: boolean;
  duration_s: number;
  startTime_s: number;
  endTime_s: number;
  sampleInterval_s: number;
  sampleCount: number;
  summary: Summary;
  source: SourceRecord;
}
export interface RunDescriptor extends RunInfo {
  file: string;
  bytes: number;
  sha256: string;
  nonFiniteByField: Record<string, number>;
}
export interface RunData extends RunInfo {
  schemaVersion: 1;
  version: string;
  speedSemantics: "prescribed_reference_not_measured";
  fields: string[];
  rows: NumericValue[][];
  nonFiniteByField: Record<string, number>;
  engineRunningRule: string;
}
export interface Catalog {
  schemaVersion: 1;
  version: string;
  datasetHash: string;
  sourceFormat: string;
  playbackOnly: true;
  scientificSolverInBrowser: false;
  speedSemantics: "prescribed_reference_not_measured";
  provenance: {
    summary: { file: string; sha256: string };
    scientificSources: { file: string; sha256: string }[];
    method: string;
    precision: string;
    matUsage: string;
    caution: string;
    feasibilityRule: string;
  };
  counts: {
    runs: number;
    scenarios: number;
    strategies: number;
    infeasible: number;
  };
  scenarios: { id: string; label: string }[];
  strategies: { id: string; label: string; sourceName: string }[];
  fields: { name: string; label: string; unit: string; semantics?: string }[];
  modes: string[];
  runs: RunDescriptor[];
}
