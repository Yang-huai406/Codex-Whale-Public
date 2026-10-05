# Codex-Whale 迁移准备与后续发布流程

当前独立仓库为 [Yang-huai406/Codex-Whale](https://github.com/Yang-huai406/Codex-Whale)，由 Yang-huai406 维护，默认分支为 `main`。仓库当前私有，是否公开由维护者后续决定。本次迁移保留原始提交和作者信息；建库与迁移授权不代表已发布新版安装包。

## 当前基线与历史发行

| 项目 | 值 |
| --- | --- |
| 当前代码基线 | `7fa45961c0e0bacc9bb08737f73b4491399956b0` |
| 对外名称 | `Codex-v0.4(fixed)` |
| 内部版本 | `0.4.1`，插件/package/lockfile/runtime 一致 |
| 构建标识 | `auto-probe-fixed-20261005` |
| 历史上游标签 | `codex-v0.4.0(fixed)` |
| 新仓库安装包 | 尚未独立发行 |

现有安装包见[上游历史发行](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/releases/tag/codex-v0.4.0%28fixed%29)。它保留当时的仓库身份，不能把该包称为本仓库新构建的安装包。上游作者和原仓库所有者是 MeteorNOX，当前独立仓库所有者及 Codex 适配维护者是 Yang-huai406；保留 [1llysviel 的 macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)、原版权和素材来源。

## 迁移边界

- 日常代码与文档更新提交到新仓库 `main`；迁移使用完整 Git 历史，不以 ZIP 重建根提交、不压平作者记录。
- 原仓库分支、标签、Release、Issue、PR 与 Latest 保持原状。对原非当前维护者所有的仓库进行修改、删除、迁移提示或其它重要操作前，必须征询用户意见。
- 旧标签不可移动、覆盖或重新指向迁移文档提交。新仓库后续发布须选择新的版本和标签，并先更新构建器及相关版本元数据；当前构建器仍绑定历史 fixed 标签，不能直接当作新版本发布流程。
- Git 历史迁移不等于迁移 GitHub Issue、PR 和 Release 附件。历史资料用原链接追溯，后续 Codex 问题在新仓库维护。

## 本地构建与隐私检查

需要 Python 3.10+，Node.js 24+ 用于运行和开发测试。下面仅为复核历史 fixed 基线的构建命令，不创建标签、不推送、不发布：

```powershell
python scripts/build-release.py --release-tag "codex-v0.4.0(fixed)"
```

默认输出 `dist`。迁移改过文档的源码树与上游历史包不同，重新生成的包不能冒充旧包，也不能覆盖旧 Release 附件。`--publication-ready` 只在本次具体发行得到授权并完成检查后使用；`published: false` 是本地构建快照，实际远端状态以对应仓库 Release 为准。

核对安装包、源码包、各自 SHA-256、`release-manifest.json` 以及本次检查形成的 `verification-report.json`。检查解压路径、版本与构建标识、入口脚本、README、文件清单和哈希，不伪造未执行的验收。

公开包不得含用户配置、密钥、账本、原始聊天、日志、测试截图录屏、私有安装回执、本机备份、缓存、Electron 下载、嵌套旧包或 `.git`。即使仓库当前私有，也不应把这些本机数据作为迁移内容。公开包检查与完整 Git 历史检查是不同范围，不能互相替代；接收者安装时生成自己的私有回执。

基线已有 482 项自动测试、9 项隐私门禁及 Electron 6 组流程、7 个布局样本、8 张截图的通过记录。这些是历史验证；仅整理文档时不宣称重新执行了全套测试。合成测试不代表 Mac 实机、全部真实第三方账号或长期运行验收。

## 后续新发行

1. 确认新仓库状态、待发布提交、新版本及未占用的新标签；仓库是否公开另行决定，不把迁移自动当作公开授权。
2. 更新版本、构建器约束、README 与 [RELEASE_NOTES.md](../RELEASE_NOTES.md)，确保正文对应新发行，而非照搬历史 fixed 发布身份。
3. 完成适当测试、构建、隐私与成品检查，将待发布提交与实际包、哈希、验证报告绑定。
4. 仅向 `Yang-huai406/Codex-Whale` 推送获授权的新标签和发行。新仓库的 Latest 按该次发行安排设置；不得操作原仓库 DSH Latest。
5. 上传并核验远端标签目标、附件哈希和下载链接。只有完成后才记录实际发布时间及结果；保留旧发行历史，不批量宣称未验收平台或部分 issue 已完成。

当前能力和限制见 [fixed 说明](AUTO-PROBE-FIXED.md)、[issue 状态表](ISSUE-STATUS-FIXED.md) 和 [README](../README.md)。
