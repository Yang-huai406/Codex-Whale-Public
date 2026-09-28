# API 余额小鲸鱼 · Codex v0.3.0

**For-Codex 分支发布，标签 codex-v0.3.0。由仓库协作者 Yang-huai406 发布，仓库所有者仍为 MeteorNOX。**

维护者：[Yang-huai406](https://github.com/Yang-huai406)。保留上游版权与 [macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128) 的代码、链接和贡献者署名。

## 本版内容

- B 版“概览 / 用量 / 设置”分页，保留角色、素材、气泡、音效、账本、预警、预算和高级 API 设置。
- 顶部切换 API 余额 / Codex 订阅，保留菜单及当前页，不改变登录或连接配置。
- 订阅模式报告本轮 token，分别显示 5 小时与每周额度快照、重置时间和过期状态；无快照时显示未观测。
- 跟随 Codex / 独立桌面模式，默认右下角，位置记忆与重置。
- 三种按压手感、原创合成短音、独立事件音量；本地 JSON 创意工坊导入、预览、导出及失败回滚。
- DeepSeek 峰谷仅对识别出的官方 API 端点展示。

## 显示与输入修复

分离监督器心跳延迟与窗口隐藏；处理模式切换、旧坐标写回、加载竞争、销毁后 IPC 和缺失素材。Windows 原生区域排除透明空白，dialog/mask 只在实际卡片内接收鼠标。Windows 挂件默认软件合成，作为透明表面偶发不显示的兼容措施，不改变 Codex 本体，不增加周期性重启或重绘。

## 验证与限制

当前运行代码通过 223 项自动测试、真实 Electron 界面回归、16 次模式切换及不抬高窗口的 12 次实际屏幕像素采样。详见 [验证记录](docs/VERIFICATION-0.3.md)。

**偶发消失、白块及光标问题仍待日常使用验收，短时测试不代表彻底解决。** Mac 实机和真实订阅账号端到端验证尚未完成。官方额度百分比不能换算成固定剩余 token。本地工坊不是在线市场；桌面模式不含 CC Switch 路由或壁纸层嵌入。

## 附件

- `api-balance-whale-v0.3.0.zip`：可解压安装的插件包。
- `api-balance-whale-v0.3.0-source.zip`：源码、测试和 GitHub 文档材料。
- 对应 `.sha256`、`release-manifest.json`：校验值、内容清单、候选状态。

Windows 完整解压后双击“安装插件.cmd”。需要 Codex、Node.js 24+（含 npm）与可联网下载 Electron 的环境；这不是包含运行时的离线 EXE。Mac 安装范围见 [平台说明](docs/MACOS.md)。安装与回滚见 [README](README.md)。

展示版本 v0.3.0；保留当前已测试的内部构建号，具体值见清单。本次使用独立标签 `codex-v0.3.0`，不覆盖已用于主线的 `v0.3.0` 标签，也不替换主线 Latest 标记。
