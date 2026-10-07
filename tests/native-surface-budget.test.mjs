import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('the production C# verification deadline survives continuous unverified requests', { skip: process.platform !== 'win32' }, () => {
  const source = fs.readFileSync(new URL('../desktop/SurfaceGuard.cs', import.meta.url)).toString('base64');
  const script = `$ErrorActionPreference='Stop'
try {
Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${source}'))) -ReferencedAssemblies 'System.Web.Extensions','System','System.Core'
$budget=[WhaleSurfaceVerificationBudget]::new()
$budget.Begin(1000)
$budget.Observe(1000,$true)
for($at=1016;$at -lt 2000;$at+=16){$budget.Observe($at,$false);if($budget.Expired($at)){throw 'Short frame race revoked too soon'}}
$budget.Observe(2000,$false)
if(!$budget.Expired(2000)){throw 'Continuous unverified animation evaded deadline'}
for($at=2001;$at -lt 10000;$at+=16){$budget.Observe($at,$false);if(!$budget.Expired($at)){throw 'New unverified requests reset deadline'}}
$budget.Observe(10000,$true)
if($budget.Expired(10000)){throw 'A real verified recovery did not reset deadline'}
for($at=10000;$at -lt 20000;$at+=40){$budget.Observe($at,$true);if($budget.Expired($at)){throw 'Healthy animation was revoked'}}
$cold=[WhaleSurfaceVerificationBudget]::new()
$cold.Begin(1)
for($at=17;$at -lt 1001;$at+=16){$cold.Observe($at,$false)}
if(!$cold.Expired(1001)){throw 'Never-verified startup escaped deadline'}
'native budget assertions passed'
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }

`;
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', '-'], { input: script, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /native budget assertions passed/);
});
