param([string]$DataDir, [switch]$NoStart, [switch]$NoStartup)
$ErrorActionPreference = 'Stop'
# The Windows ScheduledTasks provider is native to Windows PowerShell. Running
# registration through PowerShell 7's compatibility path can return E_FAIL for
# this GUI action. Use the supported host explicitly, with no console window.
if ($PSVersionTable.PSEdition -ne 'Desktop') {
    $whaleInstallerStart = [Diagnostics.ProcessStartInfo]::new()
    $whaleInstallerStart.FileName = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $whaleInstallerStart.UseShellExecute = $false
    $whaleInstallerStart.CreateNoWindow = $true
    $whaleInstallerStart.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $whaleInstallerStart.RedirectStandardOutput = $true
    $whaleInstallerStart.RedirectStandardError = $true
    foreach ($whaleArgument in @('-NoLogo','-NoProfile','-NonInteractive','-File',$PSCommandPath)) { $whaleInstallerStart.ArgumentList.Add($whaleArgument) }
    if ($DataDir) { $whaleInstallerStart.ArgumentList.Add('-DataDir'); $whaleInstallerStart.ArgumentList.Add($DataDir) }
    if ($NoStart) { $whaleInstallerStart.ArgumentList.Add('-NoStart') }
    if ($NoStartup) { $whaleInstallerStart.ArgumentList.Add('-NoStartup') }
    $whaleInstaller = [Diagnostics.Process]::new(); $whaleInstaller.StartInfo = $whaleInstallerStart
    try {
        if (!$whaleInstaller.Start()) { throw 'Windows PowerShell did not start.' }
        $whaleInstallerOutput = $whaleInstaller.StandardOutput.ReadToEndAsync()
        $whaleInstallerErrors = $whaleInstaller.StandardError.ReadToEndAsync()
        $whaleInstaller.WaitForExit()
        $whaleInstallerText = $whaleInstallerOutput.GetAwaiter().GetResult()
        $whaleInstallerErrorText = $whaleInstallerErrors.GetAwaiter().GetResult()
        if ($whaleInstallerText) { [Console]::Out.Write($whaleInstallerText) }
        if ($whaleInstallerErrorText) { [Console]::Error.Write($whaleInstallerErrorText) }
        if ($whaleInstaller.ExitCode -ne 0) { throw ('Windows PowerShell installer failed with exit code ' + $whaleInstaller.ExitCode + '. The task was not reported as installed.') }
    } finally { $whaleInstaller.Dispose() }
    return
}
$whaleRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (!$DataDir) { $whaleCodex = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }; $DataDir = if ($env:WHALE_HOME) { $env:WHALE_HOME } else { Join-Path $whaleCodex 'whale-widget' } }
$DataDir = [IO.Path]::GetFullPath($DataDir)
$whaleElectron = Join-Path $DataDir 'desktop-runtime\node_modules\electron\dist\electron.exe'
if (!(Test-Path -LiteralPath $whaleElectron)) { throw 'Please run install-desktop.mjs first.' }
$whalePowerShell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$whaleTaskName = 'Codex API Balance Whale'
$whaleScript = Join-Path $whaleRoot 'desktop\supervisor.ps1'
$whaleLegacyArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $whaleScript + '" -DataDir "' + $DataDir + '"'
$whaleQuotedData = '"' + [regex]::Replace($DataDir, '(\\+)$', '$1$1') + '"'
$whaleArguments = '--script "' + $whaleScript + '" --data ' + $whaleQuotedData
$whaleUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
# A normal upgrade may move from a verified Codex cache to the source tree (or
# vice versa). Data-directory identity and the GUI action remain exact; only
# registered plugin locations are accepted as previous supervisor roots.
$whaleTrustedScripts = @($whaleScript)
$whaleCanonicalRoot = Join-Path $env:USERPROFILE 'plugins\api-balance-whale'
$whaleCodexRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$whaleCacheRoot = Join-Path $whaleCodexRoot 'plugins\cache\personal\api-balance-whale'
$whaleCandidates = @($whaleCanonicalRoot)
if (Test-Path -LiteralPath $whaleCacheRoot -PathType Container) {
    foreach ($whaleDirectory in Get-ChildItem -LiteralPath $whaleCacheRoot -Directory) {
        if ($whaleDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        try {
            $whaleCachedManifest = Get-Content -LiteralPath (Join-Path $whaleDirectory.FullName '.codex-plugin\plugin.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($whaleCachedManifest.name -ceq 'api-balance-whale' -and $whaleCachedManifest.version -ceq $whaleDirectory.Name) { $whaleCandidates += $whaleDirectory.FullName }
        } catch { }
    }
}
foreach ($whaleCandidateRoot in $whaleCandidates) {
    try {
        if ((Get-Item -LiteralPath $whaleCandidateRoot -Force -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        $whaleCandidateManifest = Get-Content -LiteralPath (Join-Path $whaleCandidateRoot '.codex-plugin\plugin.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $whaleCandidateScript = Join-Path $whaleCandidateRoot 'desktop\supervisor.ps1'
        if ($whaleCandidateManifest.name -ceq 'api-balance-whale' -and (Test-Path -LiteralPath $whaleCandidateScript -PathType Leaf)) { $whaleTrustedScripts += $whaleCandidateScript }
    } catch { }
}
$whaleExistingTask = Get-ScheduledTask -TaskName $whaleTaskName -ErrorAction SilentlyContinue
if ($whaleExistingTask) {
    $whaleActions = @($whaleExistingTask.Actions)
    if ($whaleActions.Count -ne 1) { throw 'Scheduled task has unexpected actions.' }
    $whalePreviousAction = $whaleActions[0]
    $whaleIsLegacy = $false; $whaleIsGui = $false
    foreach ($whalePriorScript in $whaleTrustedScripts) {
        $whalePriorLegacy = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $whalePriorScript + '" -DataDir "' + $DataDir + '"'
        $whalePriorGui = '--script "' + $whalePriorScript + '" --data ' + $whaleQuotedData
        if ($whalePreviousAction.Execute -ieq $whalePowerShell -and $whalePreviousAction.Arguments -ieq $whalePriorLegacy) { $whaleIsLegacy = $true }
        if ([IO.Path]::GetDirectoryName($whalePreviousAction.Execute) -ieq (Join-Path $DataDir 'native') -and [IO.Path]::GetFileName($whalePreviousAction.Execute) -match '^WhaleLauncher-[0-9a-f]{20}\.exe$' -and $whalePreviousAction.Arguments -ieq $whalePriorGui) { $whaleIsGui = $true }
    }
    if (!$whaleIsLegacy -and !$whaleIsGui) { throw 'Scheduled task belongs to another installation.' }
}
$whaleLauncher = & (Join-Path $PSScriptRoot 'build-launcher.ps1') -DataDir $DataDir
if (!$whaleLauncher -or !(Test-Path -LiteralPath $whaleLauncher -PathType Leaf)) { throw 'The GUI launcher is unavailable.' }
$whaleAction = New-ScheduledTaskAction -Execute $whaleLauncher -Argument $whaleArguments -WorkingDirectory $DataDir
$whalePrincipal = New-ScheduledTaskPrincipal -UserId $whaleUser -LogonType Interactive -RunLevel Limited
$whaleSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval ([TimeSpan]::FromMinutes(1)) -StartWhenAvailable
if ($NoStartup) { $whaleTask = New-ScheduledTask -Action $whaleAction -Principal $whalePrincipal -Settings $whaleSettings -Description 'Per-user Codex balance companion. No web server.' }
else { $whaleTrigger = New-ScheduledTaskTrigger -AtLogOn -User $whaleUser; $whaleTask = New-ScheduledTask -Action $whaleAction -Trigger $whaleTrigger -Principal $whalePrincipal -Settings $whaleSettings -Description 'Per-user Codex balance companion. Starts independently of Codex and follows its windows.' }
# Register and verify before stopping a usable monitor. A failed registration
# must not turn a working companion into a missing one or write a success receipt.
try {
    if ($whaleExistingTask -and !$NoStartup) {
        # Keep the existing principal, triggers, restart policy and execution limits.
        $null = Set-ScheduledTask -TaskName $whaleTaskName -Action $whaleAction -ErrorAction Stop
    } else {
        $null = Register-ScheduledTask -TaskName $whaleTaskName -InputObject $whaleTask -Force -ErrorAction Stop
    }
    $whaleRegisteredTask = Get-ScheduledTask -TaskName $whaleTaskName -ErrorAction Stop
    $whaleRegisteredActions = @($whaleRegisteredTask.Actions)
    if ($whaleRegisteredActions.Count -ne 1 -or $whaleRegisteredActions[0].Execute -ine $whaleLauncher -or $whaleRegisteredActions[0].Arguments -cne $whaleArguments) {
        throw 'Task Scheduler did not retain the expected GUI launcher action.'
    }
} catch {
    throw ('Windows could not register or verify the Codex whale task. The running monitor and its settings were not stopped or replaced. Task Scheduler reported: ' + $_.Exception.Message)
}
# A verified replacement task now exists; stop the previous worker gracefully.
& (Join-Path $whaleRoot 'desktop\supervisor.ps1') -DataDir $DataDir -Stop
for ($whaleAttempt=0; $whaleAttempt -lt 60; $whaleAttempt++) {
    $whaleStateFile = Join-Path $DataDir 'supervisor-state.json'
    if (!(Test-Path -LiteralPath $whaleStateFile)) { break }
    try { $whalePrevious=Get-Content -LiteralPath $whaleStateFile -Raw | ConvertFrom-Json; $whalePreviousProcess=Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$whalePrevious.pid) -ErrorAction SilentlyContinue } catch { $whalePreviousProcess=$null }
    # CIM may briefly retain a process row without CommandLine while it exits.
    # Never dereference that value, and never terminate an unverified PID.
    if (!$whalePreviousProcess -or [string]::IsNullOrEmpty($whalePreviousProcess.CommandLine) -or !$whalePreviousProcess.CommandLine.Contains($whaleScript)) { Remove-Item -LiteralPath $whaleStateFile -ErrorAction SilentlyContinue; break }
    Start-Sleep -Milliseconds 200
}
if ((Get-ScheduledTask -TaskName $whaleTaskName -ErrorAction Stop).State -eq 'Running') { Stop-ScheduledTask -TaskName $whaleTaskName -ErrorAction Stop }
@{ enabled=$true; pluginRoot=$whaleRoot; electronPath=$whaleElectron; powerShellPath=$whalePowerShell; launcherPath=$whaleLauncher; taskName=$whaleTaskName; mode='follow-codex'; revision='follow-v3'; launchMode='winexe-create-no-window' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DataDir 'follow-config.json') -Encoding utf8
$whaleStartup = Join-Path ([Environment]::GetFolderPath('Startup')) 'Codex API Balance Whale.lnk'
if (Test-Path -LiteralPath $whaleStartup) {
    $whaleShell = New-Object -ComObject WScript.Shell
    $whaleShortcut = $whaleShell.CreateShortcut($whaleStartup)
    if ($whaleShortcut.Arguments.Contains($whaleScript)) { Remove-Item -LiteralPath $whaleStartup }
}
if (!$NoStart) {
    Start-ScheduledTask -TaskName $whaleTaskName -ErrorAction Stop
    $whaleStarted = $false
    for ($whaleAttempt=0; $whaleAttempt -lt 50; $whaleAttempt++) {
        try {
            $whaleLaunched = Get-Content -LiteralPath (Join-Path $DataDir 'launcher-state.json') -Raw -ErrorAction Stop | ConvertFrom-Json
            $whaleWorker = Get-Content -LiteralPath (Join-Path $DataDir 'supervisor-state.json') -Raw -ErrorAction Stop | ConvertFrom-Json
            $whaleProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$whaleLaunched.pid) -ErrorAction Stop
            $whaleWorkerProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$whaleWorker.pid) -ErrorAction Stop
            if ($whaleLaunched.executable -ieq $whaleLauncher -and $whaleLaunched.script -ceq $whaleScript -and $whaleLaunched.consoleAttached -eq $false -and $whaleWorker.consoleAttached -eq $false -and $whaleWorker.pid -eq $whaleLaunched.supervisorPid -and $whaleProcess.ExecutablePath -ieq $whaleLauncher -and $whaleWorkerProcess.ParentProcessId -eq $whaleLaunched.pid -and (Get-ScheduledTask -TaskName $whaleTaskName -ErrorAction Stop).State -eq 'Running') {
                $whaleStarted = $true; break
            }
        } catch { }
        Start-Sleep -Milliseconds 200
    }
    if (!$whaleStarted) { throw 'The GUI task was registered, but its monitor did not start correctly. No successful installation was recorded. Check Windows Task Scheduler or launcher-error.json.' }
}
@{ taskName=$whaleTaskName; hostPath=$whaleLauncher; workerPath=$whalePowerShell; pluginRoot=$whaleRoot; runLevel='Limited'; user=$whaleUser; launchMode='WinExe'; verifiedTask=$true; started=(!$NoStart); installedAt=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DataDir 'follow-install.json') -Encoding utf8
Write-Output 'Codex companion installed with an independent GUI launcher. No terminal window; local IPC.'
