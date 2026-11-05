# ID.ERA 5S | Energy Lab

**Interactive Vehicle Energy Management Simulator**

**在线演示：[ID.ERA 5S Energy Lab](https://joselinekopplin-del.github.io/idera5s-energy-lab/)**

2026-11-05 已完成 GitHub Actions 发布与 HTTPS 实测。模型、数据回放、策略曲线、手机布局和四个页面刷新通过，未出现资源HTTP错误或页面运行异常。验收见 [线上部署记录](docs/deployment.md)、[浏览器功能测试](docs/browser-validation.md) 和 [性能实测](docs/performance.md)。

React + TypeScript + Vite + Three.js 构建的独立汽车能源管理研究平台。包含可旋转的原创 Neo 三维近似、五种车漆、摄影棚材质、部件拆解、真实 MATLAB 保存结果回放和四策略对比。界面采用统一 Material Design 3 风格的颜色、排版、状态、导航和明暗主题。

这是**离线结果的浏览器回放**，不是在线 MATLAB 求解器。全部 16 工况 × 4 策略、64 组正式结果及其中 3 组动力不可行结果均保留。参考速度和参考里程不代表动力不足时车辆实际达到的运动轨迹。

## 本地运行

需要 Node.js 24 和 pnpm 11.25.0；仓库已提交锁文件和公开数据，不需要先安装 MATLAB，也不需要重新生成模型。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开开发终端显示的地址，默认是 `http://127.0.0.1:5173/idera5s-energy-lab/`。如机器未装 pnpm，可通过 `npx pnpm@11.25.0` 代替上述命令中的 `pnpm`。

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

预览构建默认地址为 `http://127.0.0.1:4173/idera5s-energy-lab/`。不要双击 `dist/index.html` 用 `file://` 打开，浏览器无法按该方式正常加载模块、GLB 和 JSON。

## 使用说明

1. **车辆概览**：鼠标拖动旋转、滚轮缩放；触屏单指旋转、双指缩放。支持六个预设视角、自动旋转、五种近似车漆、五种灯光和明暗摄影棚。操作模型会暂停自动旋转。键盘聚焦模型后可用左右方向键和 `+` / `−`。
2. **能量实验室**：左侧选择已保存工况与策略，播放条控制时间和 1–20 倍速。右侧显示当前采样的参考车速、SOC、功率、燃油和参考里程；点击图表统一定位时间。
3. **部件与能量流**：切换透视或隐藏车身，拖动拆解滑块；点击部件或部件按钮查看模型计算值。负电机功率代表发电，制动回收时能量流反向。内部部件位置是教学示意。
4. **策略分析**：同一工况加载四组结果，查看 SOC、燃油、净耗电、功率和回收曲线，以及启动次数、最终 SOC、动力缺口。燃油量必须结合电池消耗及最终 SOC 比较。
5. **模型说明**：阅读数据和几何的来源、SHA-256 追溯信息与研究边界。页顶可选择浅色、深色或跟随系统主题，界面遵循减少动态效果偏好。

网页没有“修改车辆参数后重新计算”的按钮，因为第一版未实现在线求解。当前运行模式、温度、转速与效率来自模型结果，不是实车传感器数据。

## 工程结构

```text
src/App.tsx                 页面、导航、回放和 Material 3 控件
src/3d/VehicleScene.tsx      WebGL / PBR、相机、拆解、功率流
src/charts/TimeChart.tsx     统一游标的交互时间图
src/data/                   类型、按需加载、结果摘要校验
public/models/              原创 GLB 三档 LOD 与模型清单
public/data/                64 组正式结果的公开 JSON 与目录
scripts/export-data.mjs     只读 MATLAB CSV / MAT 的数据导出
scripts/generate-models.mjs 可复现的原创几何与 GLB 导出
tests/                      数据完整性和浏览器交互验收
.github/workflows/pages.yml GitHub Actions 构建与 Pages 发布
docs/                       数据、模型和验证说明
```

## 数据更新

本仓库只公开展示所需 JSON，不包含完整 MATLAB 工程或 MAT 文件。在 MATLAB 原工程的 `web/` 子目录执行 `pnpm export:data`，或指定原工程目录：

```sh
node scripts/export-data.mjs --source "<MATLAB 项目根目录>"
pnpm test
pnpm build
```

导出程序读取 64 个 CSV、64 个 MAT、正式汇总和科学计算源码的摘要；不会运行 MATLAB，不会改写源数据。数值来自保存的 CSV，每个数字保留原始序列化精度，不平滑或重算。`NaN` 使用 JSON `null`。结果按工况策略懒加载，客户端最多缓存四组。

完整字段、符号、数据版本与可行性说明见 [数据来源说明](docs/data-provenance.md)。下载链接中的 `source.csv`、`source.mat` 是来源标记，不是公开源文件地址。

## 三维模型更新

```sh
pnpm export:models
pnpm test
pnpm build
```

三个 GLB 是同一原创模型的高清、标准和轻量档，材质名与部件节点名是场景的接口，修改时应保留 `body`、四个 `wheel_*` 节点以及 `paint`、`glass`、`drl`、`headlamp`、`taillamp`、`brakelamp` 材质名。生成脚本会写入文件大小、三角面数、尺寸、法线检查与 SHA-256 清单。

坐标单位为米，X 向前、Y 向左、Z 向上。名义尺寸 4.836 × 1.880 × 1.505 m，轴距 2.766 m；宽度不含外后视镜。轮组采用 Neo 的 225/55 R17 视觉参考。外壳和细节仍是照片约束下的视觉重建，不是厂商 CAD。

默认窄屏选择轻量 LOD，桌面选择标准 LOD，可手动更改。摄影棚环境为原创浮点辐射图与 PMREM 反射，没有随仓库发布第三方 HDR 图像。中央灯带和 VW 标识保持非主动发光，避免用未核实高配功能替代 Neo。

## 浏览器与性能验收

Windows 本地测试默认使用已安装的 Microsoft Edge，保留硬件 WebGL；其他平台与 CI 使用 Playwright Chromium。第一次运行安装浏览器辅助程序：

```sh
pnpm exec playwright install chromium ffmpeg
pnpm test:browser
```

已有 Edge 时只需 `pnpm exec playwright install ffmpeg`。测试会启动或复用 5173 端口的开发服务。`PLAYWRIGHT_BASE_URL` 可指定已经运行的构建预览或线上 HTTPS 地址；指定后测试不会启动本地服务。`PLAYWRIGHT_CHANNEL` 可选择 `msedge`、`chrome` 等本机通道。

测试使用真实鼠标拖动、滚轮、键盘、CDP 触控及双指手势，读取 `window.__energyLab.snapshot()` 和场景属性作为只读观测。不会用直接调用场景函数替代用户交互。覆盖灯光/车漆/视角/主题/LOD、透明与隐藏/拆解/部件射线选择、回放和回收方向、三组不可行结果、策略图、移动布局和刷新。

默认快速验收跳过 120 秒持续回放测量。Windows PowerShell 显式运行：

```powershell
$env:ENERGY_PERF = '1'
pnpm test:browser --grep 'long saved-result'
Remove-Item Env:ENERGY_PERF
```

输出保存在被 Git 忽略的 `test-results/` 和 `playwright-report/`。JSON 附件记录渲染器、实际分辨率、模型首次加载耗时、rAF 帧率、Three.js 几何/纹理/程序数量和 JS 堆估值。GPU 对象数不等于显存字节，浏览器 rAF FPS 不等于独立 GPU 时间。移动端测试是触控与布局仿真，不能代替真实手机性能测量。CI 软件渲染结果也不能用作用户硬件性能结论。

桌面 50–60 FPS、普通笔记本至少 30 FPS 是目标；是否达到以具体设备和实测报告为准。有限时长的资源稳定性检查只能排查观察窗口内的持续增长，不能证明不存在所有内存泄漏。

本机完整功能基线为 15 项通过、0 失败、0 跳过（使用 `--grep-invert 'long saved-result'` 明确排除独立性能用例）。最终补齐两前轮能量流后，又定向复测了既有制动回收与LOD资源循环两项，均通过；独立功能用例仍为15项。详见 [浏览器功能验收](docs/browser-validation.md) 及 [机器可读证据](docs/browser-validation.json)。其中核对了暂停切LOD的车轮状态、停机/待机/发动机充电语义、由保存燃油量差分得到的L/h，以及两前轮等分功率和正反向箭头。持续性能与线上发布应另外验证，不能把功能通过数当作性能或实车外观精度结论。

## GitHub Pages 发布

只把本 `web/` 内容作为独立仓库根目录，不上传上一级 MATLAB 项目、原始照片、临时文件或凭据。建议仓库名 `idera5s-energy-lab`，`vite.config.ts` 已设置 `base: '/idera5s-energy-lab/'`，路由使用 `#/lab` 等 hash 地址，因此刷新不需要服务器路由。

首次在仓库 **Settings → Pages → Build and deployment** 中将 Source 设为 **GitHub Actions**。把已验证的源码提交到 `main` 后，工作流执行：锁定依赖安装、TypeScript 检查、数据/模型测试、Vite 构建、官方 Pages Artifact 上传与部署。只有 `dist/` 进入 Pages 发布包；PR 运行检查但不发布。

工作流手动运行时可勾选 `run_browser` 添加 Chromium 交互测试。无需为静态站点配置 API Key、PAT 或外部 MATLAB 服务，部署使用 GitHub 自动提供的最小权限令牌。

部署后的地址格式为 `https://<GitHub账号>.github.io/idera5s-energy-lab/`。必须以 Actions 部署成功并实际检查首页、GLB、JSON、手机布局和 hash 刷新为准；仅写入工作流不代表已经上线。若改仓库名或使用根域名，需要同步调整 Vite `base` 与测试默认路径。

## 常见问题

| 现象 | 处理 |
|---|---|
| 白屏或模型/数据 404 | 核对发布子路径、Vite base 和服务器地址；不要用 file:// 打开。 |
| 首次长途工况加载较慢 | 单个完整结果约 7 MB，等待加载提示；其它结果不在首屏一起下载。 |
| JSON 校验失败 | 刷新数据目录与结果，确认它们来自同一次导出，不要手动改写数值。 |
| WebGL 上下文丢失 | 刷新页面，关闭占用过多 GPU 的应用，改用轻量画质；记录浏览器/显卡和重现步骤。 |
| 透明车身回放较慢 | 切回实体车身或轻量 LOD，减小窗口像素尺寸。 |
| 无法自动旋转 | 检查系统“减少动态效果”偏好，手动操作后旋转也会暂停。 |
| 参考车速仍显示但存在缺口 | 这是逆向规定工况模型的预设速度，不能当作已实现车速；查看动力缺口和可行性标记。 |
| CI 跳过本地 CSV 哈希测试 | 独立仓库有意不公开 MATLAB 源 CSV/MAT，仍运行公开 JSON 摘要和一致性检查。 |

原创代码与程序化几何采用 [MIT 许可](LICENSE)。第三方组件、车辆标识与参考资料边界见 [NOTICE](NOTICE.md)。

本项目为独立的汽车能源管理教学与研究可视化平台。车辆外观与性能模型基于公开资料及工程假设，不代表上汽大众官方技术数据或实车性能保证。
