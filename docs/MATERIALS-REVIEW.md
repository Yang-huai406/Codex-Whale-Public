# 素材来源核对与待确认问题

核对日期：2026-10-05。仅只读查询上游并写入独立本地审查目录，没有联系作者或修改任何 Git 工作树/远端。

> 更新：2026-10-05，维护者已补充素材提供者回复及MP3保留确认。当前分发范围、EmoteLab来源、DSH2自制可分发及署名条件见 [素材分发说明](MATERIALS-PERMISSION.md)。下文保留此前技术比对结果；旧的“待确认/尚未发送”描述属于取得回复前的审查阶段。

## 范围与结论

当前 main 的 assets 共10项媒体。5项与固定上游字节一致；DSH2.png解码像素一致；3项音频可追溯到字节一致的For-Codex根提交；bubble-yue-money.gif与上游bubble-money1.gif不是相同动画，仍需确认来源。以上是来源核对，不是对权利链完整性的背书。

本报告覆盖当前媒体及发现差异所需历史节点；旧Release和其他历史blob的净化/扫描由单独核验覆盖，不能由本表推断旧附件不存在其他媒体。

## 固定许可声明

- [上游PROVENANCE](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/PROVENANCE.md)：代码MIT；图片/动图/音效不适用MIT，按“as-is 随插件分发，仅用于运行本插件；不授予再许可，也不声明为原创作品”。
- [上游LICENSE](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/LICENSE)：MIT对代码的许可不覆盖上述媒体例外。
- “本插件”是否涵盖独立维护的Codex桌面适配、历史发行包再分发以及为隐私清理重新编码，需要明确确认；现有声明没有完整覆盖证明。
- 作者/提供者可以确认其自己拥有权利的部分，但其同意不能自动补齐未知第三方素材权利。

## 逐项索引

| 当前文件 | 固定上游候选 | 核对结果及来源声明 |
| --- | --- | --- |
| assets/bubble-petpet.gif | [bubble-petpet.gif](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/assets/bubble-petpet.gif) | 字节一致；上游称内置动图，未列原作者/素材站条款。 |
| assets/bubble-yue-money.gif | [bubble-money1.gif](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/assets/bubble-money1.gif) | 不匹配该候选：当前41帧300×300，上游86帧500×399；不能声称只是改名。For-Codex根提交已有同名图；根图与当前全部RGBA帧及帧时长一致，但编码字节不同。原始权利来源仍未知。 |
| assets/D1.mp3 | [D1.mp3](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/assets/D1.mp3) | 当前字节不同；For-Codex根提交中的同名文件与固定上游字节一致，51f88c6中修改。证明历史来源链，不证明修改后声音或权利状态相同。 |
| assets/D2.mp3 | [D2.mp3](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/assets/D2.mp3) | 当前字节不同；For-Codex根提交中的同名文件与固定上游字节一致，51f88c6中修改。证明历史来源链，不证明修改后声音或权利状态相同。 |
| assets/DSH2.png | [DSH2.png](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/assets/DSH2.png) | 文件字节不同，完整RGBA像素相同；上游称维护者自行设计与排版。元数据清理不等于获得分发授权。 |
| assets/DSniang02.png | [DSniang02.png](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/assets/DSniang02.png) | 字节一致；上游声明同DSniang1.png。 |
| assets/DSniang1.png | [DSniang1.png](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/assets/DSniang1.png) | 字节一致；上游称AI生成、人工挑选裁切，但生成工具和原始出处不可考。 |
| assets/rua.gif | [rua.gif](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/assets/rua.gif) | 字节一致；与 bubble-petpet.gif 也完全相同。上游称内置动图。 |
| assets/Ya1.mp3 | [Ya1.mp3](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/assets/Ya1.mp3) | 当前字节不同；For-Codex根提交中的同名文件与固定上游字节一致，51f88c6中修改。证明历史来源链，不证明修改后声音或权利状态相同。 |
| assets/Ya2.mp3 | [Ya2.mp3](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/770d3f55ff40284eb244fff33fc9ed4654be8a45/assets/Ya2.mp3) | 字节一致；上游仅称内置按压/松开音效。 |

核对依据与固定来源见下列链接；本地审查保留完整比对数据。

历史依据：

- [For-Codex根提交 b9e168d](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/tree/b9e168d3dd6c04e660567cb8c96f4b0bdeeb45e8/assets)：3项音频与固定main同名素材blob一致；bubble-yue-money.gif原始blob为0756d289f3cdc5a87560920b2526ae1271df0b70。
- [音频修改提交 51f88c6](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/commit/51f88c6e14f15174d0d6d4fd3d238cf00fd88119)：D1/D2/Ya1变化。
- [动画修改提交 5a36d64](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/commit/5a36d6442d272cd7fea255206f2abcd697a87563)：bubble-yue-money.gif字节变化，但根版本至当前41帧RGBA及帧时长全部一致。

上游有 minecraft-exp-orb.wav、task-end-a.wav，当前Codex assets没有这些文件；不能将这些上游文件当作当前Codex发行内容或给它们附加授权结论。

## 给月匠的待确认问题（供用户自行发送，尚未发送）

1. 是否同意在独立的 Codex-Whale 仓库、安装包和历史Release中继续随挂件分发你提供/有权授权的媒体，并保留来源和署名？是否允许清除设计工具账号元数据后重新打包？
2. bubble-yue-money.gif 的原始来源是什么？它与main的bubble-money1.gif不是同一动画，可否提供作者、素材链接和允许分发/修改的条款？
3. rua/bubble-petpet动图与D1/D2/Ya1/Ya2音效，能否补充原始作者、来源链接、取得方式及再分发条款？只有“内置素材”还无法说明这些依据。
4. 鲸鱼PNG的生成工具记录确实无法恢复时，有无其他可支持分发的记录？DSH2中使用的图形、字体、模板是否允许随独立适配项目及历史包分发？署名是否有指定格式？

## 建议

- 技术净化照常完成，原始档案继续私有。保留作者历史，避免把清除编辑器归因元数据写成更换作品作者。
- 将 #12 保持待确认状态，记录本次已解决的来源对应和仍未知的权利范围；不声称全部素材已获授权。
- 用户收到确认后保存可追溯记录；仍无法确认的素材可选替换成有明确分发许可的素材，再决定公开范围。仅换当前素材不能消除公开旧历史和旧Release中的相同素材，因此若选择替换路线须覆盖拟公开历史与附件。
- 仓库公开及任何上游操作由用户决定；本轮不代发问题、不公开仓库。
