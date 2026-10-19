# macOS 安装、验证与回滚

本版保留 [PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128) 的 macOS 适配，作者 1llysviel。2026-10-19 已在 Apple Silicon 实机完成安装、插件注册（含在 Codex 新聊天中调用 `whale_status`）、退出、重启与回滚，见 [实机记录](MACOS-VERIFICATION-20261019.md)；Intel Mac 仍待验收。

`安装插件.command` 完成桌面组件、LaunchAgent 与 Codex 插件市场技能/MCP 注册；`安装 Mac 自动跟随.command` 保留原有仅桌面组件的方式。

## 安装

1. 安装 Codex 桌面应用、Node.js 24+、Xcode Command Line Tools。安装器优先查找 Homebrew Node。
2. 完整解压安装包，不要直接覆盖正在使用的 `~/plugins/api-balance-whale`。
3. 双击 `安装插件.command`。若解压工具丢失执行位，可在该目录终端运行 `node scripts/install-macos.mjs`；加 `--check-only` 只预检，加 `--codex-cli <路径>` 指定 CLI。
4. 安装器把代码复制到 `~/plugins/api-balance-whale`（旧目录整体移入私有备份），写入 `~/.agents/plugins/marketplace.json` 的本插件条目，执行 `codex plugin add api-balance-whale@<市场名>` 并以 `plugin list --json` 确认唯一启用的当前版本。CLI 优先使用桌面应用随附版本（`ChatGPT.app/Contents/Resources/codex-cli`），其次是 `~/.local/bin`、Homebrew 与 PATH。随后编译 Swift 窗口探针，设置独立 Electron bundle ID，注册当前用户 LaunchAgent，以安装标识、插件目录、进程和新鲜心跳验证安装成功。完成后新建 Codex 聊天加载技能与 MCP。
   仅需桌面挂件时运行 `安装 Mac 自动跟随.command`（`--desktop-only`），代码在解压目录原地运行，不注册插件。
5. 打开 Codex。Cmd+Option+W 切换显示；菜单可切换跟随/独立桌面。`进入独立桌面.command` 可独立启动。挂件在调度中心和 App Exposé 中隐藏，退出后照常显示；它与 Codex 是不同进程，无法在调度中心合并为同一窗口。

挂件使用 CGWindowList 和 proc_pidpath 定位窗口，本地 Unix socket 通信，无网页端口。默认 bundle ID 为 com.openai.codex，可用 WHALE_CODEX_BUNDLE_ID 指定兼容安装布局。

## 验证

```sh
node scripts/probe-macos.mjs
node scripts/control.mjs status
```

检查最小化/恢复、退出/重新打开 Codex、Spaces、全屏、不同 DPI 显示器、快捷键、首次点击和睡眠唤醒。代码的静态检查不代替上述实机测试。

## 回滚

安装前的操作配置、LaunchAgent、窗口探针、被替换的插件目录（`replaced-plugin`）、市场条目回执与回滚脚本副本（`recovery-scripts`）保存在数据目录的 backups/macos-* 中，回执为 macos-rollback-receipt.json（第 2 版记录插件注册阶段）。

双击 `回滚 Mac 更新.command`，或使用备份中的副本（插件目录被替换后仍可用）：

```sh
node <备份目录>/recovery-scripts/rollback-macos.mjs <备份目录>/receipt.json --check-only
node <备份目录>/recovery-scripts/rollback-macos.mjs <备份目录>/receipt.json
```

每份回执只能回滚一次：完成后标记为 `rolled-back`，`macos-rollback-receipt.json` 改回上一次安装的回执，再次执行默认回滚即回到更早的版本。回滚停止当前 LaunchAgent，注销本次注册的 Codex 插件并还原个人市场条目（之前已注册时重新注册旧版本），把被替换的插件目录移回原位（本次代码移入 `before-rollback-*` 检查点），恢复旧配置及探针并启动旧代码；保留最新设置、素材与账本。安装前不存在的空个人市场文件和空缓存目录会留下，无害。没有旧安装时停用新服务。如果旧目录被删除，需要依据回执恢复备份。不要把安装回执或 runtime.json 上传到公开讨论，它们含本地运行信息。

停止自动启动使用 `停用自动跟随.command`。本地暂停尊重主动退出，不会无条件反复拉起。
