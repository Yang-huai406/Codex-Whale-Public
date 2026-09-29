# 来源、改编范围与许可

本分支将 MeteorNOX 的 dsh-whale-widget 0.3.0-beta 从 DSH Web 挂件适配为 Codex 桌面伴随挂件，插件名称为 api-balance-whale。

## 本次范围和协作关系

- 当前交付：Codex v0.3(fixed) For-Codex 分支发布，包内基线版本仍为 0.3.0（Windows 已做本机回归，macOS 保留兼容代码但待实机验证）；没有独立网页，不修改或注入 Codex 安装文件。
- 仓库所属账号及上游作者：[@MeteorNOX](https://github.com/MeteorNOX)。
- Codex 适配协作者：[@Yang-huai406](https://github.com/Yang-huai406)，不代表仓库所有权变更。
- 上传前的 0.2.4/macOS 成果保留于 [原始提交](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/tree/8de181abf5593247f32d57995567dd9f4063e049) 和 [归档目录](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/tree/For-Codex/archive/for-codex-0.2.4)；v0.3 已整合 PR #128 兼容路径，原归档继续保留。
- 感谢 [@1llysviel](https://github.com/1llysviel) 的 [macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)。本次不会把其工作改称为新原创。

## 保留与改造

保留原框架的角色、图片、动图、音效和主要交互。适配层提供 Electron 透明工具窗口、Windows 原生跟随、GUI 启动器、本地 IPC、当前 API 余额/用量、汇率、账本、恢复日志及安装回滚。

本次修复包括设置脱敏、灰色感叹号汇率说明、中性取消结算、主轮去重、可见性状态机，以及显式显示和返回 Codex 的恢复。详情见 [README](README.md) 和 [变更记录](CHANGELOG.md)。

## 许可边界

| 范围 | 许可与分发方式 |
| --- | --- |
| 代码和文档 | MIT，保留 [LICENSE](LICENSE) 中的上游版权 |
| assets 中的图片、动图、音频 | 按上游条款 as-is 随挂件分发；本仓库不授予再许可，不声明为本次原创，不因代码 MIT 而扩大素材权利 |
| vendor/smol-toml | BSD-3-Clause，保留原包许可证 |
| Electron 与 Chromium | 安装时另外下载，保留其自带许可证和第三方声明 |

见 [第三方声明](THIRD_PARTY_NOTICES.md)。发布包不包含聊天截图和历史测试截图；其中角色素材仍遵循上述素材边界。

## 隐私和历史

分享包不包含个人密钥、账号、账本、运行日志、真实账户截图、缓存或本机备份。完整旧实现可通过 Git 历史恢复。本次采用普通提交与独立 Codex 标签发布，不改写历史，不变更仓库设置或所有者；发布授权不改变尚未验收的平台限制。

如果认为某个素材侵犯权利，请沿用仓库既有反馈渠道说明文件名和依据；核实后由维护者处理。安全问题按 [SECURITY.md](SECURITY.md) 私下报告，不提交凭据或完整日志。
