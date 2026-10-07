# Codex-v0.4(fixixed)

**最新稳定修复版发行说明。** 对外名称精确为 `Codex-v0.4(fixixed)`，发行标签为 [`codex-v0.4.0(fixixed)`](https://github.com/Yang-huai406/Codex-Whale-Public/releases/tag/codex-v0.4.0%28fixixed%29)；`fixixed` 是本次约定拼写。内部版本仍为 `0.4.1`，构建标识为 `surface-audio-fix-20261007`。

当前维护仓库为 [Yang-huai406/Codex-Whale-Public](https://github.com/Yang-huai406/Codex-Whale-Public)，目标分支 `main`，维护者与新仓库所有者是 [Yang-huai406](https://github.com/Yang-huai406)。项目沿用 [MeteorNOX](https://github.com/MeteorNOX) 原作 [DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 的来源与许可，保留其原作者/上游仓库所有者身份，以及 [1llysviel](https://github.com/1llysviel) 的[上游 macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128) 与已有署名。新仓库现有 fixed Release 保留，不覆盖历史标签或附件；本文上游 issue 编号仍链接上游原 issue。

## 本次修复

### Windows 白屏遮挡保护

此前的区域裁剪只相信调用与缓存；裁剪无效或失效后，窗口仍可能显示。本次独立原生监控核对完整区域、窗口/进程身份和几何代次，显示只接受当前验证；区域失效、持续无法验证、监控失联或渲染异常时先撤销显示，限定恢复次数并重新核验。正常动画更新保留已验证区域，避免确认竞争导致反复闪现。

这是已证实保护缺口的修复。用户录屏无法唯一确定其设备上的触发根因；合法区域内部的显卡合成故障、Electron 主线程永久卡死等仍有边界，不能承诺所有白屏根治。相关 [#121](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/121) 仍属部分覆盖，不据此关闭 issue。

### 小黄鸭连点音效

按下/松开从直接硬停止改为 **8ms 短交叉淡变**。**90ms 内过密按下声音及其配对松开合并**，实际鼠标点击和动画照常处理，没有排队补播；有效长按的松开及时淡出，超过 250ms 才准备好的交互声丢弃。静音、隐藏与退出清理声音和尾音，旧解码不能复活。

任务完成的整组声音、设置试听与交互声音分开调度。单击、长按仍使用原素材；极密点击不要求每次都发出一个新声音。数字波形改善不替代用户在实际耳机/扬声器上的试听。

### 安装结果检查

Windows 安装器核对实际运行构建，避免只看到代码复制成功就误报新版已启动。允许等待 Codex 或保留主动暂停；恢复窗口后还应核对 `rendererReady` 与 `surfaceGuard.verified`。实际版本相同的更新需要同时看 `buildRevision`。

## 沿用功能与 issue 边界

沿用 fixed 的多提供商/profile/project 配置解析、命名余额连接、独立 GET/POST JSON 与专用认证、有界自动探测和候选确认、NewAPI raw quota 单位处理、不限额哨兵识别，以及账户新增消费去重、订阅窗口、本机 token、角色/气泡/音效、本地工坊、位置记忆与汇率。

“OpenAI-compatible”不等于提供标准余额接口；只有明确单位和范围的可靠金额参与统计。自动探测不盲试管理接口、不保证所有中转站可用。并行账户消费不能归给单个聊天，失败或取消也不等于免费。

逐项对应见 [本次 issue 状态表](docs/ISSUE-STATUS-FIXIXED.md)，开发过程见 [开发历程](docs/DEVELOPMENT-FIXIXED.md)。#177 全局空白点击关闭未采用，Mac 等未实测能力不标为完成。

## 使用与升级

安装包为 `Codex-v0.4(fixixed).zip`，源码包为 `Codex-v0.4(fixixed)-source.zip`；GitHub 材料包用于后续发布准备，不能代替安装包。完整操作见 [README](README.md)。

GitHub 会规范化附件名中的括号等字符，安装包下载名可能为 `Codex-v0.4.fixixed.zip`。以发布页实际名称及对应 SHA-256 校验索引为准；附件名规范化不更改包内容、Release 标题或精确标签。

1. Windows 需要支持插件注册的 Codex、Node.js 24+（含 npm）和首次下载 Electron 的网络；ZIP 不是离线 EXE。
2. 完整解压到固定目录，保留旧版和备份，运行 `安装插件.cmd`，保存输出的私有回执。
3. 打开 Codex；主动暂停会保留，可用 `启动桌面挂件.cmd` 恢复。
4. 在插件目录执行 `node .\scripts\control.mjs status`，确认 `version: 0.4.1`、`buildRevision: surface-audio-fix-20261007`；Windows 正常显示后 `rendererReady` 和 `surfaceGuard.verified` 为 true。
5. API 设置使用“重新检测接口”。候选须核对币种、单位和额度范围；没有可靠依据时保留未确认或选择“不查询余额”，不要盲目把 raw quota 当钱。

## 验证记录与边界

| 本次实际执行 | 结果与范围 |
| --- | --- |
| 全量自动测试 | 510 项通过，执行于最终安装检查改动之前 |
| 安装检查等针对测试 | 后续 15 项通过，其中 3 项新增；不是全量 513 项重新执行 |
| Windows 原生场景 | 150% DPI 下 8 组验证，含区域丢失、错误全窗区域、几何变化、渲染无响应与恢复限制 |
| 真实素材离线音频 | OfflineAudioContext 中每秒 1/5/10/20 次点击对照；20Hz 两秒操作由 80 次音源启动降至 40 次，未出现削波；没有实际播放声音 |

此前 fixed 的 482 项自动测试、9 项隐私门禁及 Electron 6 组流程/7 个布局样本/8 张截图属于历史验证，不冒充本轮重跑。最终 ZIP 的隐私、文件范围、哈希、解压和安装预检结果以本次 `release-manifest.json`、`verification-report.json` 为准。

测试使用隔离服务与专用窗口，不代表全部真实账号、显卡驱动、Mac、多屏和长期稳定性已验收。Windows 原生采样/恢复时间属于调度参数，不是高负载下硬实时承诺。账本仍不是服务商完整流水，不能仅靠余额拆分同时发生的充值、退款与消费，也不自动重算历史错误口径。详见 [已知限制](docs/KNOWN-ISSUES-FIXIXED.md) 和 [白屏/音效专项说明](docs/SURFACE-AUDIO-FIX-20261007.md)。

## 用户验证与回滚

打开/关闭概览与设置、最小化还原、调整窗口大小和跨屏移动；正文空白区域应可操作，保护撤销计数不应持续增长。仍白屏时先从托盘隐藏/退出挂件，看底层是否恢复，再反馈脱敏构建、DPI、触发步骤及 `surfaceGuard` 字段。

音效分别测试慢点、连点、长按松开、静音、自定义音组、任务提示与试听。预期硬切/碎裂减少，松手后不排队补叫；最终听感由用户确认。

每位接收者安装时生成自己的 `installation.json` 与 `recovery-scripts/rollback-package.ps1`。使用自己的回执 `-Receipt ... -CheckOnly` 核对恢复目标，再去掉 `-CheckOnly` 执行。前后都可能为 `0.4.1`，须核对备份 `plugin/package.json` 的构建标识；回滚后再次运行 `status`。恢复旧程序和启动配置，保留最新设置、素材和账本。不要使用维护者回执或删除账本代替回滚。

公开材料排除私人配置、凭据、账本、会话、日志、截图录屏、回执、缓存和 Git 历史。Mac 桌面组件/LaunchAgent 及署名保留，本次未实机验收，且 Mac 安装入口不自动注册技能/MCP；见 [macOS 文档](docs/MACOS.md)。

## 发行标识与历史保留

发行仓库为 **Yang-huai406/Codex-Whale-Public**，分支 **`main`**，标签 **`codex-v0.4.0(fixixed)`**，标题 **Codex-v0.4(fixixed)**。本稳定版设置 `makeLatest: true`，保留旧 fixed Release、历史标签和附件。原迁移、净化与许可记录继续见 [发行时间线](docs/RELEASE-HISTORY.md)、[净化说明](docs/SANITIZATION.md)、[历史提交映射](docs/HISTORY-SANITIZATION.json) 和 [素材分发范围](docs/MATERIALS-PERMISSION.md)。
