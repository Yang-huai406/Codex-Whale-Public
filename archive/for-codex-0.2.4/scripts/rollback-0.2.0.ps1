param(
    [Parameter(Mandatory = $true)][string]$Backup,
    [switch]$CheckOnly,
    [switch]$Force
)
# ============================================================================
# api-balance-whale 0.2.0 -- 通用回滚脚本
# ----------------------------------------------------------------------------
# 把升级前备份的插件目录覆盖回当前插件目录。只处理插件代码目录：
#   * 不会删除或覆盖用户数据目录（%USERPROFILE%\.codex\whale-widget）
#   * 不会修改计划任务、Codex 配置或系统设置
#   * 核验失败即停止，不做部分覆盖
#
# 用法：
#   & .\scripts\rollback-0.2.0.ps1 -CheckOnly -Backup <备份目录>
#   & .\scripts\rollback-0.2.0.ps1 -Backup <备份目录>
#   & .\scripts\rollback-0.2.0.ps1 -Backup <备份目录> -Force   # 挂件仍在运行时也覆盖，重启后生效
# ============================================================================
$ErrorActionPreference = 'Stop'
$whaleRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$whaleBackup = [IO.Path]::GetFullPath($Backup)
$whaleDataDir = if ($env:WHALE_HOME) { $env:WHALE_HOME }
    elseif ($env:CODEX_HOME) { Join-Path $env:CODEX_HOME 'whale-widget' }
    else { Join-Path $env:USERPROFILE '.codex\whale-widget' }

function Get-WhaleDigest([string]$Path) {
    $whaleStream = [IO.File]::OpenRead($Path)
    $whaleHasher = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($whaleHasher.ComputeHash($whaleStream)).Replace('-', '').ToLowerInvariant() }
    finally { $whaleHasher.Dispose(); $whaleStream.Dispose() }
}

if (!(Test-Path -LiteralPath $whaleBackup -PathType Container)) { throw "备份目录不存在：$whaleBackup" }
# 备份既可以是插件目录本身，也可以是含 api-balance-whale 子目录的外层目录；
# 清单里的路径既可能相对插件根，也可能带一层 api-balance-whale 前缀。下面自动识别。
$whaleManifest = Join-Path $whaleBackup 'backup-manifest.sha256'
if (!(Test-Path -LiteralPath $whaleManifest -PathType Leaf)) { throw "备份目录缺少 backup-manifest.sha256，拒绝覆盖：$whaleBackup" }
$whaleExpected = @()
foreach ($whaleLine in Get-Content -LiteralPath $whaleManifest -Encoding UTF8) {
    if (!$whaleLine.Trim()) { continue }
    $whaleParts = $whaleLine.Trim() -split '\s{2,}', 2
    if ($whaleParts.Count -ne 2) { throw "备份清单格式无效：$whaleLine" }
    $whaleExpected += [pscustomobject]@{ Hash = $whaleParts[0].Trim().ToLowerInvariant(); Relative = $whaleParts[1].Trim() }
}
if ($whaleExpected.Count -eq 0) { throw '备份清单为空，拒绝覆盖。' }

$whaleRootPrefix = ''
if ($whaleExpected[0].Relative -like 'api-balance-whale\*') { $whaleRootPrefix = 'api-balance-whale' }
$whaleSource = if ($whaleRootPrefix) { Join-Path $whaleBackup $whaleRootPrefix } else { $whaleBackup }
if (!(Test-Path -LiteralPath (Join-Path $whaleSource '.codex-plugin\plugin.json') -PathType Leaf)) {
    # 清单带前缀但目录层级不同时再退一步尝试。
    $whaleAlt = if ($whaleRootPrefix) { $whaleBackup } else { Join-Path $whaleBackup 'api-balance-whale' }
    if (Test-Path -LiteralPath (Join-Path $whaleAlt '.codex-plugin\plugin.json') -PathType Leaf) {
        $whaleSource = $whaleAlt
        $whaleRootPrefix = if ($whaleRootPrefix) { '' } else { 'api-balance-whale' }
    } else { throw "备份目录缺少 .codex-plugin\plugin.json，不是完整的插件备份：$whaleBackup" }
}

$whaleChecked = 0
foreach ($whaleEntry in $whaleExpected) {
    # 清单路径可能带一层 api-balance-whale 前缀，而 $whaleSource 已指向该目录。
    $whaleRelativeFromSource = $whaleEntry.Relative
    if ($whaleRootPrefix -and $whaleRelativeFromSource.StartsWith($whaleRootPrefix + '\')) { $whaleRelativeFromSource = $whaleRelativeFromSource.Substring($whaleRootPrefix.Length + 1) }
    $whaleFile = Join-Path $whaleSource $whaleRelativeFromSource
    if (!(Test-Path -LiteralPath $whaleFile -PathType Leaf)) { throw "备份文件缺失：$($whaleEntry.Relative)" }
    if ((Get-WhaleDigest $whaleFile) -cne $whaleEntry.Hash) { throw "备份文件校验失败：$($whaleEntry.Relative)" }
    $whaleChecked++
}
Write-Host ("备份校验通过：{0} 个文件，{1}" -f $whaleChecked, $whaleSource)

$whaleRunning = @(Get-Process -Name 'electron' -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*whale-widget*desktop-runtime*' })
if ($whaleRunning.Count -gt 0) {
    Write-Host '检测到挂件仍在运行。推荐先双击插件目录里的“停止挂件服务.cmd”，或托盘菜单“本次退出挂件”，然后再回滚。'
    if (!$CheckOnly -and !$Force) { throw '挂件仍在运行，未覆盖任何文件。确认可以覆盖时加 -Force（重启挂件后生效）。' }
    if ($Force -and !$CheckOnly) { Write-Host '已按 -Force 继续覆盖；请重启挂件让回滚生效。' }
}

if ($CheckOnly) {
    Write-Host '核验完成：备份完整。去掉 -CheckOnly 即会覆盖插件目录。'
    return
}

$whaleFiles = Get-ChildItem -LiteralPath $whaleSource -Recurse -File
foreach ($whaleFile in $whaleFiles) {
    $whaleRelative = $whaleFile.FullName.Substring($whaleSource.Length).TrimStart('\')
    $whaleTarget = Join-Path $whaleRoot $whaleRelative
    $whaleTargetDir = Split-Path -Parent $whaleTarget
    if (!(Test-Path -LiteralPath $whaleTargetDir -PathType Container)) { New-Item -ItemType Directory -Force -Path $whaleTargetDir | Out-Null }
    Copy-Item -LiteralPath $whaleFile.FullName -Destination $whaleTarget -Force
}
Write-Host ("回滚完成：{0} 个文件已覆盖到 {1}" -f $whaleFiles.Count, $whaleRoot)
Write-Host ("用户数据目录未改动：{0}" -f $whaleDataDir)
Write-Host '请重新打开 Codex，确认小鲸鱼出现且菜单可用。'
