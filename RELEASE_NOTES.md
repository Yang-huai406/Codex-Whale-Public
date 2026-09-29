# API 余额小鲸鱼 v0.3(fixed)

**For-Codex 分支发布，标签 `codex-v0.3.0-fixed.2`。** 本次按维护者授权发布；内部构建为 `0.3.0+codex.20260929173027`。协作者 [Yang-huai406](https://github.com/Yang-huai406) 维护 Codex 适配，仓库所有者仍为 [MeteorNOX](https://github.com/MeteorNOX)。

## 修复内容

- 气泡收起不再提前被 Windows 原生窗口区域裁切；文字、主泡泡及小尾泡按完整动画淡出。快速关开不受旧结束回调影响。
- 鼠标从人物经过透明缝隙移向菜单按钮时，按钮保持可达；透明范围只保留悬停显示，仍让底层软件接收点击。
- 保留条件式窗口层级纠正、Ctrl+Alt+Shift+F10 静默诊断，以及 Windows 鼠标移动不转发和软件合成兼容措施。
- 明确失败或意外中断也显示中性消耗提示；不把未知/待记账金额当零，不播放成功音效，重试中不提前结算。

## 关于 Issue #177

[点击组件外空白关闭菜单、人物气泡和账户卡片](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/177) 是合理的便利性建议。本版最终撤回新增的全局空白点击关闭：挂件覆盖其他软件，宿主正常点击可能误清尚未阅读的人物、任务和消耗提示；“二级菜单”的范围也容易造成理解差异。保持点击穿透的同时监听外部点击，还会增加跨平台事件处理和排查成本。

当前沿用已有控件内关闭、人物点击和提示超时规则。这是交互取舍，不表示技术不可实现，不代表 Issue 已被关闭。详见 [决定说明](docs/OUTSIDE-CLICK-DECISION.md)。

## 保留功能与来源

B 版概览/用量/设置、API/订阅模式、角色和气泡、音效与手感、本地创意工坊、桌面/跟随切换、余额与 token 统计、官方端点适用时的 DeepSeek 峰谷均保留。

保留 [macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128) 的平台代码、来源和贡献者署名；不以旧整包覆盖当前修复。

## 验证和限制

238 项单元测试通过；16 次 Windows 原生区域采样覆盖关闭与快速重开，慢/快悬停及原生点击穿透、当前 B 版 Electron 界面审计通过。最新成品解压验证和哈希见随附 `verification-report.json`、`release-manifest.json`。

长期偶发显示稳定性、其他设备、Mac 实机及真实订阅账号端到端仍待验证；发布授权不等于这些场景已全部验收。专项置顶隔离窗口测试用于动画裁剪，不证明日常跟随层级始终正确。旧版布局脚本的既有断言不适配 B 版，具体范围见 [验证记录](docs/VERIFICATION-0.3.md)。

## 安装附件

- `api-balance-whale-v0.3(fixed).zip`：完整解压后安装的插件包。
- `api-balance-whale-v0.3(fixed)-source.zip`：源码、测试、README 和 GitHub 准备材料。
- 两份 `.sha256`、`release-manifest.json`、`verification-report.json`：校验及验证摘要。

Windows 完整解压后运行“安装插件.cmd”；需要 Node.js 24+（含 npm）、支持插件的 Codex 及首次下载 Electron 的网络。此包不是包含运行时的离线 EXE。Mac 安装范围、Swift 工具与未验证限制见 [平台说明](docs/MACOS.md)。安装和按本次私有回执回滚见 [README](README.md)。

公开包不包含个人凭据、配置、账本、日志、截图、录屏、回滚回执或 Git 历史。公开署名、第三方许可和兼容来源保留。本次使用新标签 `codex-v0.3.0-fixed.2`，不覆盖既有 `codex-v0.3.0-fixed` tag，不变更主线 Latest。
