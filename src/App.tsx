import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Battery,
  BookOpen,
  CarFront,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  Expand,
  FlaskConical,
  Gauge,
  Layers3,
  Leaf,
  Lightbulb,
  Maximize,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sun,
  Timer,
  TriangleAlert,
  Waves,
  Zap,
} from "lucide-react";
import {
  VehicleScene,
  initialSettings,
  paints,
  views,
  type Settings,
  type Sample,
} from "./3d/VehicleScene";
import { TimeChart, type Trace } from "./charts/TimeChart";
import { fetchCatalog, loadRun } from "./data/client";
import type { Catalog, RunData } from "./data/types";

const modes = [
  "停车 / 辅助负载",
  "纯电驱动",
  "混合驱动 / 发动机运行",
  "制动回收",
  "发动机驱动并充电",
];
const partNames: Record<string, string> = {
  battery: "动力电池",
  engine: "发动机",
  motor: "驱动电机",
  gear: "传动系统",
  fuel: "燃油箱",
  aux: "辅助系统",
};
const strategyColors = ["#20785f", "#ae6c21", "#5b82bb", "#9a62a2"];
const fmt = (v: number | null | undefined, n = 1) =>
  v == null
    ? "—"
    : v.toLocaleString("zh-CN", {
        minimumFractionDigits: n,
        maximumFractionDigits: n,
      });
function values(run: RunData | undefined, field: string, scale = 1) {
  if (!run) return [];
  const index = run.fields.indexOf(field);
  return run.rows.map((r) => (r[index] === null ? null : r[index] * scale));
}
function rowAt(run: RunData | undefined, time: number): Sample {
  if (!run) return {};
  const ti = run.fields.indexOf("Time_s");
  let l = 0,
    r = run.rows.length - 1;
  while (l < r) {
    const m = Math.ceil((l + r) / 2);
    if ((run.rows[m][ti] ?? 0) <= time) l = m;
    else r = m - 1;
  }
  return Object.fromEntries(
    run.fields.map((field, i) => [field, run.rows[l][i]]),
  );
}
function route() {
  return location.hash.replace("#/", "").split("?")[0] || "home";
}
function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <button
      className="switch-row"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
    >
      <span>{label}</span>
      <span className={"switch " + (value ? "checked" : "")}>
        <i>{value && <Check size={12} />}</i>
      </span>
    </button>
  );
}
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <h2>{title}</h2>
      {children}
      <div className="dialog-actions">
        <button className="button filled" onClick={onClose}>
          知道了
        </button>
      </div>
    </dialog>
  );
}

export default function App() {
  const [page, setPage] = useState(route),
    [theme, setTheme] = useState(
      localStorage.getItem("energy-theme") || "system",
    ),
    [catalog, setCatalog] = useState<Catalog>(),
    [run, setRun] = useState<RunData>(),
    [runId, setRunId] = useState("urban_EVPriority"),
    [dataError, setDataError] = useState(""),
    [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>(initialSettings),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(5),
    [part, setPart] = useState(""),
    [help, setHelp] = useState(false),
    [compareRuns, setCompareRuns] = useState<RunData[]>([]),
    [compareMetric, setCompareMetric] = useState("SOC"),
    [compareLoading, setCompareLoading] = useState(false);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));
  useEffect(() => {
    const listener = () => {
      setPage(route());
      setPlaying(false);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    const m = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (m.matches ? "dark" : "light") : theme);
    apply();
    localStorage.setItem("energy-theme", theme);
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch((e) => setDataError(String(e)));
  }, []);
  const entry = catalog?.runs.find((r) => r.id === runId) || catalog?.runs[0];
  useEffect(() => {
    if (!entry) return;
    let active = true;
    setLoading(true);
    setPlaying(false);
    setTime(0);
    setRun(undefined);
    setDataError("");
    loadRun(entry)
      .then((r) => {
        if (active) {
          setRun(r);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setDataError(String(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [entry]);
  useEffect(() => {
    if (page !== "analysis" || !catalog || !entry) return;
    let active = true;
    setCompareLoading(true);
    setCompareRuns([]);
    Promise.all(
      catalog.runs
        .filter((r) => r.scenario === entry.scenario)
        .map((r) => loadRun(r)),
    )
      .then((r) => {
        if (active) {
          setCompareRuns(r);
          setCompareLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setDataError(String(e));
          setCompareLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [page, entry?.scenario, catalog]);
  const duration = entry?.endTime_s || 0;
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(),
        dt = (now - last) / 1000;
      last = now;
      setTime((t) => {
        const next = Math.min(duration, t + dt * speed);
        if (next >= duration) setPlaying(false);
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, speed, duration]);
  const sample = useMemo(() => rowAt(run, time), [run, time]),
    times = useMemo(() => values(run, "Time_s") as number[], [run]);
  const traces = useMemo(
    () => ({
      soc: [
        { name: "电池 SOC", color: "#278468", values: values(run, "SOC", 100) },
      ],
      speed: [
        {
          name: "参考车速",
          color: "#5585b1",
          values: values(run, "Speed_mps", 3.6),
        },
      ],
      power: [
        {
          name: "发动机",
          color: "#b27927",
          values: values(run, "Engine_W", 0.001),
        },
        {
          name: "电机",
          color: "#4d8dc2",
          values: values(run, "Motor_W", 0.001),
        },
        {
          name: "电池",
          color: "#278468",
          values: values(run, "Battery_W", 0.001),
        },
      ],
      energy: [
        {
          name: "电池净耗",
          color: "#278468",
          values: values(run, "BatteryNet_kWh"),
        },
        {
          name: "累计回收",
          color: "#4d8dc2",
          values: values(run, "Regen_kWh"),
        },
      ],
    }),
    [run],
  );
  const chooseScenario = (scenario: string) => {
    const next = catalog?.runs.find(
      (r) => r.scenario === scenario && r.strategy === entry?.strategy,
    );
    if (next) setRunId(next.id);
  };
  const chooseStrategy = (strategy: string) => {
    const next = catalog?.runs.find(
      (r) => r.scenario === entry?.scenario && r.strategy === strategy,
    );
    if (next) setRunId(next.id);
  };
  const nav = [
    { id: "home", label: "车辆概览", en: "Overview", icon: CarFront },
    { id: "lab", label: "能量实验室", en: "Energy lab", icon: FlaskConical },
    {
      id: "analysis",
      label: "策略分析",
      en: "Analysis",
      icon: ChartNoAxesCombined,
    },
    { id: "about", label: "模型说明", en: "About", icon: BookOpen },
  ];
  const changeTime = (n: number) => {
    setPlaying(false);
    setTime(n);
  };
  const colorControls = (
    <div className="paint-options" aria-label="车漆颜色">
      {paints.map((c) => (
        <button
          key={c.id}
          className={"paint " + (settings.color === c.id ? "selected" : "")}
          style={{ "--paint": c.hex } as React.CSSProperties}
          title={c.name}
          aria-label={c.name}
          aria-pressed={settings.color === c.id}
          onClick={() => set("color", c.id)}
        >
          {settings.color === c.id && <Check size={17} />}
        </button>
      ))}
    </div>
  );
  const viewControls = (
    <div className="view-options" aria-label="车辆视角">
      {views.map((p) => (
        <button
          key={p.id}
          aria-pressed={settings.view === p.id}
          onClick={() => set("view", p.id)}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
  const scenarioControl = (
    <Select
      label="驾驶工况"
      value={entry?.scenario || ""}
      onChange={chooseScenario}
    >
      {catalog?.scenarios.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </Select>
  );
  const stage = (
    <VehicleScene
      settings={settings}
      sample={sample}
      lab={page === "lab"}
      onInteract={() => set("auto", false)}
      onPick={setPart}
    />
  );
  const kpis = [
    {
      label: "参考车速",
      value: (sample.Speed_mps ?? 0) * 3.6,
      unit: "km/h",
      icon: Gauge,
    },
    {
      label: "电池 SOC",
      value: (sample.SOC ?? 0) * 100,
      unit: "%",
      icon: Battery,
    },
    {
      label: "发动机功率",
      value: (sample.Engine_W ?? 0) / 1000,
      unit: "kW",
      icon: Zap,
    },
    {
      label: "电机功率",
      value: (sample.Motor_W ?? 0) / 1000,
      unit: "kW",
      icon: Zap,
    },
    {
      label: "电池功率",
      value: (sample.Battery_W ?? 0) / 1000,
      unit: "kW",
      icon: Battery,
    },
    { label: "累计燃油", value: sample.FuelUsed_L, unit: "L", icon: Waves },
    {
      label: "参考里程",
      value: sample.Distance_km,
      unit: "km",
      icon: CarFront,
    },
    {
      label: "电池净耗",
      value: sample.BatteryNet_kWh,
      unit: "kWh",
      icon: Leaf,
    },
  ];
  return (
    <div className="app-shell">
      <aside className="nav-rail">
        <a className="brand-icon" href="#/home" aria-label="Energy Lab 首页">
          <Zap size={27} fill="currentColor" />
        </a>
        <nav>
          {nav.map((n) => (
            <a
              href={"#/" + n.id}
              key={n.id}
              aria-current={page === n.id ? "page" : undefined}
            >
              <span>
                <n.icon size={23} />
              </span>
              <b>{n.label}</b>
            </a>
          ))}
        </nav>
        <button
          className="help-button"
          title="操作帮助"
          onClick={() => setHelp(true)}
        >
          <CircleHelp size={24} />
        </button>
        <span className="rail-caption">
          RESEARCH
          <br />
          EDITION
        </span>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <a href="#/home" className="wordmark">
            ID.ERA <strong>5S</strong>
            <span className="brand-divider" /> <span>Energy Lab</span>
          </a>
          <div className="topbar-right">
            <span className="research-badge">
              <i /> 独立研究项目
            </span>
            <label className="theme-select">
              <Sun size={17} />
              <select
                aria-label="界面主题"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="system">跟随系统</option>
                <option value="light">浅色主题</option>
                <option value="dark">深色主题</option>
              </select>
            </label>
            <button
              className="icon-button"
              aria-label="操作帮助"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={20} />
            </button>
          </div>
        </header>
        {dataError && (
          <div className="error-banner" role="alert">
            <TriangleAlert size={18} /> 数据加载失败：{dataError}
            <button onClick={() => location.reload()}>重试</button>
          </div>
        )}
        <main>
          {(page === "home" || page === "lab") && (
            <div className={page === "home" ? "overview" : "laboratory"}>
              {page === "home" ? (
                <>
                  <div className="page-eyebrow">
                    <span className="eyebrow-line" /> VEHICLE ENERGY RESEARCH ·
                    2026
                  </div>
                  <div className="hero-intro">
                    <div>
                      <h1>
                        每一程，
                        <br />
                        <em>看见能量的流动。</em>
                      </h1>
                      <p>Interactive Vehicle Energy Management Simulator</p>
                      <p className="intro-note">
                        从一辆车，探索动力与效率的平衡。
                      </p>
                    </div>
                    <a className="button filled large" href="#/lab">
                      进入能量实验室 <ArrowRight size={18} />
                    </a>
                  </div>
                </>
              ) : (
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">SIMULATION PLAYBACK</span>
                    <h1>能量实验室</h1>
                    <p>来自 MATLAB 的已保存结果 · 选择工况，追踪每一份能量。</p>
                  </div>
                  <span className="chip">
                    <ShieldCheck size={15} /> 原始数据可追溯
                  </span>
                </div>
              )}
              <div
                className={page === "lab" ? "lab-layout" : "hero-model-layout"}
              >
                {page === "lab" && (
                  <aside className="panel controls-panel">
                    <div className="panel-title">
                      <Settings2 size={19} />
                      <h2>回放控制</h2>
                    </div>
                    {scenarioControl}
                    <Select
                      label="能量管理策略"
                      value={entry?.strategy || ""}
                      onChange={chooseStrategy}
                    >
                      {catalog?.strategies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                    <div
                      className={
                        "feasibility " + (entry?.feasible ? "" : "warning")
                      }
                    >
                      <span>
                        {entry?.feasible ? (
                          <Check size={17} />
                        ) : (
                          <TriangleAlert size={17} />
                        )}
                      </span>
                      <div>
                        <b>
                          {entry?.feasible ? "参考工况可满足" : "存在动力缺口"}
                        </b>
                        <small>
                          {entry?.feasible
                            ? "基于已保存的模型判定"
                            : "该结果不能完全满足参考车速"}
                        </small>
                      </div>
                    </div>
                    <div className="divider" />
                    <Select
                      label="车身显示"
                      value={settings.shell}
                      onChange={(s) => set("shell", s)}
                    >
                      <option value="solid">实体车身</option>
                      <option value="transparent">透视车身</option>
                      <option value="hidden">隐藏车身</option>
                    </Select>
                    <label className="range-field">
                      <span>
                        部件拆解 <b>{Math.round(settings.explode * 100)}%</b>
                      </span>
                      <input
                        aria-label="部件拆解"
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={settings.explode}
                        onChange={(e) => set("explode", +e.target.value)}
                      />
                    </label>
                    <Toggle
                      label="显示能量流"
                      value={settings.flow}
                      onChange={(b) => set("flow", b)}
                    />
                    <div className="part-picker">
                      <span className="field-label">动力部件</span>
                      <div>
                        {Object.entries(partNames).map(([id, name]) => (
                          <button
                            key={id}
                            onClick={() => {
                              set("shell", "transparent");
                              setPart(id);
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="fine-print">
                      内部部件位置为教学示意。绿色为驱动供能，蓝色为反向发电 /
                      充电，金色为燃油供能。
                    </p>
                  </aside>
                )}
                <section className="stage-panel" data-studio={settings.studio}>
                  {stage}
                  {page === "home" && (
                    <div className="model-label">
                      <span>2026 · NEO</span>
                      <h2>ID.ERA 5S</h2>
                      <p>17″ 风车轮毂 · 原创外观近似</p>
                    </div>
                  )}
                  <div className="stage-tools">
                    <button
                      className="icon-button"
                      title="复位视角"
                      aria-label="复位视角"
                      onClick={() => {
                        setSettings((s) => ({
                          ...s,
                          view: "front45",
                          reset: s.reset + 1,
                          explode: 0,
                        }));
                      }}
                    >
                      <RotateCcw size={18} />
                    </button>
                    <button
                      className="icon-button"
                      title="全屏三维视图"
                      aria-label="全屏三维视图"
                      onClick={() => {
                        const el = document.querySelector(".stage-panel");
                        if (document.fullscreenElement)
                          document.exitFullscreen();
                        else el?.requestFullscreen();
                      }}
                    >
                      <Expand size={18} />
                    </button>
                  </div>
                  <div className="stage-bottom">{viewControls}</div>
                </section>
                {page === "lab" && (
                  <aside className="panel telemetry-panel">
                    <div className="panel-title">
                      <Waves size={19} />
                      <h2>能量状态</h2>
                      <span className="live-dot" />
                    </div>
                    {loading ? (
                      <div role="status" className="data-loading">
                        正在读取仿真结果…
                      </div>
                    ) : (
                      <>
                        <div className="mode-label">
                          <Zap size={15} />
                          {modes[sample.ModeCode ?? 0] || "未定义状态"}
                        </div>
                        <div className="kpi-grid">
                          {kpis.map((k) => (
                            <div className="kpi" key={k.label}>
                              <span>{k.label}</span>
                              <strong>
                                {fmt(
                                  k.value,
                                  k.unit === "L" || k.unit === "kWh" ? 2 : 1,
                                )}
                                <small>{k.unit}</small>
                              </strong>
                            </div>
                          ))}
                        </div>
                        <div className="soc-meter">
                          <span
                            style={{ width: `${(sample.SOC ?? 0) * 100}%` }}
                          />
                        </div>
                        <div className="instant-deficit">
                          当前动力缺口{" "}
                          <b>{fmt((sample.Unmet_W ?? 0) / 1000, 2)} kW</b>
                        </div>
                      </>
                    )}
                    <p className="fine-print">
                      参考速度与里程来自预设工况；模型未求解可观测的实际车速。
                    </p>
                  </aside>
                )}
              </div>
              {page === "home" ? (
                <>
                  <div className="configuration-bar">
                    <div className="color-config">
                      <span className="field-label">
                        车身颜色{" "}
                        <b>
                          {paints.find((p) => p.id === settings.color)?.name}
                        </b>
                      </span>
                      {colorControls}
                    </div>
                    <div className="config-divider" />
                    <Select
                      label="灯光模式"
                      value={settings.lights}
                      onChange={(s) => set("lights", s)}
                    >
                      <option value="off">关闭</option>
                      <option value="drl">日间行车灯</option>
                      <option value="head">前大灯</option>
                      <option value="tail">尾灯</option>
                      <option value="brake">制动灯</option>
                    </Select>
                    <Select
                      label="摄影棚"
                      value={settings.studio}
                      onChange={(s) => set("studio", s)}
                    >
                      <option value="light">明亮摄影棚</option>
                      <option value="dark">深色摄影棚</option>
                    </Select>
                    <Select
                      label="画质"
                      value={settings.quality}
                      onChange={(s) => set("quality", s)}
                    >
                      <option value="auto">自适应</option>
                      <option value="high">高清 · LOD0</option>
                      <option value="standard">标准 · LOD1</option>
                      <option value="low">轻量 · LOD2</option>
                    </Select>
                    <Toggle
                      label="自动旋转"
                      value={settings.auto}
                      onChange={(b) => set("auto", b)}
                    />
                  </div>
                  <div className="overview-bottom">
                    <div className="research-numbers">
                      <div>
                        <strong>16</strong>
                        <span>驾驶工况</span>
                      </div>
                      <div>
                        <strong>4</strong>
                        <span>控制策略</span>
                      </div>
                      <div>
                        <strong>64</strong>
                        <span>真实结果</span>
                      </div>
                    </div>
                    <p>
                      <ShieldCheck size={20} />
                      <span>
                        公开资料 + 工程假设
                        <br />
                        <b>可复现计算，可追溯数据。</b>
                      </span>
                    </p>
                    <a href="#/about">
                      了解模型与研究边界 <ArrowUpRight size={17} />
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <div className="playback-bar panel">
                    <button
                      className="play-button"
                      aria-label={playing ? "暂停回放" : "播放回放"}
                      disabled={loading || !run}
                      onClick={() => {
                        if (time >= duration) setTime(0);
                        setPlaying(!playing);
                      }}
                    >
                      {playing ? (
                        <Pause size={21} fill="currentColor" />
                      ) : (
                        <Play size={21} fill="currentColor" />
                      )}
                    </button>
                    <span className="time-display">
                      <b>
                        {Math.floor(time / 60)}:
                        {String(Math.floor(time % 60)).padStart(2, "0")}
                      </b>
                      <span>
                        / {Math.floor(duration / 60)}:
                        {String(Math.floor(duration % 60)).padStart(2, "0")}
                      </span>
                    </span>
                    <input
                      aria-label="回放时间"
                      type="range"
                      min="0"
                      max={duration}
                      step="1"
                      value={time}
                      disabled={!run}
                      onChange={(e) => changeTime(+e.target.value)}
                    />
                    <Select
                      label="播放速度"
                      value={String(speed)}
                      onChange={(s) => setSpeed(+s)}
                    >
                      {[1, 2, 5, 10, 20].map((n) => (
                        <option key={n} value={n}>
                          {n}×
                        </option>
                      ))}
                    </Select>
                    <button
                      className="icon-button"
                      aria-label="回到起点"
                      onClick={() => changeTime(0)}
                    >
                      <RotateCcw size={19} />
                    </button>
                  </div>
                  <details className="visual-options panel">
                    <summary>
                      <Layers3 size={18} /> 外观与渲染设置{" "}
                      <ChevronRight size={16} />
                    </summary>
                    <div className="visual-options-grid">
                      {colorControls}
                      <Select
                        label="灯光"
                        value={settings.lights}
                        onChange={(s) => set("lights", s)}
                      >
                        {[
                          ["off", "关闭"],
                          ["drl", "日行灯"],
                          ["head", "前大灯"],
                          ["tail", "尾灯"],
                          ["brake", "制动灯"],
                          ["auto", "跟随回放制动"],
                        ].map(([id, n]) => (
                          <option key={id} value={id}>
                            {n}
                          </option>
                        ))}
                      </Select>
                      <Select
                        label="摄影棚"
                        value={settings.studio}
                        onChange={(s) => set("studio", s)}
                      >
                        <option value="light">明亮</option>
                        <option value="dark">深色</option>
                      </Select>
                      <Select
                        label="画质"
                        value={settings.quality}
                        onChange={(s) => set("quality", s)}
                      >
                        {[
                          ["auto", "自适应"],
                          ["high", "高清"],
                          ["standard", "标准"],
                          ["low", "轻量"],
                        ].map(([id, n]) => (
                          <option key={id} value={id}>
                            {n}
                          </option>
                        ))}
                      </Select>
                      <Toggle
                        label="自动旋转"
                        value={settings.auto}
                        onChange={(b) => set("auto", b)}
                      />
                    </div>
                  </details>
                  <div className="section-heading">
                    <h2>沿时间，观察变化</h2>
                    <span>点击图表移动统一游标 · 原始数据按需加载</span>
                  </div>
                  <div className="charts-grid">
                    <TimeChart
                      title="电池荷电状态"
                      unit="%"
                      times={times}
                      traces={traces.soc}
                      cursor={time}
                      onTime={changeTime}
                    />
                    <TimeChart
                      title="参考车速"
                      unit="km/h"
                      times={times}
                      traces={traces.speed}
                      cursor={time}
                      onTime={changeTime}
                    />
                    <TimeChart
                      title="动力系统功率"
                      unit="kW"
                      times={times}
                      traces={traces.power}
                      cursor={time}
                      onTime={changeTime}
                    />
                    <TimeChart
                      title="累计电能"
                      unit="kWh"
                      times={times}
                      traces={traces.energy}
                      cursor={time}
                      onTime={changeTime}
                    />
                  </div>
                  <div className="data-provenance">
                    <span>
                      数据版本 {catalog?.version} · {runId} ·{" "}
                      {entry?.sampleCount.toLocaleString()} 个采样点
                    </span>
                    {entry && (
                      <a href={import.meta.env.BASE_URL + entry.file} download>
                        <Download size={15} /> 下载当前结果 JSON
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {page === "analysis" && (
            <div className="analysis-page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">COMPARE STRATEGIES</span>
                  <h1>同一段路，不同的选择。</h1>
                  <p>
                    在相同参考工况下比较四种策略，结合燃油、电量与最终 SOC
                    阅读结果。
                  </p>
                </div>
                <ChartNoAxesCombined size={38} />
              </div>
              <div className="analysis-controls panel">
                {scenarioControl}
                <Select
                  label="对比曲线"
                  value={compareMetric}
                  onChange={setCompareMetric}
                >
                  {[
                    ["SOC", "电池 SOC"],
                    ["FuelUsed_L", "累计燃油"],
                    ["BatteryNet_kWh", "电池净耗"],
                    ["Engine_W", "发动机功率"],
                    ["Motor_W", "电机功率"],
                    ["Regen_kWh", "累计制动回收"],
                  ].map(([id, n]) => (
                    <option key={id} value={id}>
                      {n}
                    </option>
                  ))}
                </Select>
                <span className="chip">同工况 · 四策略</span>
              </div>
              {compareLoading ? (
                <div className="loading-block" role="status">
                  正在按需加载四组对比数据…
                </div>
              ) : (
                <>
                  <div className="comparison-chart">
                    <TimeChart
                      title={
                        {
                          SOC: "电池荷电状态",
                          FuelUsed_L: "累计燃油消耗",
                          BatteryNet_kWh: "电池净耗",
                          Engine_W: "发动机功率",
                          Motor_W: "电机功率",
                          Regen_kWh: "累计制动回收",
                        }[compareMetric] || ""
                      }
                      unit={
                        compareMetric === "SOC"
                          ? "%"
                          : compareMetric.endsWith("_W")
                            ? "kW"
                            : compareMetric === "FuelUsed_L"
                              ? "L"
                              : "kWh"
                      }
                      times={values(compareRuns[0], "Time_s") as number[]}
                      traces={compareRuns.map((r, i) => ({
                        name:
                          catalog?.strategies.find((s) => s.id === r.strategy)
                            ?.label || r.strategy,
                        color: strategyColors[i],
                        values: values(
                          r,
                          compareMetric,
                          compareMetric === "SOC"
                            ? 100
                            : compareMetric.endsWith("_W")
                              ? 0.001
                              : 1,
                        ),
                      }))}
                    />
                  </div>
                  <div className="strategy-cards">
                    {catalog?.runs
                      .filter((r) => r.scenario === entry?.scenario)
                      .map((r, i) => (
                        <article
                          className="panel strategy-card"
                          key={r.id}
                          style={
                            {
                              "--strategy": strategyColors[i],
                            } as React.CSSProperties
                          }
                        >
                          <div className="strategy-title">
                            <span />
                            <h2>{r.strategyLabel}</h2>
                            {!r.feasible && <TriangleAlert size={17} />}
                          </div>
                          <strong>
                            {fmt(r.summary.Fuel_L, 2)}
                            <small> L 燃油</small>
                          </strong>
                          <dl>
                            <div>
                              <dt>电池净耗</dt>
                              <dd>{fmt(r.summary.BatteryNet_kWh, 2)} kWh</dd>
                            </div>
                            <div>
                              <dt>制动回收</dt>
                              <dd>{fmt(r.summary.Regen_kWh, 2)} kWh</dd>
                            </div>
                            <div>
                              <dt>发动机启动</dt>
                              <dd>{fmt(r.summary.EngineStarts, 0)} 次</dd>
                            </div>
                            <div>
                              <dt>最终 SOC</dt>
                              <dd>{fmt((r.summary.SOC_end ?? 0) * 100)}%</dd>
                            </div>
                            <div>
                              <dt>动力缺口</dt>
                              <dd>{fmt(r.summary.Unmet_kWh, 3)} kWh</dd>
                            </div>
                          </dl>
                          <a
                            className="button tonal"
                            href="#/lab"
                            onClick={() => setRunId(r.id)}
                          >
                            查看回放 <ArrowRight size={16} />
                          </a>
                        </article>
                      ))}
                  </div>
                  <div className="info-note">
                    <CircleHelp size={20} />
                    <p>
                      不同策略的最终 SOC
                      可能不同，燃油量不能单独作为综合效率排名。表中“电池净耗”为放电与充电的净值；保留所有不可行结果及其动力缺口。
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          {page === "about" && (
            <div className="about-page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">MODELS & METHODOLOGY</span>
                  <h1>让每个结果，都有依据。</h1>
                  <p>独立的汽车能源管理教学与研究可视化平台。</p>
                </div>
                <BookOpen size={38} />
              </div>
              <div className="about-grid">
                <article className="panel about-card">
                  <span className="card-number">01</span>
                  <h2>计算与呈现，清晰分层</h2>
                  <p>
                    MATLAB / Simulink
                    负责纵向动力学、功率分配与能耗计算。网页读取已保存的 64
                    组结果，进行客户端可视化回放，不运行 MATLAB 在线求解器。
                  </p>
                  <div className="architecture">
                    <span>MATLAB / Simulink</span>
                    <ArrowRight size={19} />
                    <span>带哈希的数据导出</span>
                    <ArrowRight size={19} />
                    <span>WebGL 交互回放</span>
                  </div>
                </article>
                <article className="panel about-card">
                  <span className="card-number">02</span>
                  <h2>外形有参考，精度有边界</h2>
                  <p>
                    以公开 Neo 实车多视角照片独立创建参数化曲面。名义长 4836
                    mm、宽 1880 mm、高 1505 mm、轴距 2766 mm；默认 225/55 R17
                    风车式轮组。非厂商 CAD、扫描模型或实车数字孪生。
                  </p>
                  <p>
                    五种车漆为视觉近似；内部动力部件为教学布置。未核实的 Neo
                    中央灯带与徽标发光功能不予模拟。网页不发布媒体原始照片。
                  </p>
                </article>
                <article className="panel about-card">
                  <span className="card-number">03</span>
                  <h2>完整保留研究结果</h2>
                  <p>
                    16 工况 × 4 策略，共 64 组原始结果。其中冬季 −10°C 工况的 EV
                    Priority、Rule Based、SOC Hold
                    三组存在动力缺口，仍完整展示。
                  </p>
                  <p>
                    Speed_mps 与 Distance_km
                    是参考工况的速度与里程，不是实际达到的车速和行驶里程。车轮转动跟随参考里程。电池功率正值表示放电，电机负功率表示发电。
                  </p>
                  <code>数据版本：{catalog?.version || "加载中"}</code>
                  <a
                    href={import.meta.env.BASE_URL + "data/catalog.json"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看数据目录与 SHA-256 <ArrowUpRight size={16} />
                  </a>
                </article>
                <article className="panel about-card">
                  <span className="card-number">04</span>
                  <h2>可复现，也可继续探索</h2>
                  <p>
                    模型提供高清、标准和轻量三级
                    LOD。原创浮点摄影棚环境生成反射，清漆 PBR
                    材质呈现车身。窄屏默认使用轻量模型，动画遵循减少动态效果设置。
                  </p>
                  <div className="source-links">
                    <a
                      href="https://github.com/joselinekopplin-del/idera5s-energy-lab"
                      target="_blank"
                      rel="noreferrer"
                    >
                      源代码与运行说明 <ArrowUpRight size={16} />
                    </a>
                    <a
                      href="https://www.svw-volkswagen.com/idera5s/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      上汽大众车型资料 <ArrowUpRight size={16} />
                    </a>
                    <a
                      href="https://www.autohome.com.cn/cars/imglist-x-x-8651-78803-1-x-x-x-x-1.html"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Neo 多视角参考来源 <ArrowUpRight size={16} />
                    </a>
                  </div>
                </article>
              </div>
              <div className="research-disclaimer">
                <ShieldCheck size={25} />
                <p>
                  本项目为独立的汽车能源管理教学与研究可视化平台。车辆外观与性能模型基于公开资料及工程假设，不代表上汽大众官方技术数据或实车性能保证。
                </p>
              </div>
            </div>
          )}
          {!["home", "lab", "analysis", "about"].includes(page) && (
            <div className="loading-block">
              <h1>页面不存在</h1>
              <a href="#/home">返回车辆概览</a>
            </div>
          )}
        </main>
        <footer>
          <span>
            ID.ERA 5S <b>Energy Lab</b>
          </span>
          <p>独立教学与研究项目 · 非上汽大众官方软件 · 已保存数据回放</p>
          <a href="#/about">
            数据与模型说明 <ArrowUpRight size={13} />
          </a>
        </footer>
      </div>
      {help && (
        <Dialog title="探索 Energy Lab" onClose={() => setHelp(false)}>
          <ol className="help-list">
            <li>
              拖动车辆旋转视角，滚轮或双指手势缩放。键盘聚焦三维画面后使用方向键与
              + / −。
            </li>
            <li>
              在能量实验室选择工况和策略，点击播放，或拖动时间滑块。点击任意图表同步定位时间。
            </li>
            <li>
              选择透视或隐藏车身，展开部件后点击动力部件，查看当前采样值。
            </li>
            <li>
              手机默认轻量画质；性能不足时可手动切换轻量。自动旋转会在操作后暂停。
            </li>
          </ol>
          <p>
            所有回放来自已保存 MATLAB 结果。首次选择长途工况需下载约数 MB 数据。
          </p>
        </Dialog>
      )}
      {part && (
        <Dialog
          title={partNames[part] + " · 当前采样"}
          onClose={() => setPart("")}
        >
          <p className="fine-print">
            教学等效部件位置，不代表原厂内部布局。t = {fmt(sample.Time_s, 0)} s
          </p>
          <dl className="part-values">
            {(part === "battery"
              ? [
                  ["荷电状态", fmt((sample.SOC ?? 0) * 100) + " %"],
                  ["电池功率", fmt((sample.Battery_W ?? 0) / 1000) + " kW"],
                  ["电池温度", fmt(sample.Battery_C) + " °C"],
                  ["累计净耗电量", fmt(sample.BatteryNet_kWh, 3) + " kWh"],
                ]
              : part === "engine"
                ? [
                    ["输出功率", fmt((sample.Engine_W ?? 0) / 1000) + " kW"],
                    ["发动机转速", fmt(sample.EngineRPM, 0) + " rpm"],
                    ["燃油化学功率", fmt((sample.Fuel_W ?? 0) / 1000) + " kW"],
                    ["效率", fmt((sample.EngineEta ?? 0) * 100) + " %"],
                  ]
                : part === "motor"
                  ? [
                      [
                        "当前状态",
                        Math.abs(sample.Motor_W ?? 0) < 1
                          ? "待机"
                          : (sample.Motor_W ?? 0) < 0
                            ? (sample.ModeCode ?? 0) === 4
                              ? "发电 / 发动机充电"
                              : "发电 / 制动回收"
                            : "驱动",
                      ],
                      ["机械功率", fmt((sample.Motor_W ?? 0) / 1000) + " kW"],
                      ["电机效率", fmt((sample.MotorEta ?? 0) * 100) + " %"],
                      ["损耗", fmt((sample.MotorLoss_W ?? 0) / 1000) + " kW"],
                    ]
                  : part === "fuel"
                    ? [
                        ["剩余燃油", fmt(sample.FuelRemaining_L, 2) + " L"],
                        ["累计燃油", fmt(sample.FuelUsed_L, 3) + " L"],
                      ]
                    : part === "gear"
                      ? [
                          [
                            "传动损耗",
                            fmt((sample.GearLoss_W ?? 0) / 1000) + " kW",
                          ],
                          [
                            "轮端参考功率",
                            fmt((sample.Wheel_W ?? 0) / 1000) + " kW",
                          ],
                        ]
                      : [
                          ["辅助负载", fmt((sample.Aux_W ?? 0) / 1000) + " kW"],
                          [
                            "辅助缺口",
                            fmt((sample.AuxUnmet_W ?? 0) / 1000) + " kW",
                          ],
                        ]
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      )}
    </div>
  );
}
