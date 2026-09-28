# For-Codex 分支上传说明

本次根据项目协作者的明确指示，将 Windows v0.2(fixed) 上传到 [MeteorNOX/DeepSeek-Balance-Whale-Widget 的 For-Codex 分支](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/tree/For-Codex)。内部版本保持 0.2.0。

## 权限与边界

- 上传账号 Yang-huai406 是协作者，当前具备 WRITE 权限，不是仓库所有者。
- 使用普通提交和 fast-forward push；不强推，不修改 main，不变更仓库设置/所有者。
- 用户随后明确追加授权创建 Release 和 tag：`v0.2.0-fixed`，指向本次 For-Codex 提交；作为公开、非草稿的 Windows/Codex Release，不设为仓库 Latest。
- 旧 0.2.4/macOS 工作保留历史和 archive/for-codex-0.2.4，供后续整合；没有把这些平台成果纳入本次 Windows 安装包。
- 用户授权上传不等于所有空白的人工验收项目都已通过；测试记录按实际结果填写。

## 分支中的材料

- README.md：功能、安装、取消结算、恢复显示和平台边界。
- CHANGELOG.md、RELEASE_NOTES.md：本次变更与分支说明。
- docs/DEVELOPMENT_SUMMARY.md：两阶段对话的脱敏摘要及后续实机反馈。
- docs/USER_TEST_CHECKLIST.md、docs/VALIDATION.md：人工复查清单和自动检查记录。
- PROVENANCE.md、LICENSE、THIRD_PARTY_NOTICES.md：来源和许可边界。
- .github/ISSUE_TEMPLATE：保留仓库既有模板配置，并使用不索取凭据的缺陷表。
- packages/v0.2-fixed：安装 ZIP、SHA-256 和文件清单。

## 后续复查或回退

从分支下载安装 ZIP，核对其 SHA-256，按 README 安装。发现问题时保留最小复现步骤和已脱敏的错误类别。

若需要回退本次分支上传，应在保留后续协作者提交的前提下使用 Git revert 创建新的撤销提交；不要强制重置远端历史。安装回滚则使用本机安装回执，二者作用范围不同。

Release 和 tag 已按后续明确授权纳入本次交付；其他平台合并、main 分支和仓库设置变更仍不在范围内。