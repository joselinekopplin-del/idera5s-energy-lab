import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { LoaderCircle, Rotate3D, AlertTriangle } from "lucide-react";

export type Sample = Record<string, number | null>;
export type Settings = {
  color: string;
  lights: string;
  shell: string;
  explode: number;
  auto: boolean;
  studio: string;
  quality: string;
  view: string;
  reset: number;
  flow: boolean;
};
export const paints = [
  { id: "gold", name: "都市金", hex: "#a49b80" },
  { id: "gray", name: "天际灰", hex: "#636d73" },
  { id: "cyan", name: "风尚青", hex: "#487a7c" },
  { id: "black", name: "前卫黑", hex: "#172126" },
  { id: "white", name: "摩登白", hex: "#e6e8e4" },
];
export const initialSettings: Settings = {
  color: "gold",
  lights: "drl",
  shell: "solid",
  explode: 0,
  auto: false,
  studio: "light",
  quality: "auto",
  view: "front45",
  reset: 0,
  flow: true,
};
export const views = [
  { id: "front45", name: "前 45°" },
  { id: "side", name: "正侧方" },
  { id: "rear45", name: "后 45°" },
  { id: "front", name: "正前方" },
  { id: "rear", name: "正后方" },
  { id: "top", name: "俯视" },
];
const positions: Record<string, number[]> = {
  front45: [7.5, 8.5, 3.7],
  side: [0, 11, 2.1],
  rear45: [-7.5, 8.5, 3.7],
  front: [11, 0, 2.2],
  rear: [-11, 0, 2.2],
  top: [0, 0.01, 12],
};
const partPositions: Record<string, number[]> = {
  battery: [-0.3, 0, 0.42],
  engine: [1.55, -0.32, 0.65],
  motor: [1.04, 0.46, 0.63],
  gear: [1.4, 0.05, 0.46],
  fuel: [-1.68, 0, 0.53],
  aux: [0.55, -0.65, 0.76],
};
const offsets: Record<string, number[]> = {
  battery: [-0.2, -1.15, 0.18],
  engine: [0.25, -0.35, 0.5],
  motor: [0, 0.7, 0.35],
  gear: [0.4, 0, 0.1],
  fuel: [-0.35, 0, 0.4],
  aux: [0, -0.5, 0.35],
};
const partColors: Record<string, number> = {
  battery: 0x41ad87,
  engine: 0xeeb65c,
  motor: 0x52a5cf,
  gear: 0xa3b6ba,
  fuel: 0xdba18b,
  aux: 0xab98cd,
};
const v = (p: number[]) => new T.Vector3(p[0], p[1], p[2]);
function disposeTree(root: T.Object3D) {
  const materials = new Set<T.Material>(),
    geometries = new Set<T.BufferGeometry>();
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      geometries.add(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
function studioEnvironment(renderer: T.WebGLRenderer) {
  // Authored floating-point radiance map: broad studio softboxes, no third-party HDR asset.
  const w = 256,
    h = 128,
    data = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x / w,
        t = y / h;
      let e = 0.16 + 0.23 * (1 - t);
      if (
        t > 0.18 &&
        t < 0.43 &&
        ((u > 0.12 && u < 0.28) || (u > 0.61 && u < 0.8))
      )
        e = 5.5;
      if (t > 0.06 && t < 0.12) e = 2.8;
      const i = (y * w + x) * 4;
      data[i] = e;
      data[i + 1] = e * 0.985;
      data[i + 2] = e * 0.95;
      data[i + 3] = 1;
    }
  const hdr = new T.DataTexture(data, w, h, T.RGBAFormat, T.FloatType);
  hdr.mapping = T.EquirectangularReflectionMapping;
  hdr.needsUpdate = true;
  const pmrem = new T.PMREMGenerator(renderer),
    target = pmrem.fromEquirectangular(hdr);
  hdr.dispose();
  pmrem.dispose();
  return target;
}

function buildParts() {
  const all = new T.Group();
  all.name = "educational-powertrain";
  const groups: Record<string, T.Group> = {};
  for (const [key, p] of Object.entries(partPositions)) {
    const g = new T.Group();
    g.name = key;
    g.position.copy(v(p));
    g.userData.part = key;
    const size =
      key === "battery"
        ? [1.65, 1.12, 0.15]
        : key === "engine"
          ? [0.55, 0.53, 0.49]
          : key === "fuel"
            ? [0.5, 0.68, 0.25]
            : [0.42, 0.32, 0.3];
    const mat = new T.MeshStandardMaterial({
      color: partColors[key],
      metalness: 0.45,
      roughness: 0.35,
    });
    const mesh = new T.Mesh(
      new T.BoxGeometry(...(size as [number, number, number])),
      mat,
    );
    mesh.castShadow = true;
    g.add(mesh);
    const edge = new T.LineSegments(
      new T.EdgesGeometry(mesh.geometry),
      new T.LineBasicMaterial({
        color: 0xe5fff3,
        transparent: true,
        opacity: 0.3,
      }),
    );
    g.add(edge);
    if (key === "battery") {
      for (let j = 0; j < 10; j++) {
        const cell = new T.Mesh(
          new T.BoxGeometry(0.12, 1.04, 0.025),
          new T.MeshStandardMaterial({
            color: 0x4fd8a3,
            metalness: 0.2,
            roughness: 0.4,
          }),
        );
        cell.position.set(-0.73 + j * 0.162, 0, 0.09);
        cell.userData.cell = j;
        g.add(cell);
      }
    }
    if (key === "engine")
      for (let j = 0; j < 4; j++) {
        const cap = new T.Mesh(
          new T.CylinderGeometry(0.045, 0.045, 0.42, 12),
          mat,
        );
        cap.rotation.x = Math.PI / 2;
        cap.position.set(-0.18 + j * 0.12, 0, 0.27);
        g.add(cap);
      }
    if (key === "motor") {
      const m = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.4, 24), mat);
      m.position.z = 0.05;
      g.add(m);
    }
    groups[key] = g;
    all.add(g);
  }
  return { all, groups };
}

class SceneEngine {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(33, 1, 0.05, 100);
  controls: OrbitControls;
  model?: T.Group;
  body?: T.Object3D;
  parts = buildParts();
  settings = { ...initialSettings };
  sample: Sample = {};
  request = 0;
  observer: ResizeObserver;
  disposed = false;
  environment: T.WebGLRenderTarget;
  floor: T.Mesh;
  key: T.DirectionalLight;
  paint?: T.MeshPhysicalMaterial;
  glass?: T.MeshPhysicalMaterial;
  lamps: Record<string, T.MeshStandardMaterial[]> = {};
  wheels: T.Object3D[] = [];
  flowGroups: {
    group: T.Group;
    arrow: T.Mesh;
    dot: T.Mesh;
    line: T.Mesh;
    from: string;
    to: string;
    power: string;
  }[] = [];
  started = performance.now();
  loadMs = 0;
  frames: number[] = [];
  last = 0;
  lastStats = 0;
  quality = "";
  adaptiveLow = false;
  loadToken = 0;
  selected = "";
  resize = () => {};
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  goal?: T.Vector3;
  constructor(
    public host: HTMLDivElement,
    public onReady: () => void,
    public onError: (s: string) => void,
    public onInteract: () => void,
    public onPick: (s: string) => void,
    public onStats: (s: string) => void,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "可旋转和缩放的 ID.ERA 5S 三维模型",
    );
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.tabIndex = 0;
    host.appendChild(this.renderer.domElement);
    this.camera.up.set(0, 0, 1);
    this.camera.position.copy(v(positions.front45));
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0.72);
    this.controls.enableDamping = !this.reduced;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 17;
    this.controls.minPolarAngle = 0.02;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.015;
    this.controls.enablePan = false;
    this.controls.autoRotateSpeed = 0.6;
    this.controls.addEventListener("start", () => {
      this.goal = undefined;
      this.controls.autoRotate = false;
      this.onInteract();
    });
    this.environment = studioEnvironment(this.renderer);
    this.scene.environment = this.environment.texture;
    this.key = new T.DirectionalLight(0xfff5df, 3.2);
    this.key.position.set(3, 5, 7);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.left = -4;
    this.key.shadow.camera.right = 4;
    this.key.shadow.camera.top = 4;
    this.key.shadow.camera.bottom = -4;
    this.key.shadow.bias = -0.0002;
    this.key.shadow.normalBias = 0.018;
    this.scene.add(this.key);
    this.scene.add(new T.HemisphereLight(0xe6f1ff, 0x535644, 1.4));
    const rim = new T.DirectionalLight(0xe8f3ff, 2.1);
    rim.position.set(-4, -5, 4);
    this.scene.add(rim);
    this.floor = new T.Mesh(
      new T.CircleGeometry(90, 80),
      new T.ShadowMaterial({ color: 0x354438, opacity: 0.18 }),
    );
    this.floor.position.z = -0.012;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.scene.add(this.parts.all);
    for (const [from, to, power] of [
      ["fuel", "engine", "Fuel_W"],
      ["engine", "gear", "Engine_W"],
      ["battery", "motor", "MotorElectrical_W"],
      ["motor", "gear", "Motor_W"],
      ["battery", "aux", "Aux_W"],
      ["gear", "wheel_FL", "AxleHalf_W"],
      ["gear", "wheel_FR", "AxleHalf_W"],
    ]) {
      const group = new T.Group();
      const mat = new T.MeshBasicMaterial({
        color: 0x209c77,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      });
      const line = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 1, 6), mat);
      const arrow = new T.Mesh(new T.ConeGeometry(0.052, 0.13, 10), mat);
      const dot = new T.Mesh(new T.SphereGeometry(0.036, 8, 6), mat);
      group.add(line, arrow, dot);
      group.renderOrder = 8;
      this.scene.add(group);
      this.flowGroups.push({ group, arrow, dot, line, from, to, power });
    }
    let downX = 0,
      downY = 0;
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });
    canvas.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const r = canvas.getBoundingClientRect(),
        ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        this.camera,
      );
      const hits = ray
        .intersectObjects(this.parts.all.children, true)
        .filter((hit) => hit.object instanceof T.Mesh);
      if (hits[0] && this.settings.shell !== "solid") {
        let obj: T.Object3D | null = hits[0].object;
        while (obj && !obj.userData.part) obj = obj.parent;
        if (obj) this.onPick(obj.userData.part);
      }
    });
    canvas.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        this.controls.autoRotate = false;
        this.onInteract();
        const d = this.camera.position.clone().sub(this.controls.target);
        d.applyAxisAngle(
          new T.Vector3(0, 0, 1),
          e.key === "ArrowLeft" ? 0.12 : -0.12,
        );
        this.camera.position.copy(this.controls.target).add(d);
        e.preventDefault();
      }
      if (e.key === "+" || e.key === "-") {
        const d = this.camera.position
          .clone()
          .sub(this.controls.target)
          .multiplyScalar(e.key === "+" ? 0.9 : 1.1);
        d.clampLength(6, 17);
        this.camera.position.copy(this.controls.target).add(d);
        e.preventDefault();
      }
    });
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.onError("WebGL 上下文已丢失，请刷新页面恢复。");
    });
    this.resize = () => {
      const { width, height } = host.getBoundingClientRect();
      this.renderer.setSize(width, Math.max(1, height));
      this.camera.aspect = width / Math.max(1, height);
      this.camera.fov = Math.max(18, Math.min(43, 33 / this.camera.aspect));
      this.camera.updateProjectionMatrix();
      if (this.model && this.settings.quality === "auto") this.load("auto");
    };
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
    this.tick(0);
    (window as unknown as { __energyLab: SceneEngine }).__energyLab = this;
  }
  async load(quality: string) {
    const target =
      quality === "auto"
        ? innerWidth < 700 || this.adaptiveLow
          ? "low"
          : "standard"
        : quality;
    if (this.quality === target) return;
    this.quality = target;
    const token = ++this.loadToken,
      t0 = performance.now();
    try {
      const gltf = await new GLTFLoader().loadAsync(
        `${import.meta.env.BASE_URL}models/vehicle-${target}.glb`,
      );
      if (this.disposed || token !== this.loadToken) {
        disposeTree(gltf.scene);
        return;
      }
      if (this.model) {
        this.scene.remove(this.model);
        disposeTree(this.model);
      }
      this.model = gltf.scene;
      this.body = this.model.getObjectByName("body");
      this.wheels = ["FL", "FR", "RL", "RR"]
        .map((s) => this.model!.getObjectByName("wheel_" + s))
        .filter(Boolean) as T.Object3D[];
      this.lamps = {};
      this.paint = new T.MeshPhysicalMaterial({
        name: "paint",
        color: 0xa49b80,
        metalness: 0.72,
        roughness: 0.26,
        clearcoat: 1,
        clearcoatRoughness: 0.16,
        envMapIntensity: 1,
      });
      this.glass = new T.MeshPhysicalMaterial({
        name: "glass",
        color: 0x172b30,
        metalness: 0.06,
        roughness: 0.18,
        clearcoat: 0.35,
        ior: 1.52,
        transparent: true,
        opacity: 0.97,
        depthWrite: false,
        envMapIntensity: 0.48,
      });
      const originals = new Set<T.Material>();
      this.model.traverse((o) => {
        if (o instanceof T.Mesh) {
          const m = o.material as T.MeshStandardMaterial;
          const name = m.name.toLowerCase();
          o.castShadow = true;
          o.receiveShadow = true;
          if (name === "paint") {
            originals.add(m);
            o.material = this.paint!;
          } else if (name === "glass") {
            originals.add(m);
            o.material = this.glass!;
          } else if (
            ["drl", "headlamp", "taillamp", "brakelamp"].includes(name)
          ) {
            if (!this.lamps[name]) this.lamps[name] = [];
            this.lamps[name].push(m);
            m.emissiveIntensity = 0;
          }
          o.userData.originalOpacity = (o.material as T.Material).opacity;
        }
      });
      originals.forEach((m) => m.dispose());
      this.scene.add(this.model);
      this.loadMs = performance.now() - t0;
      this.apply(this.settings, true);
      this.updateSample(this.sample);
      this.onReady();
    } catch (e) {
      if (!this.disposed) this.onError("车辆模型加载失败：" + String(e));
    }
  }
  apply(s: Settings, force = false) {
    const previous = this.settings;
    this.settings = { ...s };
    this.load(s.quality);
    this.controls.autoRotate = s.auto && !this.reduced;
    if (s.view !== previous.view || s.reset !== previous.reset || force) {
      const pos = v(positions[s.view] || positions.front45);
      if (this.reduced || force) {
        this.camera.position.copy(pos);
        this.goal = undefined;
      } else this.goal = pos;
    }
    if (this.paint) {
      this.paint.color.set(
        paints.find((c) => c.id === s.color)?.hex || paints[0].hex,
      );
      this.paint.roughness = s.color === "black" ? 0.23 : 0.27;
    }
    const dark = s.studio === "dark";
    this.scene.background = new T.Color(dark ? 0x182421 : 0xe9ede7);
    (this.floor.material as T.ShadowMaterial).opacity = dark ? 0.3 : 0.18;
    this.scene.environmentIntensity = dark ? 0.75 : 1;
    this.renderer.toneMappingExposure = dark ? 0.95 : 1.1;
    if (this.body) {
      this.body.visible = s.shell !== "hidden";
      this.body.position.z = s.explode * 0.9;
      this.body.traverse((o) => {
        if (o instanceof T.Mesh) {
          const m = o.material as T.MeshStandardMaterial;
          const transparent = s.shell === "transparent" || m === this.glass;
          if (m.transparent !== transparent) {
            m.transparent = transparent;
            m.needsUpdate = true;
          }
          m.opacity =
            s.shell === "transparent"
              ? m === this.glass
                ? 0.12
                : 0.16
              : (o.userData.originalOpacity ?? 1);
          m.depthWrite = s.shell !== "transparent" && m !== this.glass;
        }
      });
    }
    for (const [id, g] of Object.entries(this.parts.groups)) {
      g.position
        .copy(v(partPositions[id]))
        .addScaledVector(v(offsets[id]), s.explode);
    }
    this.parts.all.visible = s.shell !== "solid" || s.explode > 0;
    this.updateLights();
  }
  updateLights() {
    let mode = this.settings.lights;
    if (mode === "auto")
      mode = (this.sample.Demand_W ?? 0) < -1000 ? "brake" : "drl";
    for (const [name, mats] of Object.entries(this.lamps)) {
      const active =
        (name === "drl" && (mode === "drl" || mode === "head")) ||
        (name === "headlamp" && mode === "head") ||
        (name === "taillamp" &&
          (mode === "tail" || mode === "brake" || mode === "head")) ||
        (name === "brakelamp" && mode === "brake");
      for (const m of mats) {
        m.emissive.setHex(
          name === "taillamp" || name === "brakelamp" ? 0xff2518 : 0xd7edff,
        );
        m.emissiveIntensity = active ? (name === "brakelamp" ? 3 : 1.5) : 0;
      }
    }
  }
  updateSample(sample: Sample) {
    this.sample = {
      ...sample,
      MotorElectrical_W: (sample.Motor_W ?? 0) + (sample.MotorLoss_W ?? 0),
      // Remove friction braking before visualizing the mechanical path to the motor.
      AxleHalf_W: ((sample.Wheel_W ?? 0) + (sample.Friction_W ?? 0)) / 2,
    };
    this.updateLights();
    const angle = (-(sample.Distance_km ?? 0) * 1000) / 0.33965;
    for (const w of this.wheels) w.rotation.y = angle;
    const soc = sample.SOC ?? 0.8;
    this.parts.groups.battery.children.forEach((o) => {
      if (o instanceof T.Mesh && o.userData.cell !== undefined) {
        (o.material as T.MeshStandardMaterial).color.setHex(
          o.userData.cell < soc * 10
            ? soc < 0.25
              ? 0xe4a343
              : 0x4fd8a3
            : 0x344a43,
        );
      }
    });
  }
  snapshot() {
    const sorted = [...this.frames].sort((a, b) => a - b),
      median = sorted[Math.floor(sorted.length / 2)] || 0;
    const info = this.renderer.info,
      gl = this.renderer.getContext(),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      ready: !!this.model,
      quality: this.quality,
      loadMs: this.loadMs,
      frameMsMedian: median,
      fps: median ? 1000 / median : 0,
      frameCount: this.frames.length,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length,
      camera: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      auto: this.controls.autoRotate,
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      canvas: [this.renderer.domElement.width, this.renderer.domElement.height],
      dpr: this.renderer.getPixelRatio(),
      settings: this.settings,
      wheels: this.wheels.map((w) => w.rotation.y),
      flows: this.flowGroups.map((f) => ({
        from: f.from,
        to: f.to,
        power: this.sample[f.power],
        visible: f.group.visible,
      })),
      heap: (performance as unknown as { memory?: { usedJSHeapSize: number } })
        .memory?.usedJSHeapSize,
    };
  }
  tick = (time: number) => {
    if (this.disposed) return;
    this.request = requestAnimationFrame(this.tick);
    if (document.hidden) {
      this.last = 0;
      return;
    }
    if (this.last && time - this.last < 15.7) return;
    if (this.last && time > this.last) {
      this.frames.push(time - this.last);
      if (this.frames.length > 360) this.frames.shift();
    }
    this.last = time;
    if (this.goal) {
      this.camera.position.lerp(this.goal, 0.085);
      if (this.camera.position.distanceTo(this.goal) < 0.005) {
        this.camera.position.copy(this.goal);
        this.goal = undefined;
      }
    }
    this.controls.update();
    for (const f of this.flowGroups) {
      const p = this.sample[f.power] ?? 0;
      f.group.visible =
        this.parts.all.visible && this.settings.flow && Math.abs(p) > 20;
      if (!f.group.visible) continue;
      const fromObject = this.parts.groups[f.from] || this.model?.getObjectByName(f.from);
      const toObject = this.parts.groups[f.to] || this.model?.getObjectByName(f.to);
      if (!fromObject || !toObject) { f.group.visible = false; continue; }
      let a = fromObject.getWorldPosition(new T.Vector3()),
        b = toObject.getWorldPosition(new T.Vector3());
      a.z += 0.2;
      b.z += 0.2;
      if (p < 0) [a, b] = [b, a];
      const d = b.clone().sub(a),
        len = d.length(),
        q = new T.Quaternion().setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          d.clone().normalize(),
        );
      f.line.position.copy(a).lerp(b, 0.5);
      f.line.scale.y = len;
      f.line.quaternion.copy(q);
      f.arrow.position.copy(a).lerp(b, 0.68);
      f.arrow.quaternion.copy(q);
      f.dot.position.copy(a).lerp(b, this.reduced ? 0.35 : (time * 0.0007) % 1);
      (f.line.material as T.MeshBasicMaterial).color.setHex(
        p < 0
          ? 0x35aace
          : f.from === "fuel" || f.from === "engine"
            ? 0xd9922a
            : 0x15996d,
      );
    }
    this.renderer.render(this.scene, this.camera);
    if (time - this.lastStats > 1500 && this.model) {
      this.lastStats = time;
      const s = this.snapshot();
      if (
        time > 15000 &&
        s.fps < 28 &&
        this.settings.quality === "auto" &&
        this.quality !== "low"
      ) {
        this.adaptiveLow = true;
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
        this.resize();
      }
      this.onStats(
        `${Math.round(s.fps)} FPS · ${(s.triangles / 1000).toFixed(0)}k tris`,
      );
    }
  };
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.request);
    this.observer.disconnect();
    this.controls.dispose();
    this.environment.dispose();
    disposeTree(this.scene);
    this.scene.traverse((o) => {
      if (o instanceof T.LineSegments) {
        o.geometry.dispose();
        (o.material as T.Material).dispose();
      }
    });
    this.key.shadow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.host.replaceChildren();
  }
}

export function VehicleScene({
  settings,
  sample,
  onInteract,
  onPick,
  lab = false,
}: {
  settings: Settings;
  sample: Sample;
  onInteract: () => void;
  onPick: (s: string) => void;
  lab?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    engine = useRef<SceneEngine | undefined>(undefined),
    callbacks = useRef({ onInteract, onPick });
  callbacks.current = { onInteract, onPick };
  const [status, setStatus] = useState("loading"),
    [error, setError] = useState(""),
    [stats, setStats] = useState("");
  useEffect(() => {
    try {
      engine.current = new SceneEngine(
        ref.current!,
        () => setStatus("ready"),
        (m) => {
          setError(m);
          setStatus("error");
        },
        () => callbacks.current.onInteract(),
        (s) => callbacks.current.onPick(s),
        setStats,
      );
      engine.current.apply(settings);
      engine.current.updateSample(sample);
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
    return () => engine.current?.dispose();
  }, []);
  useEffect(() => engine.current?.apply(settings), [settings]);
  useEffect(() => engine.current?.updateSample(sample), [sample]);
  return (
    <div
      className={"vehicle-stage " + (lab ? "lab-stage" : "hero-stage")}
      data-testid="vehicle-stage"
    >
      <div ref={ref} className="canvas-host" />
      {status === "loading" && (
        <div className="scene-status" role="status">
          <LoaderCircle className="spin" /> 正在加载车辆模型
        </div>
      )}
      {status === "error" && (
        <div className="scene-status error" role="alert">
          <AlertTriangle />
          {error}
          <button onClick={() => location.reload()}>重新加载</button>
        </div>
      )}
      <span className="scene-caption">
        <Rotate3D size={15} /> 拖动旋转 · 滚轮 / 双指缩放
      </span>
      <span className="scene-stats" data-testid="render-stats">
        {stats}
      </span>
    </div>
  );
}
