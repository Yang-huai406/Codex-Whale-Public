# 开发与净化发行时间线

保留真实原始发布日期与演进顺序，图片元数据已清理。GitHub显示的本页创建日期是净化副本创建日期，原日期见各Release前言。仓库已于 2026-10-05 经维护者授权公开。

7个Release，38个历史附件（5个经净化及校验更新）加14个核验文件，共52附件。原提交SHA与附件摘要不可直接用于本副本，见 [净化记录](SANITIZATION.md)。

| 原始日期（北京时间） | 历史版本 | 原附件数 | 净化改动附件数 |
| --- | --- | --- | --- |
| 2026-09-18 00:04:53 | [Codex-v0.2.0](https://github.com/Yang-huai406/Codex-Whale-Public/releases/tag/codex-v0.2.0) | 1 | 1 |
| 2026-09-22 18:46:20 | [Codex v0.2.4（新增 macOS 支持）](https://github.com/Yang-huai406/Codex-Whale-Public/releases/tag/codex-v0.2.4) | 1 | 1 |
| 2026-09-28 19:26:12 | [Codex-v0.2(fixed)](https://github.com/Yang-huai406/Codex-Whale-Public/releases/tag/Codex-v0.2%28fixed%29) | 3 | 3 |
| 2026-09-29 03:29:34 | [Codex-v0.3](https://github.com/Yang-huai406/Codex-Whale-Public/releases/tag/codex-v0.3.0-fixed) | 6 | 0 |
| 2026-09-30 02:07:24 | [Codex-v0.3(fixed)](https://github.com/Yang-huai406/Codex-Whale-Public/releases/tag/codex-v0.3.0-fixed.2) | 6 | 0 |
| 2026-10-05 03:47:35 | [Codex-v0.4](https://github.com/Yang-huai406/Codex-Whale-Public/releases/tag/codex-v0.4.0) | 10 | 0 |
| 2026-10-05 20:02:13 | [Codex-v0.4(fixed)](https://github.com/Yang-huai406/Codex-Whale-Public/releases/tag/codex-v0.4.0%28fixed%29) | 11 | 0 |

## 标签及提交映射

原有9个标签名称保留；codex-v0.3.0、v0.2.0-fixed原本只有标签，不虚构历史Release。

| 标签 | 原始提交 | 净化提交 |
| --- | --- | --- |
| `Codex-v0.2(fixed)` | `2a7dac2` | [`91e842c`](https://github.com/Yang-huai406/Codex-Whale-Public/commit/91e842c11c73ec4580ca8b170375361b28105d95) |
| `codex-v0.2.0` | `156abe6` | [`629c510`](https://github.com/Yang-huai406/Codex-Whale-Public/commit/629c5105b812f89c8ceadda61c7453a4f992488a) |
| `codex-v0.2.4` | `8de181a` | [`7a408f9`](https://github.com/Yang-huai406/Codex-Whale-Public/commit/7a408f97422fbb00182f0f997ece623acde96c08) |
| `codex-v0.3.0` | `51f88c6` | [`9cacef1`](https://github.com/Yang-huai406/Codex-Whale-Public/commit/9cacef1ecd6b85c42f6248a20d2efc27bba5ecca) |
| `codex-v0.3.0-fixed` | `e272050` | [`984dbbc`](https://github.com/Yang-huai406/Codex-Whale-Public/commit/984dbbc575f9223b3ae65bf45595cc561946e915) |
| `codex-v0.3.0-fixed.2` | `5a36d64` | [`2541a4d`](https://github.com/Yang-huai406/Codex-Whale-Public/commit/2541a4d193f4027c56ff000f20d03fba8e18a1e8) |
| `codex-v0.4.0` | `c86b055` | [`cb272ce`](https://github.com/Yang-huai406/Codex-Whale-Public/commit/cb272cefaf1816757fa2e20411a638d6838ef084) |
| `codex-v0.4.0(fixed)` | `7fa4596` | [`e1872a3`](https://github.com/Yang-huai406/Codex-Whale-Public/commit/e1872a31010735085bc3c82bee15656844e2b30e) |
| `v0.2.0-fixed` | `2a7dac2` | [`91e842c`](https://github.com/Yang-huai406/Codex-Whale-Public/commit/91e842c11c73ec4580ca8b170375361b28105d95) |

元数据清理不改变画面或为旧版补做功能测试。上游和原始私有档案未改；macOS来源继续保留 [PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)。

## 后续新功能发行

2026-10-08：[Codex-v0.4(fixixed)](https://github.com/Yang-huai406/Codex-Whale-Public/releases/tag/codex-v0.4.0%28fixixed%29)，内部0.4.1、构建surface-audio-fix-20261007。新增Windows原生区域保护、连点音效调度与安装就绪核验。这是基于已净化main的正常新提交，不重写上表历史版本、映射或附件。
