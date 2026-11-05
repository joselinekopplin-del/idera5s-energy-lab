# 线上部署验收

2026-11-05 已实际发布并验证 [ID.ERA 5S Energy Lab](https://joselinekopplin-del.github.io/idera5s-energy-lab/)。

- 应用源码提交：`59de126468df22e1bdff15d29208356ae98a65c0`。
- [GitHub Actions 运行](https://github.com/joselinekopplin-del/idera5s-energy-lab/actions/runs/41987631687)：build 与 deploy 均成功。
- CI：锁定依赖安装、TypeScript、Vite构建与数据/模型验证成功；8项单元测试通过、0失败，1项原始MATLAB文件逐值对照因独立仓库不公开原文件而明确跳过。该项已在本地完成；本机9项均通过。
- [机器可读HTTPS验收](deployment-verification.json)来自实际访问公开网址的 Edge 156，不是本地服务器替代测试。

线上实际通过：主页HTTP200与HTTPS、真实GLB和硬件WebGL、鼠标旋转/滚轮/颜色/视角、JSON完整性校验、冬季动力缺口提示、回放/图表、四策略对比、全部hash页面刷新、主题切换、手机视口轻量LOD与触控选色。未收集到页面异常或资源HTTP错误。

一次新的浏览器上下文中，导航至模型可用为4261.6ms，标准模型加载器628.4ms。属于本次网络条件下的观测，不是所有网络的加载时间承诺。最终记录的resource列表来自后续刷新，transferBytes=0表示缓存，不应误读为模型无需下载。

线上手机检查是同一台电脑的390×844触控仿真，并非实机手机性能测试。完整功能与长期性能分别记录在其它验收文件中。

仓库仅含网站子项目、原创模型及公开展示数据，不包含原始媒体照片、MAT文件、整个MATLAB工程或账户凭据。网站始终将回放与在线求解区分，并明确独立教学研究属性。
