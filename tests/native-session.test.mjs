import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('native session lookup preserves current-session filtering and rejects an invalid PID', { skip: process.platform !== 'win32' }, () => {
  const source = fs.readFileSync(new URL('../desktop/WindowApi.cs', import.meta.url)).toString('base64');
  const script = `$ErrorActionPreference='Stop'
try {
Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${source}')))
$flags=[Reflection.BindingFlags]'NonPublic,Static'
$lookup=[WhaleWindows].GetMethod('ProcessIdToSessionId',$flags)
$sessionArgs=[object[]]@([uint32]$PID,[uint32]0)
if(!$lookup.Invoke($null,$sessionArgs)){throw 'Current process session lookup failed'}
$current=[Diagnostics.Process]::GetCurrentProcess().SessionId
if($sessionArgs[1] -ne $current){throw 'Native session differs from Process.SessionId'}
$invalidArgs=[object[]]@([uint32]::MaxValue,[uint32]0)
if($lookup.Invoke($null,$invalidArgs)){throw 'Invalid PID was accepted'}
$roots=[WhaleWindows].GetMethod('Roots',$flags).Invoke($null,@())
foreach($root in $roots){
    $rootArgs=[object[]]@([uint32]$root,[uint32]0)
    if(!$lookup.Invoke($null,$rootArgs) -or $rootArgs[1] -ne $current){throw 'Root escaped current-session filter'}
}
'native session assertions passed'
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }

`;
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', '-'], {
    input: script, encoding: 'utf8', windowsHide: true, timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /native session assertions passed/);
});
