# macOS 安装、插件注册与回滚实机记录（2026-10-19）

对应 [Issue #3](https://github.com/Yang-huai406/Codex-Whale-Public/issues/3)。本页只记录一台 Apple Silicon Mac 上的实际结果，已脱敏，不含账号、密钥、私人路径或原始账本。**Intel Mac 未测试，仍待验收。**

## 环境

| 项目 | 值 |
| --- | --- |
| 硬件 / 系统 | Apple Silicon（arm64）/ macOS 26.6.1 |
| Codex 宿主 | 桌面应用 bundle ID `com.openai.codex`（应用名为 ChatGPT.app，内含 Codex Framework 与随附 CLI 0.162） |
| 独立 CLI | codex-cli 0.154.0 |
| Node / Swift | Homebrew Node 26.11.1 / Apple Swift 6.4（Xcode） |
| 安装前状态 | 已有 PR #128 时期的 0.2.0 desktop-only 安装（LaunchAgent 运行中，未注册 Codex 插件） |
| 安装包 | 本地构建 `Codex-v0.4(fixixed).zip`（隐私扫描与压缩完整性通过），`ditto` 解压后运行 `安装插件.command` |

安装前已对数据目录、旧插件目录、LaunchAgent plist 和 Codex `config.toml` 做私有快照，仅用于本机对照。

## 结果

| 步骤 | 结果 |
| --- | --- |
| 预检 `install-macos.mjs --check-only` | 通过；找到应用随附 CLI 与 `personal` 个人市场，不修改本机 |
| 安装 | 8 秒完成；回执 `version 2`、`stage complete`；旧 0.2.0 代码整体移入备份 `replaced-plugin`，未删除 |
| Swift 编译与签名 | 窗口探针编译并 ad-hoc 签名成功；Electron bundle 重签名成功 |
| 权限 | 窗口探针在未另行授予辅助功能或屏幕录制权限的情况下返回了宿主窗口位置（`attached: true`）；使用者确认安装与运行过程中没有出现系统授权弹窗 |
| 插件注册 | `codex plugin list --json` 报告唯一一项 `api-balance-whale@personal` v0.4.1 installed/enabled；`config.toml` 新增对应启用项；代码进入 `plugins/cache/personal/api-balance-whale/0.4.1` |
| MCP | `codex mcp list` 显示 `whale` 已启用；按真实客户端方式驱动插件缓存中的 `runtime/mcp.mjs`：`whale_status`、`whale_balance`（真实余额，`finite`）、`whale_usage` 均返回 `ok`。最终代码安装后，使用者在 Codex 桌面应用新聊天中调用 `whale_status` 成功，确认 Codex 自身能展开插件路径并启动 MCP |
| 自动跟随 | `status`：0.4.1 / `surface-audio-fix-20261007`、`visible`、`rendererReady`；探针 `attached: true`、DPI 144；使用者目测确认小鲸鱼显示在屏幕上 |
| 主动退出 | `control.mjs stop` 后写入暂停标记，12 秒内无重新拉起；`control.mjs open` 恢复显示 |
| 重启 | `launchctl kickstart -k` 后新监督器与子进程就绪；强制结束 Electron 后 10 秒内自动恢复；始终只有一个监督器和一个 Electron 主进程 |
| 回滚 | 恢复副本 `recovery-scripts/rollback-macos.mjs` 先 `--check-only` 再执行：插件注销、市场条目还原、旧代码移回原位；插件目录、plist、`follow-config.json`、`config.toml` 与安装前快照逐字节一致；0.2.0 重新运行并可见 |
| 用户数据 | 账本历史与事件不变；0.4.1 运行期间追加 `accountNotices` / `observedExact` 字段，回滚后的 0.2.0 正常读取 |

## 第二轮：最终代码安装、覆盖已注册版本与再回滚

第一轮发现两处问题并已修复：Electron 版本检查多跳一级目录，导致已有固定版本时仍重跑 `npm install`（无害但多余）；回滚后 `macos-rollback-receipt.json` 仍指向已回滚的回执，可能被重复执行，也无法回到更早一次安装。修复后：

| 步骤 | 结果 |
| --- | --- |
| 从 0.2.0 安装最终代码 | 4 秒完成，跳过 Electron 重装（修复生效）；注册、`status`、探针均正常 |
| 在已注册的 0.4.1 上再次安装 | 3 秒完成；回执记录原市场条目（`previousEntry`）与上一份回执指针 |
| 回滚第二次安装 | 代码恢复为第一次安装的版本；先注销再重新 `plugin add`，`plugin list` 显示 v0.4.1 已启用；市场条目保留；回执指针恢复到第一次安装；监督器以第一次安装标识运行并可见 |
| 重复回滚 | 回执标记为 `rolled-back`，再次执行被拒绝 |

回滚的各分支（覆盖已注册版本、全新安装、注册阶段前后失败、`--check-only` 不改动、第 1 版回执、回执被移出备份目录）另有自动化测试，使用假 launchd 与假 Codex CLI，并用变异测试确认能检出缺失的重新注册和指针恢复。

## 回滚后的残留

无害但不会自动清除：空的 `personal` 个人市场文件（安装前不存在）、空插件缓存目录、Swift 模块缓存、回执与 `visibility-status.json`。

## 未覆盖

- Intel Mac；系统重启/注销后的 RunAtLoad；睡眠唤醒（#135）；Spaces、全屏、多屏与不同 DPI。
- 在 Codex 聊天中只调用了 `whale_status`；`whale_balance`、`whale_usage`、`whale_open` 由记录者直接驱动 MCP 验证，未在聊天中逐一调用。
- 第二轮最终整理后的回滚代码只做过实机 `--check-only` 与自动化测试；实机回滚使用的是整理前、逻辑相同的版本。
- 安装脚本本身没有自动化测试；安装路径的证据来自上述两轮实机运行，未覆盖“解压目录即 `~/plugins/api-balance-whale`”、全新机器及 `--desktop-only` 改动后的实机运行。
- 退出并重新打开 Codex 宿主应用（为避免打断使用者的会话未执行）。
