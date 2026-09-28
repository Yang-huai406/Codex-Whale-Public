# For-Codex 发布说明

## 本次发布

- 仓库：[MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)
- 目标分支：For-Codex
- 发布协作者：[Yang-huai406](https://github.com/Yang-huai406)，不代表仓库所有者。
- 独立标签：codex-v0.3.0；标题：Codex-v0.3.0。
- 不覆盖主线已有 v0.3.0 标签，不设置为整个仓库的 Latest。

用户已明确授权代码、tag 和 Release 上传。此前的本地候选流程已完成；Mac 实机、真实订阅账号和长期显示稳定性的未验证项仍保留，不因发布而改成“已通过”。

## Release 附件

api-balance-whale-v0.3.0.zip、api-balance-whale-v0.3.0-source.zip、两份 .sha256、release-manifest.json 和 verification-report.json。安装包不包含运行时，首次安装 Electron 需联网。

README 为首页，RELEASE_NOTES 为发布正文；DEVELOPMENT_SUMMARY 为本轮脱敏摘要，USER_TEST_CHECKLIST 用于后续验收，ATTRIBUTION/PROVENANCE/LICENSE/THIRD_PARTY_NOTICES 保留权属和来源。

## 重建

在仓库根目录使用 Python 3.10+：

```sh
python scripts/build-release.py --release-tag codex-v0.3.0
```

默认写入根目录 dist，排除 archive/packages 历史包、Git 元数据和本机数据。vendor/smol-toml/dist 是必要运行依赖，必须保留。源码包与安装包经过隐私检查、非必要媒体元数据处理和 ZIP 校验。

后续更新应先读取目标分支最新提交，以普通快进推送保留其他协作者工作。若仓库策略要求 PR，改走 PR，不改写分支历史。tag 和 Release 不覆盖已有同名对象。
