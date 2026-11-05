# 来源、许可与研究边界

本项目为独立的汽车能源管理教学与研究可视化平台。车辆外观与性能模型基于公开资料及工程假设，不代表上汽大众官方技术数据或实车性能保证。

## 项目原创内容

- 原创 React / TypeScript 界面、数据转换程序、测试和程序化几何源代码采用仓库根目录 MIT 许可。
- `public/models/vehicle-*.glb` 是由本项目 `scripts/generate-models.mjs` 独立生成的视觉近似，未使用厂商 CAD、第三方扫描网格或付费模型。原始参考照片不随本仓库公开。
- 摄影棚浮点环境由代码生成，没有使用第三方 HDR 照片。程序化材质没有外部贴图依赖。
- `public/data/` 是原 MATLAB 工程保存的合成驾驶工况研究结果，不是实车遥测或厂商认证数据。来源与摘要见 [数据说明](docs/data-provenance.md)。

大众、Volkswagen、VW、ID.ERA 及相关标识属于各自权利人，仅用于识别研究对象。项目 MIT 许可不授予第三方商标、媒体照片、厂商 CAD 或其他第三方材料的使用权，也不表示权利人对本项目认可或背书。

## 外观参考页面

- [上汽大众车型资料](https://www.svw-volkswagen.com/idera5s/)
- [汽车之家 2026 款 Neo 实车图库](https://www.autohome.com.cn/cars/imglist-x-x-8651-78803-1-x-x-x-x-1.html)
- [车质网车型与配置对比资料](https://www.12365auto.com/xcdg/20260926/576354.shtml)

引用页面仅作为本地建模依据，不代表取得了图片的再分发许可。公开模型清单保存来源 URL 与照片编号，不包含原始图片。

## 主要第三方组件

下列组件保留各自许可。完整依赖版本以 `pnpm-lock.yaml` 为准，许可证随安装包提供。

浏览器运行时依赖（含 Scheduler）的完整许可文本随静态部署一并提供：[THIRD_PARTY_LICENSES.txt](public/licenses/THIRD_PARTY_LICENSES.txt)。

| 组件 | 用途 | 许可 |
|---|---|---|
| React / React DOM | 界面与状态 | MIT |
| Three.js | WebGL、材质、OrbitControls、GLTFLoader | MIT |
| Lucide React | 矢量图标 | ISC |
| Vite | 开发与静态构建 | MIT |
| TypeScript | 类型检查 | Apache-2.0 |
| Playwright | 浏览器交互验收 | Apache-2.0 |
| glTF Transform | 原创模型导出 | MIT |

Material Design 3 用作设计规范参考，项目没有宣称获得 Google 的设计认证。MATLAB、Simulink 属于 MathWorks 商标；网页不分发 MATLAB 运行时，也不能在 GitHub Pages 上直接运行 MATLAB 求解器。
