import type { Catalog, NumericValue, RunData, RunDescriptor } from "./types";

const cache = new Map<string, RunData>();
const MAX_CACHED_RUNS = 4;
export function assetURL(file: string): string {
  if (
    !/^(?:data|models|assets)\/[A-Za-z0-9_./-]+$/.test(file) ||
    file.includes("..")
  )
    throw new Error("无效的资源路径");
  return `${import.meta.env.BASE_URL}${file}`;
}

export async function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
  const response = await fetch(assetURL("data/catalog.json"), { signal });
  if (!response.ok) throw new Error(`数据目录加载失败 (${response.status})`);
  const catalog = (await response.json()) as Catalog;
  if (
    catalog.schemaVersion !== 1 ||
    !catalog.playbackOnly ||
    catalog.runs?.length !== 64 ||
    catalog.speedSemantics !== "prescribed_reference_not_measured"
  )
    throw new Error("数据目录格式或来源不兼容");
  return catalog;
}

/** Lazy loading: fetch only a chosen run; four-run LRU bounds retained long-trip datasets. */
export async function loadRun(
  descriptor: RunDescriptor,
  signal?: AbortSignal,
): Promise<RunData> {
  const key = `${descriptor.id}:${descriptor.sha256}`;
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cache.set(key, existing);
    return existing;
  }
  const response = await fetch(assetURL(descriptor.file), { signal });
  if (!response.ok) throw new Error(`仿真结果加载失败 (${response.status})`);
  const bytes = await response.arrayBuffer();
  // HTTPS GitHub Pages and localhost both expose Web Crypto. Fail on changed data.
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== descriptor.sha256)
      throw new Error("结果文件校验失败，请刷新以获取同版本数据目录");
  }
  const run = JSON.parse(new TextDecoder().decode(bytes)) as RunData;
  if (
    run.schemaVersion !== 1 ||
    run.id !== descriptor.id ||
    run.rows?.length !== descriptor.sampleCount ||
    run.speedSemantics !== "prescribed_reference_not_measured"
  )
    throw new Error("结果文件与目录不匹配");
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  cache.set(key, run);
  while (cache.size > MAX_CACHED_RUNS) cache.delete(cache.keys().next().value!);
  return run;
}

export function rowValue(
  run: RunData,
  index: number,
  field: string,
): NumericValue {
  const column = run.fields.indexOf(field);
  const row =
    run.rows[Math.max(0, Math.min(run.rows.length - 1, Math.round(index)))];
  return column >= 0 && row ? (row[column] ?? null) : null;
}
export function rowObject(
  run: RunData,
  index: number,
): Record<string, NumericValue> {
  const row =
    run.rows[Math.max(0, Math.min(run.rows.length - 1, Math.round(index)))];
  return Object.fromEntries(
    run.fields.map((field, column) => [field, row?.[column] ?? null]),
  );
}
export function indexAtTime(run: RunData, seconds: number): number {
  return Math.max(
    0,
    Math.min(
      run.rows.length - 1,
      Math.round((seconds - run.startTime_s) / run.sampleInterval_s),
    ),
  );
}
export function clearRunCache(): void {
  cache.clear();
}
