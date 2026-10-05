# Codex-Whale 待办与验收清单

2026-10-05 公开前复核整理。优先级用于分流，不是发布日期承诺。此轮只审查和建单，没有实施功能修复。原讨论作者与来源见各单，未关闭或编辑上游事项。

## 公开前处理与来源核对

| 待办 | 类型 |
| --- | --- |
| [[公开前] 核定并处理历史图片中的 XMP 作者与外部标识元数据](https://github.com/Yang-huai406/Codex-Whale/issues/11) | 公开前处理 |
| [[公开前复核] 补充媒体来源及适配版本的分发依据](https://github.com/Yang-huai406/Codex-Whale/issues/12) | 来源核对 |

## 核心验收与调查

| 待办 | 类型 |
| --- | --- |
| [[P1] 明确退款净支出与观测消费的统计语义](https://github.com/Yang-huai406/Codex-Whale/issues/1) | P1 / 统计语义设计 |
| [[P1 验证] 完成真实订阅账户及额度窗口切换验收](https://github.com/Yang-huai406/Codex-Whale/issues/2) | P1 / 实机验收 |
| [[P1 验证] 完成 macOS 安装、插件注册和回滚验收](https://github.com/Yang-huai406/Codex-Whale/issues/3) | P1 / Mac 安装集成验收 |
| [[P1 验证] 补齐多屏、DPI、恢复及长期显示稳定性记录](https://github.com/Yang-huai406/Codex-Whale/issues/4) | P1 / 显示稳定性实测 |
| [[P1 验证] 完成实际发行包的干净安装与公开下载验收](https://github.com/Yang-huai406/Codex-Whale/issues/5) | P1 / 安装发行验收 |
| [[P2 验证] 验证真实余额服务的认证、单位及候选确认](https://github.com/Yang-huai406/Codex-Whale/issues/6) | P2 / 服务兼容实测 |
| [[P2] 明确跨日观测区间与逐日账本的边界](https://github.com/Yang-huai406/Codex-Whale/issues/7) | P2 / 账本区间说明与设计 |
| [[P2 验证] 验证 macOS 音频睡眠断言与唤醒恢复](https://github.com/Yang-huai406/Codex-Whale/issues/8) | P2 / Mac 睡眠实测 |
| [[P2 调查] 复现故障音频设备闲置后的首音裁切](https://github.com/Yang-huai406/Codex-Whale/issues/9) | P2 / 故障设备调查 |
| [[P2 调查] 定位双重音效的事件与播放来源](https://github.com/Yang-huai406/Codex-Whale/issues/10) | P2 / 待复现故障 |

## 候选功能与范围决定


| 优先级 | 候选 | 最小验收/决策条件 | 原来源 |
| --- | --- | --- | --- |
| P3 | 共享台词池 | 定义真正引用、编辑联动、删池行为、导入导出；不把复制当共享。名称往返子问题已修。 | [#108](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/108)，mengge237，open。 |
| P3 | 等待授权/提问和运行阶段角色 | 先验证 Codex 可用事件源；runtime/session-monitor.mjs:10 当前匹配启动/结束/错误等，并无完整授权链。区分未知状态，多聊天去重，无事件不得凭推测显示等待授权。 | [#160](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/160)，Jy-EggRoll，closed；[#192](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/192)，GBDJXB，open。 |
| P3 | 点击通知回到对应聊天 | 验证受支持的聊天定位机制、多个聊天/失效目标及失败提示；链接输入需限制，不能任意打开本机资源。 | [#186](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/186)，QQB-Roy，open。 |
| P3 | 人物/气泡独立透明度 | 独立保存/恢复，极端透明度仍能操作菜单，命中/穿透不退化；当前渲染淡入淡出不等于用户透明度设置。 | [#175](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/175)，tev6，open。 |
| P3 | 厂商命名套餐与额度回退 | 先确认用户需求/真实协议。API、估算、手动三种来源明确分开；未知不记零、本机 token 不推算官方资金；模板标明适用版本/单位/窗口。 | [#166](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/166)，wedfrgt；[#180](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/180)，starkwentt321；[#170](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/170)，mengge237；均 open。 |
| 先研究适用性 | 输入框/侧栏避让 | 原 PR 依赖 DSH DOM；先证明独立桌面挂件可可靠取得区域，无区域则回退，不能直接承诺照搬。 | [PR #118](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/118)，catnipluss，open。 |
| 暂不纳入桌面路线 | Android WebView/长按 | 当前是 Electron 桌面版；共用 pointercancel 修复不代表 Android 平台支持。只有明确开展 Android 端才建平台项目。 | [#79](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/79)，cmyfqwq，open。 |

## 明确不做及排除

- [#177](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/177)：Roelatriper，closed。全局空白点击统一关闭是主动不采用，见 OUTSIDE-CLICK-DECISION.md；不要放回开发清单。保留明确关闭、人物交互、已有超时与底层点击穿透。
- DSH 网页注入、市场安装、allowCustomHost、主输入框 DOM 故障，不直接复制为独立 Electron 的 bug。
- 不自动校正/回填旧账本，不以余额净变化凭空拆分充值、退款与消费；如果以后需要，另行设计可靠数据源。
- 不把历史测试数字相加，不把 Windows 合成验证当 Mac/全部服务商验收。



公开条件见 [公开前复核](PREPUBLIC-REVIEW.md)，当前功能限制见 [已知问题](KNOWN-ISSUES-FIXED.md)。Mac/真实订阅等硬件验收缺口可在明确标注限制时保留，不等同于隐私元数据的公开前处理项。
