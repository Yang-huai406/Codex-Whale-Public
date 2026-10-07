# Codex-v0.4(fixixed) 正式发行流程

**本次已获维护者明确授权，向新仓库 `main` 上传并发布独立 Release，作为最新稳定修复版。** 此流程记录获准的构建、上传及验证范围；实际远端完成状态以 GitHub 核验结果为准。

## 目标标识

| 项目 | 值 |
| --- | --- |
| 当前维护与发布仓库 | [Yang-huai406/Codex-Whale-Public](https://github.com/Yang-huai406/Codex-Whale-Public) |
| 目标分支 | `main` |
| 对外名称 / Release 标题 | `Codex-v0.4(fixixed)` |
| 发行标签 | 精确为 `codex-v0.4.0(fixixed)`，括号及 `fixixed` 拼写均属于名称 |
| 内部版本 | `0.4.1`，插件/package/lockfile/runtime 应一致 |
| 构建标识 | `surface-audio-fix-20261007` |
| 发布授权 | 已明确授权上传 `main`、创建本版标签与 Release |
| Latest 设置 | `makeLatest: true`；GitHub REST 为 `make_latest: "true"` |

新仓库所有者及当前维护者是 [Yang-huai406](https://github.com/Yang-huai406)。[MeteorNOX](https://github.com/MeteorNOX) 仍是原作者及[上游仓库](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)所有者；保留 [1llysviel](https://github.com/1llysviel) 的[上游 macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128) 与其他已有来源。项目从上游 For-Codex 适配线迁至独立仓库，本次准备目标是新仓库 `main`，不再向旧分支准备发布。上游 issue 链接和编号不迁移为新仓库同号 issue。

新仓库现有 fixed Release 和历史标签/附件保留，本版不覆盖它们。本次设置新仓库 Latest 为本稳定修复版；该设置独立于上游 DSH，不改变上游仓库的发行状态。

## 本地构建与隐私检查

需要 Python 3.10+；Node.js 24+ 用于运行和开发测试。不要以 Python 优化模式执行构建器，它会拒绝可能关闭检查的模式。

在源码根目录运行：

```powershell
python scripts/build-release.py --release-tag "codex-v0.4.0(fixixed)" --publication-ready
```

默认输出到 `dist`，可用 `--output "<本地输出目录>"` 指定位置。此命令将发行标签记录在本地清单，**构建器自身不创建 Git 标签，也不上传**。`--publication-ready` 记录本次明确发布授权，清单中 `publicationReady: true`。构建快照仍可为 `published: false`，表示生成当时尚未上传；它不是最终远端发布记录，应另行核验实际上传结果。

核对准备材料包括：

- `Codex-v0.4(fixixed).zip` 与 `Codex-v0.4(fixixed)-source.zip`。
- 包对应的 SHA-256、`release-manifest.json`。
- 本次 `verification-report.json`、隐私检查报告与汇总校验文件，只记录实际执行结果。
- GitHub 材料包：发行正文、详细 README、开发历程、issue/限制表、来源与许可、上传清单。它不是安装包。

安装包与源码包均须检查；源码包额外保留开发测试，安装包不含测试集。公开包排除用户配置、密钥、账本、聊天、原始日志、测试截图录屏、私有安装回执、缓存、Electron 下载、嵌套旧包和 `.git` 历史。只清理公开副本，不删除用户自己的资料或回滚备份。链接/junction 和异常文件按构建器规则处理，不手工跳过隐私检查。

解压到新的干净目录，核对 manifest/package/lockfile/runtime 版本、构建号、入口、README、文件清单及 SHA-256。使用 Windows PowerShell 运行 `scripts/install-package.ps1 -CheckOnly` 做接收者条件预检；预检不等于实际安装。每位接收者安装时生成自己的私有回执，公开包不能携带维护者回执。

## 验证记录口径

本轮曾通过 **510 项全量自动测试**；最终安装检查改动后另通过 **15 项针对测试，其中 3 项新增**。不可写成“513 项全量测试重跑”。Windows 真实原生场景完成 **8 组、150% DPI**，真实小黄鸭素材完成 OfflineAudioContext 每秒 1/5/10/20 次点击对照，未实际播放声音。

此前 fixed 的 482 项测试、9 项隐私门禁及 Electron 6 组流程/7 个布局样本/8 张截图只是历史记录。若本轮仅刷新文档与包装，沿用运行验证应明确说明，最终 ZIP 的新隐私/解压/完整性检查单列。测试不能证明所有驱动白屏根治、全部服务商可用或 Mac 实机通过。

安装后普通用户通过 `node scripts/control.mjs status` 核对 `0.4.1` / `surface-audio-fix-20261007`。Windows 正常显示后还要有 `rendererReady: true`、`surfaceGuard.verified: true`；主动暂停/等待 Codex 是允许的空闲状态，不能冒充可见窗口验证。不要把包含私有路径的完整状态或回执上传。

## 正文与标签准备

发行正文使用根目录 [RELEASE_NOTES.md](../RELEASE_NOTES.md)，详细使用说明使用 [README](../README.md)，本次功能对应 [issue 状态表](ISSUE-STATUS-FIXIXED.md)、[开发历程](DEVELOPMENT-FIXIXED.md) 和 [已知限制](KNOWN-ISSUES-FIXIXED.md)。保留 [白屏/音效专项说明](SURFACE-AUDIO-FIX-20261007.md) 和 [历史 fixed 自动检测说明](AUTO-PROBE-FIXED.md) 的上下文。

以下只检查标签格式与本地同名标签，不创建标签：

```powershell
git check-ref-format "refs/tags/codex-v0.4.0(fixixed)"
git tag --list "codex-v0.4.0(fixixed)"
```

括号标签在 shell 参数中保持引号。已有同名标签时先核对，不移动或覆盖。本版标签地址使用 `codex-v0.4.0%28fixixed%29` 进行 URL 编码；上传结束后核验全部发行链接可访问。源码包保留离线相对链接。

## 本次获准的发布步骤

1. 按本次明确授权读取远端分支、标签、Release、协作规则和当前账号权限，确认目标为 `Yang-huai406/Codex-Whale-Public` 的 `main`。
2. 确认精确标签尚未占用，检查最终差异、署名和来源。用普通提交或仓库要求的 PR 流程整理，不改写远端历史，不用 ZIP 覆盖整个仓库。基于新仓库当前 main 整理变更，保留迁移净化提交及其来源文档；不要把旧 For-Codex 工作目录的原始历史推入新仓库。
3. 将最终提交与已验收包绑定并核对清单/哈希，使用 `--publication-ready` 记录本次授权。构建器自身始终不上传。
4. 向 `Yang-huai406/Codex-Whale-Public` 推送获准的 `main` 更新，创建对应提交的精确标签 `codex-v0.4.0(fixixed)`，使用本次正文建立新正式 Release；设置 `prerelease: false`、`makeLatest: true`，GitHub REST 对应 `make_latest: "true"`。不覆盖现有 fixed Release。
5. 上传已核验安装包、源码包、校验和及清单/报告。GitHub 会规范化附件名称中的括号等字符，例如安装包可能显示为 `Codex-v0.4.fixixed.zip`；须读取实际远端名称，为实际下载名称另生成校验索引，保留原始制品哈希。Release 标题与 Git 标签仍保持精确原名，不能用附件名推断标签。
6. 下载附件核对哈希、检查标签目标、`main` 提交、新仓库 Release 与 Latest 状态及历史 fixed 未被覆盖。只有实际完成后才记录发布时间与 URL；部分 issue 和未验收平台不得批量宣称完成。

上传完成后记录实际提交、标签、Release URL、附件哈希与 Latest 核验结果。原迁移与净化导航继续保留：[发行历史](RELEASE-HISTORY.md)、[净化说明](SANITIZATION.md)、[历史提交映射](HISTORY-SANITIZATION.json)、[素材分发范围](MATERIALS-PERMISSION.md)。
