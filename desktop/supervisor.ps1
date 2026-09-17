param([string]$DataDir, [switch]$Probe, [switch]$Stop, [switch]$Hit, [int]$X, [int]$Y)
$ErrorActionPreference = 'Stop'
if (!$DataDir) { $whaleCodex = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }; $DataDir = if ($env:WHALE_HOME) { $env:WHALE_HOME } else { Join-Path $whaleCodex 'whale-widget' } }
$DataDir = [IO.Path]::GetFullPath($DataDir)
$whaleHasher = [Security.Cryptography.SHA256]::Create()
$whaleHash = [BitConverter]::ToString($whaleHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($DataDir.ToLowerInvariant()))).Replace('-', '').Substring(0,24)
$whaleHasher.Dispose()
$whaleStopName = 'Local\CodexWhaleStop-' + $whaleHash
if ($Stop) { try { $whaleSignal = [Threading.EventWaitHandle]::OpenExisting($whaleStopName); [void]$whaleSignal.Set(); $whaleSignal.Dispose() } catch [Threading.WaitHandleCannotBeOpenedException] { }; return }
Add-Type -TypeDefinition (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'WindowApi.cs') -Raw)
if ($Probe) { [WhaleWindows]::Probe() | ConvertTo-Json -Depth 5 -Compress; return }
if ($Hit) { [WhaleWindows]::Hit($X, $Y) | ConvertTo-Json -Compress; return }
[WhaleWindows]::DetachConsole()
$whaleFresh = $false
$whaleMutex = [Threading.Mutex]::new($true, ('Local\CodexWhaleWatch-' + $whaleHash), [ref]$whaleFresh)
if (!$whaleFresh) { $whaleMutex.Dispose(); return }
$whaleStop = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::ManualReset, $whaleStopName)
[void]$whaleStop.Reset()
$whaleChild = $null; $whaleOutput = $null; $whaleErrors = $null
$whaleLastLaunch = [DateTime]::MinValue; $whaleHeartbeat = [DateTime]::MinValue; $whaleLastMessage = ''; $whaleOverlay = '0'; $whaleOwner = '0'
$whaleSequence = 0
$whaleStateFile = Join-Path $DataDir 'supervisor-state.json'
$whaleParentPid = (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID)).ParentProcessId
@{ pid=$PID; parentPid=$whaleParentPid; consoleAttached=[WhaleWindows]::HasConsole(); startedAt=[DateTime]::UtcNow.ToString('o'); host='PowerShell' } | ConvertTo-Json | Set-Content -LiteralPath $whaleStateFile -Encoding utf8
function Read-WhaleJson([string]$File) { if (Test-Path -LiteralPath $File) { Get-Content -LiteralPath $File -Raw | ConvertFrom-Json } else { @{} } }
function Send-WhaleHost($State) {
    $whalePipeClient = $null; $whaleWriter = $null; $whaleReader = $null
    try {
        $whaleRuntime = Read-WhaleJson (Join-Path $DataDir 'runtime.json')
        if ($whaleRuntime.transport -ne 'local-ipc' -or !$whaleRuntime.pipe.StartsWith('\\.\pipe\codex-whale-') -or $whaleRuntime.pid -ne $whaleChild.Id) { return $false }
        $whalePipeName=$whaleRuntime.pipe.Substring(9)
        $whalePipeClient=[IO.Pipes.NamedPipeClientStream]::new('.', $whalePipeName, [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous)
        $whalePipeClient.Connect(300)
        $whaleWriter=[IO.StreamWriter]::new($whalePipeClient, [Text.UTF8Encoding]::new($false), 4096, $true)
        $whaleWriter.AutoFlush=$true
        $whalePacket=@{ token=$whaleRuntime.token; route='/internal/host'; method='POST'; body=$State } | ConvertTo-Json -Depth 8 -Compress
        $whaleWriter.WriteLine($whalePacket)
        $whaleReader=[IO.StreamReader]::new($whalePipeClient, [Text.UTF8Encoding]::new($false), $false, 4096, $true)
        $whaleReply=$whaleReader.ReadLineAsync()
        if (!$whaleReply.Wait(1500)) { return $false }
        return $true
    } catch { return $false }
    finally { if ($whaleWriter) { $whaleWriter.Dispose() }; if ($whaleReader) { $whaleReader.Dispose() }; if ($whalePipeClient) { $whalePipeClient.Dispose() } }
}
$whaleFatal = $false
try {
    while (!$whaleStop.WaitOne(100)) {
        $whaleNow = [DateTime]::UtcNow
        $whaleState = [WhaleWindows]::Probe()
        if ($whaleChild -and $whaleChild.HasExited) { [WhaleWindows]::StopFollowing(); $whaleChild.Dispose(); $whaleChild = $null; $whaleOverlay='0'; $whaleOwner='0'; $whaleLastMessage='' }
        if (!$whaleChild -and $whaleState.hostAlive -and ($whaleNow - $whaleLastLaunch).TotalSeconds -gt 4) {
            $whaleConfig = Read-WhaleJson (Join-Path $DataDir 'follow-config.json')
            $whalePause = Read-WhaleJson (Join-Path $DataDir 'pause-until-host-exit.json')
            if ($whaleConfig.enabled -eq $false -or [string]$whalePause.hostPid -eq [string]$whaleState.hostPid) { continue }
            if (!(Test-Path -LiteralPath $whaleConfig.electronPath)) { throw 'Desktop runtime is missing.' }
            $whaleMain = Join-Path $whaleConfig.pluginRoot 'desktop\main.cjs'
            $whaleStart = [Diagnostics.ProcessStartInfo]::new()
            $whaleStart.FileName = $whaleConfig.electronPath
            $whaleStart.Arguments = '"' + $whaleMain + '" "--whale-data=' + $DataDir + '" --supervised'
            $whaleStart.WorkingDirectory = $whaleConfig.pluginRoot
            $whaleStart.UseShellExecute=$false; $whaleStart.CreateNoWindow=$true
            $whaleStart.RedirectStandardInput=$true; $whaleStart.RedirectStandardOutput=$true; $whaleStart.RedirectStandardError=$true
            $whaleStart.EnvironmentVariables.Remove('ELECTRON_RUN_AS_NODE')
            $whaleStart.EnvironmentVariables['WHALE_INITIAL_HOST'] = ($whaleState | ConvertTo-Json -Depth 5 -Compress)
            $whaleStart.EnvironmentVariables['WHALE_LAUNCH_TIME'] = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
            $whaleChild = [Diagnostics.Process]::new(); $whaleChild.StartInfo=$whaleStart
            [void]$whaleChild.Start(); $whaleLastLaunch=$whaleNow
            $whaleOutput=$whaleChild.StandardOutput.ReadLineAsync(); $whaleErrors=$whaleChild.StandardError.ReadToEndAsync()
        }
        if ($whaleChild) {
            if ($whaleOutput -and $whaleOutput.IsCompleted) {
                try { $whaleLine=$whaleOutput.GetAwaiter().GetResult(); if ($whaleLine) { $whaleResponse=$whaleLine | ConvertFrom-Json; if ($whaleResponse.overlayHandle) { $whaleOverlay=[string]$whaleResponse.overlayHandle } } } catch { }
                $whaleOutput=$whaleChild.StandardOutput.ReadLineAsync()
            }
            if ($whaleState.window -eq '0') {
                # A minimize, a transient DWM cloak or a window-handle swap can
                # make one probe sample choose nothing, and the owner binding is
                # never re-derived from a zero handle. Reuse the last verified
                # handle so the periodic state keeps a valid window; visibility
                # still comes from this sample, so a minimized host keeps hiding
                # the widget while the binding stays intact for the restore.
                if ($whaleOwner -ne '0') { $whaleState['window'] = $whaleOwner }
            } elseif ($whaleOverlay -ne '0' -and $whaleOwner -ne $whaleState.window) {
                if ([WhaleWindows]::Attach([long]$whaleOverlay, [long]$whaleState.window)) { $whaleOwner=[string]$whaleState.window }
            }
            $whaleState['attached'] = ($whaleOwner -ne '0' -and $whaleOwner -eq $whaleState.window)
            $whaleState['nativeFollowing'] = [WhaleWindows]::IsFollowing()
            # Bounds belong to the native follower. Only lifecycle changes and
            # a one-second heartbeat use IPC/disk; there is no per-move I/O.
            $whaleMessage = if ($whaleState.nativeFollowing) { @($whaleState.hostAlive,$whaleState.hostPid,$whaleState.window,$whaleState.visible,$whaleState.attached,$whaleState.dpi,$whaleState.bounds.width,$whaleState.bounds.height,'native') -join '|' } else { $whaleState | ConvertTo-Json -Depth 5 -Compress }
            if ($whaleMessage -ne $whaleLastMessage -or ($whaleNow - $whaleHeartbeat).TotalSeconds -ge 1) {
                try {
                    $whaleSequence++; $whaleState['serial'] = $whaleSequence
                    if (Send-WhaleHost $whaleState) {
                        @{ childPid=$whaleChild.Id; state=$whaleState; native=[WhaleWindows]::FollowMetrics(); at=$whaleNow.ToString('o') } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $DataDir 'follow-state.json') -Encoding utf8
                        $whaleLastMessage=$whaleMessage; $whaleHeartbeat=$whaleNow
                    }
                } catch { @{ message=$_.Exception.Message; at=$whaleNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DataDir 'follow-input-error.json') -Encoding utf8 }
            }
        }
    }
} catch {
    $whaleFatal = $true
    @{ message=$_.Exception.Message; at=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DataDir 'supervisor-error.json') -Encoding utf8
} finally {
    [WhaleWindows]::StopFollowing()
    if ($whaleChild) {
        try { [void](Send-WhaleHost @{hostAlive=$false;monitorExit=$true}); $whaleChild.StandardInput.Close(); [void]$whaleChild.WaitForExit(7000) } catch { }
        $whaleChild.Dispose()
    }
    Remove-Item -LiteralPath $whaleStateFile -ErrorAction SilentlyContinue
    $whaleStop.Dispose(); $whaleMutex.Dispose()
}
if ($whaleFatal) { exit 1 }
