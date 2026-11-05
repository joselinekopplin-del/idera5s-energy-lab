import { useId, useMemo } from "react";
export type Trace = { name: string; color: string; values: (number | null)[] };
export function TimeChart({
  title,
  unit,
  times,
  traces,
  cursor = 0,
  onTime,
  compact = false,
}: {
  title: string;
  unit: string;
  times: number[];
  traces: Trace[];
  cursor?: number;
  onTime?: (n: number) => void;
  compact?: boolean;
}) {
  const id = useId().replaceAll(":", ""),
    W = 680,
    H = compact ? 160 : 205,
    p = { l: 48, r: 15, t: 14, b: 28 },
    maxT = times[times.length - 1] || 1;
  const { hi, lo } = useMemo(() => {
    let hi = 1,
      lo = 0;
    for (const t of traces)
      for (const n of t.values)
        if (n !== null && Number.isFinite(n)) {
          hi = Math.max(hi, n);
          lo = Math.min(lo, n);
        }
    const span = hi - lo || 1;
    hi += span * 0.07;
    if (lo < 0) lo -= span * 0.07;
    return { hi, lo };
  }, [traces]);
  const px = (t: number) => p.l + (t / maxT) * (W - p.l - p.r),
    py = (n: number) => H - p.b - ((n - lo) / (hi - lo)) * (H - p.t - p.b);
  const paths = useMemo(
    () =>
      traces.map((trace) => {
        const values = trace.values,
          step = Math.max(1, Math.ceil(values.length / 400)),
          indices = new Set<number>();
        for (let start = 0; start < values.length; start += step) {
          const end = Math.min(start + step, values.length);
          let min = start,
            max = start;
          indices.add(start);
          for (let i = start; i < end; i++) {
            if (values[i] === null) {
              indices.add(i);
              continue;
            }
            if (values[min] === null || values[i]! < values[min]!) min = i;
            if (values[max] === null || values[i]! > values[max]!) max = i;
          }
          indices.add(min);
          indices.add(max);
          indices.add(end - 1);
        }
        let s = "",
          open = false;
        for (const i of [...indices].sort((a, b) => a - b)) {
          const value = values[i];
          if (value === null) {
            open = false;
            continue;
          }
          s += `${open ? "L" : "M"}${px(times[i]).toFixed(1)},${py(value).toFixed(1)}`;
          open = true;
        }
        return s;
      }),
    [traces, times, hi, lo, H],
  );
  const choose = (clientX: number, node: SVGSVGElement) => {
    if (!onTime) return;
    const rect = node.getBoundingClientRect();
    onTime(
      Math.min(
        maxT,
        Math.max(
          0,
          ((((clientX - rect.left) / rect.width) * W - p.l) / (W - p.l - p.r)) *
            maxT,
        ),
      ),
    );
  };
  return (
    <section className="chart-card">
      <div className="chart-heading">
        <h3>{title}</h3>
        <span>{unit}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role={onTime ? "slider" : "img"}
        aria-label={title}
        aria-valuemin={onTime ? 0 : undefined}
        aria-valuemax={onTime ? maxT : undefined}
        aria-valuenow={onTime ? Math.round(cursor) : undefined}
        tabIndex={onTime ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onTime?.(Math.min(maxT, cursor + 10));
          if (e.key === "ArrowLeft") onTime?.(Math.max(0, cursor - 10));
        }}
        onPointerDown={(e) => {
          if (onTime) {
            e.currentTarget.setPointerCapture(e.pointerId);
            choose(e.clientX, e.currentTarget);
          }
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) choose(e.clientX, e.currentTarget);
        }}
        className={onTime ? "interactive-chart" : ""}
      >
        <defs>
          <clipPath id={id}>
            <rect
              x={p.l}
              y={p.t}
              width={W - p.l - p.r}
              height={H - p.t - p.b}
            />
          </clipPath>
        </defs>
        {[0, 0.5, 1].map((f) => {
          const val = lo + (hi - lo) * f,
            y = py(val);
          return (
            <g key={f}>
              <line className="gridline" x1={p.l} x2={W - p.r} y1={y} y2={y} />
              <text x={p.l - 9} y={y + 4} textAnchor="end">
                {Math.abs(val) < 10 ? val.toFixed(1) : val.toFixed(0)}
              </text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} x={px(f * maxT)} y={H - 6} textAnchor="middle">
            {((f * maxT) / 60).toFixed(0)} min
          </text>
        ))}
        <g clipPath={`url(#${id})`}>
          {traces.map((t, i) => (
            <path
              key={t.name}
              d={paths[i]}
              stroke={t.color}
              strokeWidth="2"
              fill="none"
              strokeLinejoin="round"
            />
          ))}
          {onTime && (
            <line
              x1={px(cursor)}
              x2={px(cursor)}
              y1={p.t}
              y2={H - p.b}
              className="cursor-line"
            />
          )}
        </g>
      </svg>
      <div className="chart-legend">
        {traces.map((t) => (
          <span key={t.name}>
            <i style={{ background: t.color }} />
            {t.name}
          </span>
        ))}
      </div>
    </section>
  );
}
