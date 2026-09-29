# v0.3(fixed) GitHub 发布说明

本版先完成本地安装包、源码包和公开材料准备，随后用户已明确授权上传 `For-Codex` 分支并创建新 tag 与 Release。本次发布使用 `codex-v0.3.0-fixed.2`，Release 名称为 **Codex-v0.3(fixed)**。发布授权不等于用户测试清单全部通过；尚未验收的项目继续保留。

## 目标与身份

- 仓库：[MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)
- 目标分支：`For-Codex`
- 发布协作者：[Yang-huai406](https://github.com/Yang-huai406)；仓库所有者仍为 [MeteorNOX](https://github.com/MeteorNOX)
- 版本展示名称：`v0.3(fixed)`；Release 标题：`Codex-v0.3(fixed)`
- 本次插件构建标识：`0.3.0+codex.20260929173027`，不因文档整理而更改
- 本次新标签：`codex-v0.3.0-fixed.2`；旧标签 `codex-v0.3.0-fixed` 及其既有 Release 保留
- 不覆盖主线或 Codex 分支的已有 tag；保持主线 `v0.3.17` 为仓库 Latest

发布前已核验协作者账号具有推送权限、没有仓库管理权限，`For-Codex` 未受分支保护，远端与本地基线一致，且新标签尚未被占用。正式写入前仍需防止远端并发更新；此文档描述发布目标和流程，不据此宣称远端操作已经完成。

## Release 附件

- `api-balance-whale-v0.3(fixed).zip`
- `api-balance-whale-v0.3(fixed)-source.zip`
- 两份对应的 `.sha256` 文件
- `release-manifest.json`
- `verification-report.json`：成品解压测试、安装预检、媒体一致性及重建校验摘要

安装包不内置 Electron 运行时，首次安装获取运行时需要联网。文件名中的括号是名称的一部分，在命令行操作时应引用完整文件名。

README 为首页，RELEASE_NOTES 为本次 Release 正文；[开发摘要](DEVELOPMENT_SUMMARY.md)、[验证记录](VERIFICATION-0.3.md)、[用户测试清单](USER_TEST_CHECKLIST.md) 和 [空白点击设计决定](OUTSIDE-CLICK-DECISION.md) 说明本版的最终行为与限制。ATTRIBUTION、PROVENANCE、LICENSE 和 THIRD_PARTY_NOTICES 保留版权及来源。

继续保留 [macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)、贡献者 [1llysviel](https://github.com/1llysviel) 署名与兼容实现。Mac 实机、真实订阅账号及长期显示稳定性仍待验收，不因发布而改为已通过。

## 重建发布包

在仓库根目录使用 Python 3.10+：

```sh
python scripts/build-release.py --release-tag codex-v0.3.0-fixed.2
```

构建命令只生成带本次标签元数据的本地附件，不自行推送或创建 Release。构建输出到根目录 `dist`，校验 ZIP、散列和公开文件清单；排除 Git 元数据、历史包、运行数据、个人回执、私密配置、聊天媒体及测试原始材料。`vendor/smol-toml/dist` 是运行依赖，不能因目录名为 dist 而误删。

打包器按 `.gitattributes` 统一文本换行：普通源码和 Mac 启动器使用 LF，Windows `.cmd` / `.ps1` 使用 CRLF。这样从 Git 提交导出树重建，不受工作区原有换行格式影响。媒体只清理非渲染元数据，不改变图像帧和音频内容。

解压源码包后按 [验证记录](VERIFICATION-0.3.md) 复验，再由用户按清单实际试装。构建清单记录文件与散列，不代替用户使用验收。

## 本次发布步骤

以下操作已获得用户本次授权，按顺序核验并执行；完成情况以实际远端结果为准：

1. 重新读取远端 `For-Codex`、已有 tag 和 Release；核对协作者权限、分支策略及其他人的新提交。
2. 确认 `codex-v0.3.0-fixed.2` 仍未被并发占用；若远端状态改变，先核对差异，不移动或覆盖已有标签。
3. 对最终内容完成差异检查与必要验证，确认安装包、源码包、散列、构建号及 Release 文案一致。使用本次新标签生成发布元数据。
4. 根据仓库策略通过普通提交与快进推送，或走 PR；不改写其他协作者工作。目标仍为 `For-Codex`。
5. 创建本次新 tag 和名为 `Codex-v0.3(fixed)` 的 Release，上传附件；核对目标提交、标题、附件和散列，保留未验收项目，并确认主线 `v0.3.17` 仍为仓库 Latest。

本文件不宣称任何与 Issue #177 相关的 PR 已合并。空白点击关闭在本版中已主动撤回，具体范围以 [设计决定](OUTSIDE-CLICK-DECISION.md) 为准。
