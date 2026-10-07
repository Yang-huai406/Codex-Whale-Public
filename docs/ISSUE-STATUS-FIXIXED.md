# Codex-v0.4(fixixed)：Issue 与反馈状态

**本版发行说明。** 包名为 `Codex-v0.4(fixixed)`，发行标签为 `codex-v0.4.0(fixixed)`；`fixixed` 是本次约定拼写。内部版本仍为 `0.4.1`，构建为 `surface-audio-fix-20261007`。

当前公开项目为 [Yang-huai406/Codex-Whale-Public](https://github.com/Yang-huai406/Codex-Whale-Public)，本次发行以其 `main` 分支为目标。[Yang-huai406](https://github.com/Yang-huai406) 是新独立仓库所有者和维护者。项目于 2026-10-05 完成公开迁移，已有 fixed 发行随之迁移。

本表汇总历史 For-Codex 适配线累计能力和本次新增修复，不表示上游 Issue 已关闭。[MeteorNOX](https://github.com/MeteorNOX) 仍是上游原作者及 [原仓库](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 所有者；保留 [1llysviel](https://github.com/1llysviel) 的 [macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)。下列历史 Issue 继续链接原讨论，不将迁移误记为关闭或重新创建 Issue。

## 本次新增：白屏保护与连点音效

| 问题与对应讨论 | 已确认的问题及本次处理 | 状态和边界 |
| --- | --- | --- |
| Windows 原版 0.4.0 白屏遮挡反馈；与 [#121](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/121) 有关 | 原版与 fixed 的窗口路径都存在保护缺口：只相信区域设置调用和缓存，没有用实际原生区域约束显示。本次常驻原生监控比较完整区域并集，绑定窗口、实例、尺寸和形状；失败先撤销显示，恢复须取得新验证 | **保护缺口已修复，#121 仍部分覆盖。** 原录屏不能唯一确定设备触发根因；不能称全部显卡、驱动及白屏原因已根治 |
| 动画不断变化时，错误区域可能一直避开稳定检查；无单独 Issue | 除短暂布局竞争容差外，增加独立于形状序号的连续未验证期限；只有实际区域验证成功才刷新期限 | 已覆盖持续变化中静默返回错误全窗区域的隔离故障注入；调度参数不是高负载下硬实时承诺 |
| 小黄鸭快速连点听感破碎；无单独 Issue | 按下/松开直接停止非零波形会硬切并频繁重启音节。改为 8ms 短交叉淡变，合并 90ms 内过密声音及配对松开；丢弃过晚的交互声，取消后不复活 | 调度与数字波形已验证，实际点击和动画不被限频，也不排队补叫。实际扬声器、耳机及主观听感仍由用户验收 |
| “安装成功”不能证明新版正在运行；无单独 Issue | 安装检查核对已启用的插件注册及实际运行构建；同为内部版本 0.4.1 时还核对 build，允许明确的等待 Codex/主动暂停状态 | 已补针对回归；安装检查通过不代替显示、音效及真实服务商验收 |

快速点击音效与 [#187](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/187) 的设备首音裁切、[#197](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/197) 的双重声音不能混为同一根因。本次不据此把这两个 Issue 改成全面完成。机制、验证与回滚见 [白屏和音效专项说明](SURFACE-AUDIO-FIX-20261007.md)。

## 累计已覆盖的 Codex 缺陷

这里的“已覆盖”只指明确列出的实现范围，不等于原讨论中所有平台和子问题均完成验收。

| 对应讨论 | 累计实现范围 | 验证边界 |
| --- | --- | --- |
| [#181](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/181) 额度类型与窗口覆盖 | 按额度来源筛选，分别合并五小时和每周窗口；保留各自时间，处理同文件/跨文件、别名冲突、登录边界和过期 | 自动解析与合成回放不代替真实订阅账号完整切换链路 |
| [#172](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/172) / [#195](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/195) 气泡队列卡住 | 队列项与场景共享生命周期；失败、取消和替换释放占用，旧回调不能清掉新场景 | 不声称任意素材组合和无限运行时长均已验收 |
| [#159](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/159) 气泡文字溢出 | 双缓冲、安全区测量、换行和缩放统一；短金额标题保持可读，设置可滚动 | 过长内容可能缩小；历史布局样本不冒充本次全部重跑 |
| [#88](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/88) 失败静默 | 明确区分缺失、不可读和损坏配置；读写失败可见，避免把坏文件当空配置覆盖 | 不替用户修复权限或物理存储故障 |
| [#97](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/97) 初始化覆盖设置 | 加载合并、局部更新、顺序保存；迟到编辑/预览不能覆盖新表单 | 保留交错、延迟和关闭重开回归 |
| [#163](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/163) 旧账户账本不可查看 | 匿名账户与币种历史入口，不依赖旧密钥仍有效 | 不自动合并账户、重算旧金额或恢复已删除记录 |
| [#188](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/188) 隐藏后超时不收敛 | 场景保留截止时间，恢复、图片失败和回退后重新判断 | 常驻提示仍有常驻语义，不统一改为同一种超时 |

## 部分覆盖及待修复项目

| 对应讨论 | 已完成部分 | 尚未完成或未验证 |
| --- | --- | --- |
| [#190](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/190) POST/body 余额接口 | 命名连接支持 GET、POST JSON、独立 Bearer/自定义请求头认证、结构化头与查询参数 | 不是所有服务已适配；不支持任意网页登录、表达式执行或将秘密直接持久化到 body |
| [#108](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/108) 台词池及屏名 | 普通屏、选择屏和候选名称往返保留 | 共享台词池仍未实现；复制模块不等于共享引用 |
| [#135](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/135) 音频阻止睡眠 | 播放/裁剪上下文有限生命周期，处理关闭、取消和迟到回调 | 本次连点声音清理也不等于 Mac 睡眠断言与整机睡眠验收 |
| [#79](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/79) 触屏与取消坐标 | 共用取消、捕获丢失、失焦分支，不提交无效位置 | Android WebView、触控长按菜单等未提供完整支持 |
| [#121](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/121) 还原后空白浮窗 | 累计软件合成、可见性协调、区域生命周期和层级恢复；本次新增真实区域验证与有界故障恢复 | 150% DPI 的本机原生场景不等于全部 DPI、多屏、GPU、设备及长期验收；合法区域内无故障事件的合成异常仍有边界 |
| [#184](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/184) 观测中断跨日 | 保留跨午夜基线，恢复时不丢掉整个区间差额 | 精确逐日拆分、人工补录和完整账单流水还原未实现 |
| [#187](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/187) 设备吞首音 | 保留预解码与播放生命周期管理 | 本次快速连点修复不是专用前导唤醒方案；原故障设备仍待实测 |
| [#197](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/197) 双重声音 | 保留单实例、事件去重和通道管理；连点声与任务/试听通道分开 | 原报告根因尚未在当前版明确复现，不能因新增声音合并就按推测关闭 |

## 沿用的余额连接与账户反馈修复

| 反馈 | 累计处理 | 保留边界 |
| --- | --- | --- |
| provider/profile 切换后地址与认证混配 | 递归合并配置、精确来源匹配、命名连接和固定连接；旧覆盖绑定来源与租户路径 | 跟随实际读取到的配置，不能还原未读取的 CLI 临时覆盖 |
| 普通第三方自动模式停在未确认 | 有界顺序探测和契约校验；可信命中直接使用，有完整可核对规则的候选可“确认并使用” | 未知单位、字段或范围仍不能参与记账；不保证所有中转站都能查询 |
| `100000000` 被当作巨额资金 | 按已知协议区分不限额哨兵、有限金额和未确认口径 | 不凭“大数”猜测任意服务语义，不限额不等于账户资金无限 |
| NewAPI raw quota 被当作金额 | 校验原始整数配额及加总关系，按可靠单位或确认规则换算；占位使用零不参与差分 | 自建站仍可能需要可靠元数据或正确配置，不能重复换算 |
| 接口、单位或计数器切换产生虚假消费 | 计量标识区分协议、字段、单位、范围和周期，变化时先建立新基准 | 旧历史不重算，退款净额未实现 |
| 刷新/预览反复遍历接口 | 缓存命中计划与单位元数据；明确未命中短缓存，预览和实时查询共享限流退避 | 手动重探测不能绕过服务商限流 |
| 旧预览错误确认新表单 | 候选证明绑定草稿、配置与来源，限时单次使用；迟到或来源变化后失效 | 预览不写账本，不顺带提交未保存的价格 |
| 并行聊天或失败后弹出的金额归属不明 | 账户新增批次独立于单轮状态、token 和价格估算；首样本建基准，后续持久化去重，暂停展示期间合并累计 | 账户差额可能来自其他聊天、设备或延迟入账，不能全算给某轮；失败或取消仍可能收费 |
| 极小金额显示舍入导致遗漏 | 内部保留金额精度，界面按显示规则呈现，小额增量继续参与累计 | 显示两位小数不代表内部只保存两位；账本仍不是服务商完整流水 |

自动探测注册表的 **13 项是来源记录**，包含别名、双请求账单、匿名单位元数据及管理接口条件，不是十三个品牌分别实测。普通推理 key 不默认试探管理接口。见 [协议来源表](BALANCE-PROTOCOL-SOURCES.md) 和 [自动检测说明](AUTO-PROBE-FIXED.md)。

## 尚未实现与主动不采用

| 对应讨论 | 当前状态 |
| --- | --- |
| [#118 PR](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/118) 输入框/侧栏避让 | 依赖 DSH DOM 的完整行为未移植 |
| [#160](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/160) / [#192](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/192) 提问、授权及阶段角色 | 尚无完整 Codex 等待交互/运行阶段事件链 |
| [#186](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/186) 点击提示跳转聊天 | 未实现 |
| [#175](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/175) 独立透明度 | 未提供人物与气泡各自的透明度设置 |
| [#166](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/166) / [#180](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/180) 厂商套餐模板 | 未提供对应命名套餐适配；余额协议不等于套餐窗口 |
| [#170](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/170) 通用额度回退 | 未实现 API→估算→手动额度回退，不拿本机 token 猜官方资金 |
| [#177](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/177) 全局空白点击关闭 | **主动不采用**，保留明确关闭、人物交互及提示自身超时，见 [设计决定](OUTSIDE-CLICK-DECISION.md) |

DSH 网页注入、市场安装、`allowCustomHost` 控件与主输入框 DOM 故障不是此独立 Electron 实现中的同一问题。#171/#199、#165/#176/#189、#183/#191/#193/#200、#179、#167 等适用性判断保留在 [v0.4 历史表](ISSUE-STATUS-0.4.md)，不计为本次新增修复。

## 证据与交付状态

| 实际执行 | 范围 |
| --- | --- |
| 510 项全量自动测试通过 | 执行于最终安装检查改动之前 |
| 随后 15 项针对测试通过，其中 3 项新增 | 覆盖最终安装检查等改动；不能写成“513 项全量重新执行” |
| Windows 原生验证 8 组，150% DPI | 包括启动、真实区域丢失、错误全窗区域、持续变化中静默失败、尺寸变化、合法大卡片、恢复预算和渲染无响应 |
| 真实小黄鸭素材离线验证 8 个场景 | 每秒 1/5/10/20 次点击的改动前后对照；20Hz 两秒操作的音源启动由 80 次降为 40 次，未出现数字削波；没有播放真实扬声器声音 |

本机短期观察记录中出现过 **1 次保护撤销并已恢复**，但保留记录没有该次具体故障原因。不能据此推断为原白屏重现、GPU 故障或某条代码分支，也不能写成“零保护事件”或长期零故障。

此前 fixed 的 482 项自动测试、9 项隐私门禁及 Electron 6 组流程/7 个布局样本/8 张截图属于历史证据；更早的 341 项、120 次边缘连击、18 次透明区对照和 52 个布局场景也不冒充本次重跑，不叠加计数。成品的隐私、哈希、文件范围和解压预检以本次随包报告为准。

当前发行目标为新公开仓库 main，使用独立新标签及Release，保留已有历史发行和上游仓库状态。安装与回滚见 [README](../README.md)，修复边界见 [已知问题](KNOWN-ISSUES-FIXIXED.md)。
