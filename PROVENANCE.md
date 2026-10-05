# 来源、改编范围与许可

本项目将 MeteorNOX 的 dsh-whale-widget 0.3.0-beta 从 DSH Web 挂件适配为 Codex 桌面伴随挂件，插件名称为 api-balance-whale。

## 本次范围和协作关系

- 当前代码基线：**Codex-v0.4(fixed)**，内部版本 `0.4.1`，构建 `auto-probe-fixed-20261005`，历史上游标签 `codex-v0.4.0(fixed)`。本仓库尚无独立发行，已有安装包见[上游历史发行](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/releases/tag/codex-v0.4.0%28fixed%29)。Windows 已进行回归验证；macOS 保留兼容代码，仍需实机验证。没有独立网页，不修改或注入 Codex 安装文件。
- 原项目作者及上游仓库所有者：[@MeteorNOX](https://github.com/MeteorNOX)，原版权与来源声明继续保留。
- 当前独立仓库：[Yang-huai406/Codex-Whale](https://github.com/Yang-huai406/Codex-Whale)，当前为私有仓库，是否公开由维护者后续决定，默认开发分支 `main`；仓库所有者及 Codex 适配维护者为 [@Yang-huai406](https://github.com/Yang-huai406)。这不改变原上游仓库的所有权。
- 历史 0.2.4/macOS 成果见 [原始提交](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/tree/8de181abf5593247f32d57995567dd9f4063e049)。历史归档名称 `archive/for-codex-0.2.4` 仅用于来源追溯，不是当前发布版的安装入口；v0.3 系列整合了 PR #128 的兼容路径。
- 感谢 [@1llysviel](https://github.com/1llysviel) 的 [macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)。本次不会把其工作改称为新原创。

## 保留与改造

保留原框架的角色、图片、动图、音效和主要交互。适配层提供 Electron 透明工具窗口、Windows 原生跟随、GUI 启动器、本地 IPC、当前 API 余额/用量、汇率、账本、恢复日志及安装回滚。

当前版本包含费用归属、设置保存、额度窗口合并、音频资源释放、气泡配置保真等修复。详情见 [README](README.md)、[变更记录](CHANGELOG.md) 和 [已知问题](docs/KNOWN-ISSUES-FIXED.md)。

## 许可边界

| 范围 | 许可与分发方式 |
| --- | --- |
| 代码和文档 | MIT，保留 [LICENSE](LICENSE) 中的上游版权 |
| assets 中的图片、动图、音频 | 按上游条款 as-is 随挂件分发；本仓库不授予再许可，不声明为本次原创，不因代码 MIT 而扩大素材权利 |
| vendor/smol-toml | BSD-3-Clause，保留原包许可证 |
| Electron 与 Chromium | 安装时另外下载，保留其自带许可证和第三方声明 |

见 [第三方声明](THIRD_PARTY_NOTICES.md)。发布包不包含聊天截图和历史测试截图；其中角色素材仍遵循上述素材边界。

## 隐私和历史

公开打包规则排除个人密钥、账号、账本、运行日志、真实账户截图、缓存和本机备份。完整旧实现可通过 Git 历史追溯。历史 For-Codex 发行由协作者 Yang-huai406 在 MeteorNOX 所有的原仓库发布；迁移后由 Yang-huai406 在独立仓库维护。原始提交和作者信息保留，不改写原仓库历史、旧发布或主线 Latest。平台验证边界见已知问题文档。

如果认为某个素材侵犯权利，请通过[本仓库 Issues](https://github.com/Yang-huai406/Codex-Whale/issues)说明文件名和依据；核实后由维护者处理。安全问题按 [SECURITY.md](SECURITY.md) 私下报告，不提交凭据或完整日志。
