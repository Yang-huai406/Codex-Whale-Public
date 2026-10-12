# macOS 安装、验证与回滚

本版保留 [PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128) 的 macOS 适配，作者 1llysviel。

本页脚本安装桌面组件与 LaunchAgent，不自动注册 Codex 插件市场的技能/MCP。相关完整集成仍待 Mac 实机验证。

**当前 Space 修复真机未验收。** 本轮跟随模式的桌面 Space 绑定改动（取消 `setVisibleOnAllWorkspaces(true)`、改用 Node-API3 原生模块）只有静态检查与代码评审，尚无 Mac 真机结果。它属于候选修复，细节、重新安装步骤与需要你自行验证的清单见 [MACOS-SPACES-FIX.md](MACOS-SPACES-FIX.md)。

## 安装

1. 安装 Codex 桌面应用、Node.js 24+、Xcode Command Line Tools。安装器优先查找 Homebrew Node。
2. 将 v0.4 解压到新的固定目录，保留原插件目录，不覆盖旧目录。
3. 双击 `安装 Mac 自动跟随.command`。若解压工具丢失执行位，可在该目录终端运行 `node scripts/install-macos.mjs`。
4. 安装器编译 Swift 窗口探针，并编译 Space 绑定原生模块：源码为 `desktop/macos/space-binding.m` 与 `desktop/macos/napi-abi.h`，产物为 universal（arm64 + x86_64）、Node-API 3 的 `.node` 模块，放在用户数据目录的 `native/` 下并以安装标识命名，安装器把该路径写入 `spaceBindingPath`。随后设置独立 Electron bundle ID，注册当前用户 LaunchAgent，以安装标识、进程和新鲜心跳验证安装成功。
5. 从旧版本升级：只重启挂件不够，必须重新运行 `安装 Mac 自动跟随.command` 重新编译原生模块，否则跟随模式会因原生模块缺失而保持隐藏并在状态里报告原因。
6. 打开 Codex。Cmd+Option+W 切换显示；菜单可切换跟随/独立桌面。`进入独立桌面.command` 可独立启动。

挂件使用 CGWindowList 和 proc_pidpath 定位窗口，本地 Unix socket 通信，无网页端口。默认 bundle ID 为 com.openai.codex，可用 WHALE_CODEX_BUNDLE_ID 指定兼容安装布局。跟随模式下由原生模块把挂件窗口绑定到 Codex 窗口所在的 Space 集合；独立桌面模式仍在所有桌面显示。原生模块只改挂件自己的窗口，对 Codex 窗口只读。

## 验证

```sh
node scripts/probe-macos.mjs
node scripts/control.mjs status
```

检查最小化/恢复、退出/重新打开 Codex、Spaces、全屏、不同 DPI 显示器、快捷键、首次点击和睡眠唤醒。代码的静态检查不代替上述实机测试。

`node scripts/control.mjs status` 输出中的 `macSpaceBinding` 显示 Space 绑定状态（`bound`、`animating`、`spaces`、`reason`）。跟随模式的 Space 场景清单、判定方法与已知限制见 [MACOS-SPACES-FIX.md](MACOS-SPACES-FIX.md)；该修复尚未真机验收。

## 回滚

安装前的操作配置、LaunchAgent、窗口探针及原生 Space 绑定模块保存在数据目录的 backups/macos-* 中，回执为 macos-rollback-receipt.json。使用独立新版本目录安装时，原代码目录会保留；安装器还会备份不同路径的旧代码。

双击 `回滚 Mac 更新.command` 或运行：

```sh
node scripts/rollback-macos.mjs
```

回滚停止当前 LaunchAgent，恢复旧配置及探针，启动旧目录的代码；保留最新设置、素材与账本。没有旧安装时停用新服务。如果旧目录被删除，需要依据回执恢复备份。不要把安装回执或 runtime.json 上传到公开讨论，它们含本地运行信息。

停止自动启动使用 `停用自动跟随.command`。本地暂停尊重主动退出，不会无条件反复拉起。
