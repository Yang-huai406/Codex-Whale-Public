# macOS 跟随模式 Space 绑定修复（候选，未真机验收）

本文说明跟随模式下挂件与 Codex 窗口的 Space（桌面）绑定改动。

**状态：已完成编译、安装和运行状态检查，Spaces 滑动效果待用户验收。** 当前安装的状态接口确认主窗口选择正确、`bound=true`、`rendererReady=true`、`visible=true`。没有执行桌面切换 UI 测试或跨版本回归。回滚脚本保存安装配置和原生组件；若直接修改原安装源码目录，回滚配置不能恢复该目录的旧源码，应另行保留旧版本目录。

## 根因

此前跟随模式把挂件窗口设为 `setVisibleOnAllWorkspaces(true)`，即“所有桌面都显示”。这与跟随语义冲突：

- 切到别的桌面时挂件仍被系统显示，看起来“粘”在屏幕上而不是跟着 Codex 走。
- 返回 Codex 所在桌面时，窗口由合成器重新映射，容易出现闪一下、位置跳变或短暂错位。
- Swift 窗口探针原先只枚举屏幕上的窗口。Codex 位于非活动 Space 时，探针虽缓存了旧窗口身份，但将可见性标为 false，跟随逻辑随后隐藏挂件。

## 修复

跟随模式取消 `setVisibleOnAllWorkspaces(true)`，改用原生模块按 Space 真正绑定（独立桌面模式不受影响，仍在所有桌面显示）：

- 新增 `desktop/macos/space-binding.m` 与 `desktop/macos/napi-abi.h`。安装器编译成 universal（arm64 + x86_64）、Node-API 3 的 `.node` 模块，放在用户数据目录的 `native/` 下，并把路径写入配置的 `spaceBindingPath`。
- 原生模块只修改挂件自己的窗口。Codex 窗口是只读的：不改它的 Space，不移动、不激活、不隐藏它。
- 通过 SkyLight 的私有接口读取 Codex 窗口的 Space 集合，把挂件窗口加入同一集合、从其它集合移除，并在改动后读回校验成员关系；校验不通过即视为失败。
- 通过 SkyLight 读取 Codex 窗口的 model bounds 作为位置来源，并检测任一显示器是否处于 Space 切换动画。坐标是逻辑点，Retina 屏幕不需要额外 DPI 换算。
- 任何异常都按“失败即隐藏”处理，并通过 `status.macSpaceBinding.reason` 报告原因；不会退回到“跨桌面轮询显示”的旧行为，因此失败时挂件可能不可见，这是刻意选择而不是卡死。
- `desktop/macos/follow.cjs` 在动画期间冻结已绑定的窗口身份与坐标，不因 Space 处于非活动状态而调用 `hide`。
- Swift 探针改用 `optionAll` 枚举窗口，使 inactive Space 上的 Codex 窗口仍保留有效身份；探针自身不宣称已绑定，绑定结果以原生模块读回校验为准。
- Space 查询包含 ordered-out 窗口（选项 `0x20007`），避免初始隐藏的挂件因查询结果为空而无法完成绑定。
- `optionAll` 返回的隐藏窗口可能缺少 `kCGWindowIsOnscreen`，缺失时按 false 处理；非活动桌面优先选择仍 ordered-in 的主窗口，避免选中隐藏辅助窗口。
- 之前已合入的订阅气泡修复保持有效，本轮未改动其行为。

## 重新安装

原生模块是编译产物，旧安装里没有它。**仅重启挂件不够**，必须重新运行安装器：

1. 关闭正在运行的挂件（可用 `停止挂件服务.command`）。
2. 在新目录解压本版本（保留原插件目录，不覆盖旧目录）。
3. 双击 `安装 Mac 自动跟随.command`；若解压工具丢失执行位，在该目录终端运行 `node scripts/install-macos.mjs`。
4. 安装器会重新编译 Swift 探针和 Space 绑定原生模块，并写入新的 `spaceBindingPath`，然后注册 LaunchAgent。
5. 打开 Codex，用 Cmd+Option+W 显示挂件，确认处于跟随模式。

若跳过第 3 步，跟随模式会因原生模块缺失而保持隐藏，状态里的原因是 `native-module-unavailable`。

## 需要你验证

请在不同场景下慢速观察，重点是切换动画期间与动画刚结束时的表现：

1. **慢速左右滑动**：用三指滑动或 Ctrl+方向键慢慢切 Space，挂件应随 Codex 移动，不出现残影、跳到别的桌面或位置漂移。
2. **取消半途滑动**：滑到一半松手退回原桌面，挂件应回到正确位置，不出现一窗两桌面或半透明卡住。
3. **连续切换**：快速连续切换多个 Space，结束后挂件位置与可见性应正确，不叠加多个实例。
4. **返回 Codex**：从别的 Space 切回 Codex，挂件应正常出现，不应有明显闪烁或延迟数秒才出现。
5. **多 Codex 窗口**：打开多个 Codex 窗口并分别放在不同 Space，确认挂件跟随的是当前活动窗口，窗口身份切换时不残留旧位置。
6. **全屏**：Codex 进入全屏（含新开全屏 Space）再退出，挂件应仍可用；退出全屏后不应消失。
7. **Retina 多屏**：在高分屏与外接屏之间移动 Codex，确认挂件尺寸和位置正确，不出现缩放或偏移。
8. **最小化与恢复**：最小化 Codex 再恢复，以及挂件自身被隐藏再显示，行为应符合预期。
9. **standalone / follow 切换**：在跟随与独立桌面之间切换多次；独立桌面模式应仍在所有桌面显示，切回跟随后绑定应重新建立。

状态查看：

```sh
node scripts/control.mjs status
```

关注输出中的 `macSpaceBinding`：

- `bound`：是否已成功绑定到 Codex 的 Space 集合。
- `animating`：检测到显示器正在做 Space 动画（此时坐标被冻结，属正常）。
- `spaces`：当前绑定的 Space 标识集合。
- `reason`：失败原因，为空表示正常。常见值包括 `native-module-unavailable`（未重新安装）、`host-heartbeat-stale`、`host-unavailable`、`host-window-unavailable`、`space-bind-unverified`、`skylight-unavailable`、`displays-unavailable`、`host-window-gone`、`invalid-host-bounds`、`native-space-sync-failed`。

同时建议运行 `node scripts/probe-macos.mjs` 确认探针与 Codex 窗口定位正常。

## 已知限制

- 绑定依赖 SkyLight 私有 API。macOS 系统更新可能改变这些接口的符号或语义；尽管实现里做了符号回退与读回校验，仍可能在将来版本上失效。
- 失败即隐藏，不回退到跨桌面轮询显示。这是为了避免错误的跨桌面绘制，代价是失败时挂件不可见，需要看 `reason` 定位。
- 本轮没有真机验收，也没有覆盖睡眠唤醒、显示器热插拔、第三方窗口管理工具等场景。
- 本文不声称修复一定成功，只描述改动内容与验证方法。
