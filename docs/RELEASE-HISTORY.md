# Codex 小鲸鱼开发与发行时间线

这里按**原始发布时间（北京时间 UTC+8）**排列历史发行。新仓库迁移时重新创建 Release，因此 GitHub 页面显示的发布时间不是原始日期；每个页面顶部均记录原发布者、原日期与来源。仓库当前仍为私有，尚未向所有人开放。

7 个历史 Release 的原始标题、说明、预发行状态及 38 个附件完整保留，正文前新增迁移说明。附件没有重新打包；源附件、下载文件与新仓库附件的 SHA-256 核验一致。自动生成的 Source code 下载属于 GitHub 根据原标签生成的归档，不计入 38 个上传附件。

[最新 fixed 安装包所在发行页](https://github.com/Yang-huai406/Codex-Whale/releases/latest) · [全部发行](https://github.com/Yang-huai406/Codex-Whale/releases) · [全部标签](https://github.com/Yang-huai406/Codex-Whale/tags)

## 实际发行顺序

版本名保留历史原貌，不能只按名称大小推断发布日期。历史说明里的原仓库身份、Latest、测试结果和 issue 编号反映当时状态，不代表新仓库重测或同号 issue。

| 原始发布时间（北京时间） | 历史发行 | 演进内容 | 附件 | 来源 |
| --- | --- | --- | --- | --- |
| 2026-09-18 00:04:53 | [Codex-v0.2.0](https://github.com/Yang-huai406/Codex-Whale/releases/tag/codex-v0.2.0) | 早期 Codex 桌面适配与 API 余额小鲸鱼。 | 1 | [原发行](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/releases/tag/codex-v0.2.0) |
| 2026-09-22 18:46:20 | [Codex v0.2.4（新增 macOS 支持）](https://github.com/Yang-huai406/Codex-Whale/releases/tag/codex-v0.2.4) | 新增 macOS 支持，保留 PR #128 贡献。 | 1 | [原发行](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/releases/tag/codex-v0.2.4) |
| 2026-09-28 19:26:12 | [Codex-v0.2(fixed)](https://github.com/Yang-huai406/Codex-Whale/releases/tag/Codex-v0.2%28fixed%29) | Windows 修复与发布整理；版本名称沿用当时命名。 | 3 | [原发行](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/releases/tag/Codex-v0.2(fixed)) |
| 2026-09-29 03:29:34 | [Codex-v0.3](https://github.com/Yang-huai406/Codex-Whale/releases/tag/codex-v0.3.0-fixed) | v0.3 功能扩展与桌面交互修复。 | 6 | [原发行](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/releases/tag/codex-v0.3.0-fixed) |
| 2026-09-30 02:07:24 | [Codex-v0.3(fixed)](https://github.com/Yang-huai406/Codex-Whale/releases/tag/codex-v0.3.0-fixed.2) | 修复气泡显示与交互，撤回全局空白点击关闭。 | 6 | [原发行](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/releases/tag/codex-v0.3.0-fixed.2) |
| 2026-10-05 03:47:35 | [Codex-v0.4](https://github.com/Yang-huai406/Codex-Whale/releases/tag/codex-v0.4.0) | 并行账户新增消费去重与连续点击穿透修复。 | 10 | [原发行](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/releases/tag/codex-v0.4.0) |
| 2026-10-05 20:02:13 | [Codex-v0.4(fixed)](https://github.com/Yang-huai406/Codex-Whale/releases/tag/codex-v0.4.0%28fixed%29) | 连接隔离、金额口径校验、有界自动探测及候选采用。 | 11 | [原发行](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/releases/tag/codex-v0.4.0(fixed)) |

## 保留的 9 个标签

以下标签保持原大小写、原对象及原提交，不因迁移改写。只有标签而没有 Release 的节点照实记录，没有为它们虚构旧发行。

| 标签 | 原提交 | 发行状态 |
| --- | --- | --- |
| `Codex-v0.2(fixed)` | [`2a7dac2`](https://github.com/Yang-huai406/Codex-Whale/commit/2a7dac2945f3c29251aaf067831c501694a52193) | 历史 Release 已迁移 |
| `codex-v0.2.0` | [`156abe6`](https://github.com/Yang-huai406/Codex-Whale/commit/156abe6ace0ef2082a38332224f38fd2badde29b) | 历史 Release 已迁移 |
| `codex-v0.2.4` | [`8de181a`](https://github.com/Yang-huai406/Codex-Whale/commit/8de181abf5593247f32d57995567dd9f4063e049) | 历史 Release 已迁移 |
| `codex-v0.3.0` | [`51f88c6`](https://github.com/Yang-huai406/Codex-Whale/commit/51f88c6e14f15174d0d6d4fd3d238cf00fd88119) | 原仓库仅有标签，没有对应 Release |
| `codex-v0.3.0-fixed` | [`e272050`](https://github.com/Yang-huai406/Codex-Whale/commit/e2720500807ab847756f14d13ee0b8a30c682798) | 历史 Release 已迁移 |
| `codex-v0.3.0-fixed.2` | [`5a36d64`](https://github.com/Yang-huai406/Codex-Whale/commit/5a36d6442d272cd7fea255206f2abcd697a87563) | 历史 Release 已迁移 |
| `codex-v0.4.0` | [`c86b055`](https://github.com/Yang-huai406/Codex-Whale/commit/c86b055e8f24473ca76324d6e67145d65c596c41) | 历史 Release 已迁移 |
| `codex-v0.4.0(fixed)` | [`7fa4596`](https://github.com/Yang-huai406/Codex-Whale/commit/7fa45961c0e0bacc9bb08737f73b4491399956b0) | 历史 Release 已迁移 |
| `v0.2.0-fixed` | [`2a7dac2`](https://github.com/Yang-huai406/Codex-Whale/commit/2a7dac2945f3c29251aaf067831c501694a52193) | 原仓库仅有标签，没有对应 Release |

## 贡献与验证

保留 MeteorNOX 上游作者与版权、Yang-huai406 的适配历史，以及 1llysviel 的 [macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)。Release 的发布账号与 Git 提交作者是两类信息；复制发行不会改写 Git 原作者。

历史版本仅用于回看演进和必要的版本对照，安装优先使用最新版本。各版本的测试记录与已知限制原样保留，不把迁移校验当成功能重新验收。素材许可边界见 [来源说明](../PROVENANCE.md)。

各附件可用 [迁移校验清单](RELEASE-MIGRATION-MANIFEST.json) 的 SHA-256 核对。上游分支、Release 和附件没有被修改；Issue、PR 仍在原仓库。
