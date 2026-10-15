#Requires -Version 5.1
<#
.SYNOPSIS
  ARIA Sentinel - the REAL-Windows fault lab (an operator tool for a TEST machine; never shipped in the customer build).

.DESCRIPTION
  The simulated lab (tests/lib/fault-lab.mjs) proves the "advise three times, then act" rule against every catalogued
  fault without touching a machine. This script is its on-device companion: it injects ONLY real, reversible L1/L2
  faults, snapshots the machine before and after, verifies that nothing outside each fault's intended keys changed,
  and puts everything back.

    -List                 the catalogue: what this lab injects for real, and what stays simulated only (refused here)
    -Snapshot             services - default apps - IP configuration - temp size  ->  JSON (read-only)
    -Inject <id|all>      inject real faults (asks for administrator approval through UAC when a service is stopped)
    -Verify               re-snapshot + diff against the baseline; exit 1 if anything OUTSIDE the intended keys changed
    -Restore              put everything back (always safe: starts only services that were running, resumes only the
                          queue this lab paused, deletes only its own junk folder; never stops or reconfigures anything)

  What it will NEVER do: change the network, DNS, the registry, the clock, a default app, a service's startup type,
  or anything outside its own folder %TEMP%\aria-fault-lab\. L3 faults (and L1/L2 faults that would need any of the
  above) are simulated only and are refused by name.

  The excluded folder: every path this script reads, lists or writes is checked against the SAME rule the app uses
  (src/shared/path-guard.mjs, read at run time - plus any folder the person excluded in the app's settings). If the rule
  cannot be read, the script refuses to run (fail closed). The folder is never named in this file.

  Every step is logged to <StateDir>\fault-lab.log. Exit codes: 0 ok - 1 verify found an unintended change / a restore
  step failed - 2 bad usage / not Windows / guard unavailable - 3 refused (simulated-only fault).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\fault-lab.ps1 -Snapshot
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\fault-lab.ps1 -Inject all
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\fault-lab.ps1 -Verify
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\fault-lab.ps1 -Restore
#>
[CmdletBinding(DefaultParameterSetName = 'List')]
param(
  [Parameter(ParameterSetName = 'List')][switch] $List,
  [Parameter(ParameterSetName = 'Snapshot', Mandatory = $true)][switch] $Snapshot,
  [Parameter(ParameterSetName = 'Inject', Mandatory = $true)][string] $Inject,
  [Parameter(ParameterSetName = 'Verify', Mandatory = $true)][switch] $Verify,
  [Parameter(ParameterSetName = 'Restore', Mandatory = $true)][switch] $Restore,
  # Resolved once by the (non-elevated) caller and handed to the elevated copy, so both work on the SAME folders even when
  # a different administrator account approves the UAC prompt.
  [string] $LabRoot = '',
  [string] $StateDir = '',
  [switch] $Json,
  [switch] $NoElevate
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

# -- The catalogue --------------------------------------------------------------------------------------------------
# Real faults: the SAME ids and recipes as the simulated catalogue (tests/lib/fault-lab.mjs) where the fault is the same,
# so a real run and a simulated run can be read side by side. wu-stopped is real-only (the simulated wu-stuck is a HUNG
# update, which cannot be produced reversibly). intended = the snapshot keys this fault is ALLOWED to change (a key
# prefix ends with '.').
$RealFaults = [ordered]@{
  'spooler-stuck' = @{ level = 'L1'; recipe = 'svc-spooler-stopped-v1'; color = 'green'; admin = $true; service = 'Spooler'
                       intended = @('services.Spooler.Status', 'printers.'); what = 'Pause the Microsoft Print to PDF queue, then stop the Print Spooler service' }
  'audio-stopped' = @{ level = 'L1'; recipe = 'svc-audiosrv-stopped-v1'; color = 'green'; admin = $true; service = 'Audiosrv'
                       intended = @('services.Audiosrv.Status'); what = 'Stop the Windows Audio service' }
  'wu-stopped'    = @{ level = 'L2'; recipe = 'svc-wuauserv-stopped-v1'; color = 'green'; admin = $true; service = 'wuauserv'
                       intended = @('services.wuauserv.Status'); what = 'Stop the Windows Update service (if it is running)' }
  'bits-stopped'  = @{ level = 'L2'; recipe = 'svc-bits-stopped-v1'; color = 'green'; admin = $true; service = 'BITS'
                       intended = @('services.BITS.Status'); what = 'Stop the Background Intelligent Transfer service (if it is running)' }
  'temp-bloat'    = @{ level = 'L1'; recipe = 'disk-low-space-v1'; color = 'green'; admin = $false; service = ''
                       intended = @('temp.labBytes'); what = 'Write about 200 MB of junk under %TEMP%\aria-fault-lab\' }
}
# Simulated only: refused here, with the reason. (The simulated lab covers every one of them.)
$SimulatedOnly = [ordered]@{
  'stale-dns'            = 'L1 - would change DNS'
  'time-drift'           = 'L1 - would change the clock'
  'teams-stuck'          = 'L1 - would close an app and reset its cache'
  'wu-stuck'             = 'L2 - a hung update cannot be produced reversibly (wu-stopped stops the service instead)'
  'wlan-stopped'         = 'L2 - would disconnect the network'
  'dnscache-stopped'     = 'L2 - would change DNS'
  'dhcp-lease-stale'     = 'L2 - would change the network'
  'spooler-disabled'     = 'L3 - would change a service startup type'
  'system-files-corrupt' = 'L3 - simulated only'
  'bitlocker-recovery'   = 'L3 - simulated only'
  'winsock-corrupt'      = 'L3 - would change the network stack'
  'print-driver-crash'   = 'L3 - simulated only'
  'dhcp-stopped'         = 'L2 - would change the network'
}
$LabServices = @('Spooler', 'Audiosrv', 'AudioEndpointBuilder', 'wuauserv', 'BITS', 'cryptsvc', 'Dnscache', 'Dhcp', 'WlanSvc', 'LanmanWorkstation', 'EventLog', 'Winmgmt', 'W32Time')
$LabPrinter = 'Microsoft Print to PDF'
$DefaultAppExts = @('.txt', '.pdf', '.htm', '.html', '.jpg', '.png', '.mp4', '.docx', '.xlsx')
$DefaultAppUrls = @('http', 'https', 'mailto')
# Keys whose value moves on its own (other apps write temp files, print, use disk). Reported, never judged.
$VolatilePrefixes = @('temp.totalBytes', 'disk.systemFreeBytes', 'printers.jobs')

function Exit-With([int] $code, [string] $message) {
  if ($message) { if ($code -eq 0) { Write-Output $message } else { [Console]::Error.WriteLine($message) } }
  exit $code
}

# -- Windows only ---------------------------------------------------------------------------------------------------
$onWindows = ($env:OS -eq 'Windows_NT')
if (-not $onWindows) { Exit-With 2 'fault-lab: this lab runs on Windows only (the simulated lab is tests/lib/fault-lab.mjs).' }

# -- The excluded-folder guard (fail closed) -----------------------------------------------------------------------
$AppRoot = Split-Path -Parent $PSScriptRoot
function New-ExcludedFolderGuard {
  $guardFile = Join-Path $AppRoot 'src\shared\path-guard.mjs'
  if (-not (Test-Path -LiteralPath $guardFile -PathType Leaf)) { throw 'the app''s path guard (src\shared\path-guard.mjs) was not found' }
  $text = [IO.File]::ReadAllText($guardFile)
  $m = [regex]::Match($text, 'export const PRIVATE_FOLDER_RE = /(.+?)/([a-z]*);')
  if (-not $m.Success) { throw 'the excluded-folder rule could not be read from path-guard.mjs' }
  $opts = [Text.RegularExpressions.RegexOptions]::CultureInvariant
  if ($m.Groups[2].Value.Contains('i')) { $opts = $opts -bor [Text.RegularExpressions.RegexOptions]::IgnoreCase }
  $rules = New-Object System.Collections.Generic.List[regex]
  $rules.Add([regex]::new($m.Groups[1].Value, $opts))
  # Self-test against the default folder's own name, read from the same file (never written here).
  $n = [regex]::Match($text, 'export const PRIVATE_FOLDER_NAME = "([^"]+)";')
  if (-not $n.Success -or -not $rules[0].IsMatch("C:\Users\lab\$($n.Groups[1].Value)\x")) { throw 'the excluded-folder rule failed its self-test' }
  # The folders the person added in the app (Settings -> Privacy -> Excluded folders), same matching as path-guard.mjs.
  foreach ($dirName in @('ARIA Sentinel', 'aria-sentinel')) {
    $cfg = Join-Path (Join-Path $env:APPDATA $dirName) 'aria-sentinel-state.json'
    if (-not (Test-Path -LiteralPath $cfg -PathType Leaf)) { continue }
    $state = [IO.File]::ReadAllText($cfg) | ConvertFrom-Json  # a store that cannot be parsed throws -> fail closed
    if ($state.PSObject.Properties.Name -contains 'excludedFolders' -and $state.excludedFolders) {
      foreach ($name in @($state.excludedFolders)) {
        $s = ([string]$name).Trim()
        if ($s.Length -eq 0 -or $s.Length -gt 120) { continue }
        $pattern = ([regex]::Escape($s)) -replace '(\\ )+', '\s+'
        $rules.Add([regex]::new($pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [Text.RegularExpressions.RegexOptions]::CultureInvariant))
      }
    }
  }
  return , $rules
}
try { $Guard = New-ExcludedFolderGuard } catch { Exit-With 2 "fault-lab: REFUSED - $($_.Exception.Message). The lab does not run without the excluded-folder guard (fail closed)." }
function Test-Excluded([string] $path) {
  foreach ($re in $Guard) { if ($re.IsMatch([string]$path)) { return $true } }
  return $false
}
function Assert-Allowed([string] $path) {
  if (Test-Excluded $path) { throw "R11_BLOCKED: a path under the excluded folder was refused (nothing was read, listed or written)" }
  return $path
}

# -- Folders --------------------------------------------------------------------------------------------------------
if (-not $LabRoot) { $LabRoot = Join-Path $env:TEMP 'aria-fault-lab' }
if (-not $StateDir) { $StateDir = Join-Path $env:TEMP 'aria-fault-lab-state' }
try {
  [void](Assert-Allowed $env:TEMP); [void](Assert-Allowed $LabRoot); [void](Assert-Allowed $StateDir)
} catch { Exit-With 2 "fault-lab: REFUSED - $($_.Exception.Message)" }
if ((Split-Path -Leaf $LabRoot) -ne 'aria-fault-lab') { Exit-With 2 'fault-lab: -LabRoot must be a folder named aria-fault-lab (the lab deletes only its own folder).' }
if (-not (Test-Path -LiteralPath $StateDir)) { New-Item -ItemType Directory -Path $StateDir -Force | Out-Null }
$LogFile = Join-Path $StateDir 'fault-lab.log'
$BaselineFile = Join-Path $StateDir 'snapshot-baseline.json'
$RecordFile = Join-Path $StateDir 'injected.json'

function Write-LabLog([string] $message) {
  $line = '{0}  {1}' -f (Get-Date).ToUniversalTime().ToString('o'), $message
  Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
  if (-not $Json) { Write-Output $line }
}
function Test-IsAdmin {
  $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
function Invoke-Elevated([string[]] $extra) {
  if ($NoElevate) { Exit-With 2 'fault-lab: administrator rights are needed for this step and -NoElevate was given.' }
  $exe = (Get-Process -Id $PID).Path
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $PSCommandPath)) + $extra + @('-LabRoot', ('"{0}"' -f $LabRoot), '-StateDir', ('"{0}"' -f $StateDir), '-NoElevate')
  Write-LabLog "ELEVATE: asking Windows for administrator approval (UAC) to run: $($extra -join ' ')"
  try { $proc = Start-Process -FilePath $exe -ArgumentList $argList -Verb RunAs -Wait -PassThru }
  catch { Write-LabLog 'ELEVATE: administrator approval was declined - nothing was changed.'; exit 2 }
  Write-LabLog "ELEVATE: the elevated step finished with exit code $($proc.ExitCode) (details above in this log)."
  exit $proc.ExitCode
}

# -- Snapshot (read-only) -------------------------------------------------------------------------------------------
function Get-DirBytes([string] $root) {
  # A manual walk so the excluded folder is never LISTED: a directory that matches the guard is skipped before it is opened.
  $total = [int64]0; $skipped = 0
  if (-not (Test-Path -LiteralPath $root -PathType Container)) { return @{ bytes = [int64]0; skipped = 0 } }
  $stack = New-Object System.Collections.Stack
  $stack.Push($root)
  while ($stack.Count -gt 0) {
    $dir = [string]$stack.Pop()
    if (Test-Excluded $dir) { $skipped++; continue }
    try {
      $di = New-Object IO.DirectoryInfo $dir
      foreach ($f in $di.EnumerateFiles()) { if (-not (Test-Excluded $f.FullName)) { $total += $f.Length } }
      foreach ($sd in $di.EnumerateDirectories()) {
        if (($sd.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }  # never follow a junction
        if (Test-Excluded $sd.FullName) { $skipped++; continue }
        $stack.Push($sd.FullName)
      }
    } catch { }  # a folder we may not read is simply not counted
  }
  return @{ bytes = $total; skipped = $skipped }
}
function Get-UserChoice([string] $keyPath) {
  try { $v = Get-ItemProperty -LiteralPath $keyPath -Name ProgId -ErrorAction Stop; return [string]$v.ProgId } catch { return '(none)' }
}
function Get-LabSnapshot {
  $keys = [ordered]@{}
  foreach ($name in $LabServices) {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if ($svc) { $keys["services.$name.Status"] = [string]$svc.Status; $keys["services.$name.StartType"] = [string]$svc.StartType }
    else { $keys["services.$name.Status"] = 'absent'; $keys["services.$name.StartType"] = 'absent' }
  }
  $spooler = Get-Service -Name Spooler -ErrorAction SilentlyContinue
  if ($spooler -and $spooler.Status -eq 'Running') {
    try {
      $printers = @(Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop)
      $keys['printers.count'] = [string]$printers.Count
      $labP = $printers | Where-Object { $_.Name -eq $LabPrinter } | Select-Object -First 1
      # Win32_Printer: ExtendedPrinterStatus 8 = Paused (PrinterState bit 0x1 on older builds).
      $keys['printers.labPrinter'] = if (-not $labP) { 'absent' } elseif ($labP.ExtendedPrinterStatus -eq 8 -or (([int]$labP.PrinterState) -band 1) -ne 0) { 'Paused' } else { 'Normal' }
      $keys['printers.jobs'] = [string](@(Get-CimInstance -ClassName Win32_PrintJob -ErrorAction SilentlyContinue).Count)
    } catch { $keys['printers.count'] = 'unreadable'; $keys['printers.labPrinter'] = 'unreadable'; $keys['printers.jobs'] = 'unreadable' }
  } else { $keys['printers.count'] = 'spooler-stopped'; $keys['printers.labPrinter'] = 'spooler-stopped'; $keys['printers.jobs'] = 'spooler-stopped' }
  foreach ($ext in $DefaultAppExts) { $keys["defaultApps.$ext"] = Get-UserChoice "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\UserChoice" }
  foreach ($scheme in $DefaultAppUrls) { $keys["defaultApps.$scheme"] = Get-UserChoice "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\$scheme\UserChoice" }
  try {
    foreach ($cfg in @(Get-NetIPConfiguration -ErrorAction Stop)) {
      $alias = ([string]$cfg.InterfaceAlias) -replace '[^A-Za-z0-9 ._()-]', '_'
      $keys["net.$alias.status"] = if ($cfg.NetAdapter) { [string]$cfg.NetAdapter.Status } else { 'unknown' }
      $keys["net.$alias.ipv4"] = (@(@($cfg.IPv4Address) | Where-Object { $_ } | ForEach-Object { $_.IPAddress }) | Sort-Object) -join ','
      $keys["net.$alias.gateway"] = (@(@($cfg.IPv4DefaultGateway) | Where-Object { $_ } | ForEach-Object { $_.NextHop }) | Sort-Object) -join ','
      $keys["net.$alias.dns"] = (@(@($cfg.DNSServer) | Where-Object { $_ -and $_.AddressFamily -eq 2 } | ForEach-Object { $_.ServerAddresses }) | Sort-Object) -join ','
      try { $keys["net.$alias.dhcp"] = [string](Get-NetIPInterface -InterfaceIndex $cfg.InterfaceIndex -AddressFamily IPv4 -ErrorAction Stop).Dhcp } catch { $keys["net.$alias.dhcp"] = 'unreadable' }
    }
  } catch { $keys['net.unreadable'] = 'true' }
  $lab = Get-DirBytes $LabRoot
  $keys['temp.labBytes'] = [string]$lab.bytes
  $tmp = Get-DirBytes $env:TEMP
  $keys['temp.totalBytes'] = [string]$tmp.bytes
  try { $keys['disk.systemFreeBytes'] = [string](Get-PSDrive -Name ($env:SystemDrive.TrimEnd(':')) -ErrorAction Stop).Free } catch { $keys['disk.systemFreeBytes'] = 'unreadable' }
  return [pscustomobject]@{ takenAt = (Get-Date).ToUniversalTime().ToString('o'); computer = 'this-test-machine'; excludedSkipped = ($lab.skipped + $tmp.skipped); keys = $keys }
}
function Save-Json($object, [string] $file) {
  [void](Assert-Allowed $file)
  $object | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $file -Encoding UTF8
}
function Read-Json([string] $file) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return $null }
  return ([IO.File]::ReadAllText((Assert-Allowed $file)) | ConvertFrom-Json)
}
function ConvertTo-KeyMap($snapshot) {
  # A live snapshot holds an ordered dictionary; one read back from JSON holds an object - both become one flat map.
  $map = [ordered]@{}
  if (-not $snapshot) { return $map }
  $k = $snapshot.keys
  if ($k -is [System.Collections.IDictionary]) { foreach ($name in @($k.Keys)) { $map[[string]$name] = [string]$k[$name] } }
  elseif ($k) { foreach ($p in $k.PSObject.Properties) { $map[$p.Name] = [string]$p.Value } }
  return $map
}
function Test-KeyIn([string] $key, [string[]] $prefixes) {
  foreach ($p in $prefixes) { if ($p.EndsWith('.')) { if ($key.StartsWith($p)) { return $true } } elseif ($key -eq $p) { return $true } }
  return $false
}

# -- Inject ---------------------------------------------------------------------------------------------------------
function Get-ActiveRecord {
  $r = Read-Json $RecordFile
  if ($r -and -not $r.restoredAt) { return $r }
  return $null
}
function Invoke-Inject([string] $what) {
  $ids = if ($what -eq 'all') { @($RealFaults.Keys) } else { @($what -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
  foreach ($id in $ids) {
    if ($SimulatedOnly.Contains($id)) { Write-LabLog "REFUSED: '$id' is simulated only ($($SimulatedOnly[$id])). Covered by tests/lib/fault-lab.mjs; this lab injects only: $(@($RealFaults.Keys) -join ', ')."; exit 3 }
    if (-not $RealFaults.Contains($id)) { Write-LabLog "REFUSED: unknown fault '$id'. Run -List."; exit 2 }
  }
  if (-not (Test-Path -LiteralPath $BaselineFile)) { Write-LabLog 'INJECT: no baseline yet - taking it first (-Snapshot).'; Save-Json (Get-LabSnapshot) $BaselineFile }
  $needsAdmin = @($ids | Where-Object { $RealFaults[$_].admin }).Count -gt 0
  if ($needsAdmin -and -not (Test-IsAdmin)) { Invoke-Elevated @('-Inject', $what) }
  $record = Get-ActiveRecord
  $faults = New-Object System.Collections.ArrayList
  if ($record -and $record.faults) { foreach ($f in @($record.faults)) { [void]$faults.Add($f) } }
  foreach ($id in $ids) {
    if (@($faults | Where-Object { $_.id -eq $id }).Count -gt 0) { Write-LabLog "INJECT $id`: already injected and not restored - skipped."; continue }
    $f = $RealFaults[$id]
    $entry = [ordered]@{ id = $id; level = $f.level; recipe = $f.recipe; intended = $f.intended; injected = $false; at = (Get-Date).ToUniversalTime().ToString('o'); before = $null; pausedPrinter = $false; note = '' }
    if ($f.service) {
      $svc = Get-Service -Name $f.service -ErrorAction SilentlyContinue
      if (-not $svc) { $entry.note = "service $($f.service) is not installed - nothing to inject"; Write-LabLog "INJECT $id`: $($entry.note)."; [void]$faults.Add([pscustomobject]$entry); continue }
      $entry.before = @{ Status = [string]$svc.Status; StartType = [string]$svc.StartType }
      if ($svc.Status -ne 'Running') { $entry.note = "service $($f.service) was already $($svc.Status) (start type $($svc.StartType)) - nothing to inject"; Write-LabLog "INJECT $id`: $($entry.note)."; [void]$faults.Add([pscustomobject]$entry); continue }
      if ($id -eq 'spooler-stuck') {
        try {
          $p = Get-CimInstance -ClassName Win32_Printer -Filter ("Name='{0}'" -f $LabPrinter) -ErrorAction Stop | Select-Object -First 1
          if ($p) {
            Write-LabLog "INJECT $id`: Invoke-CimMethod Win32_Printer('$LabPrinter').Pause"
            $res = Invoke-CimMethod -InputObject $p -MethodName Pause -ErrorAction Stop
            $entry.pausedPrinter = ($res.ReturnValue -eq 0)
            Write-LabLog "INJECT $id`: queue paused = $($entry.pausedPrinter) (return $($res.ReturnValue))."
          } else { Write-LabLog "INJECT $id`: '$LabPrinter' is not installed - the queue is not paused (the service stop is still injected)." }
        } catch { Write-LabLog "INJECT $id`: pausing the queue failed ($($_.Exception.Message)) - continuing with the service stop only." }
      }
      Write-LabLog "INJECT $id`: Stop-Service -Name $($f.service) -Force"
      try { Stop-Service -Name $f.service -Force -ErrorAction Stop; $entry.injected = $true }
      catch { $entry.note = "Stop-Service failed: $($_.Exception.Message)"; Write-LabLog "INJECT $id`: $($entry.note)" }
      $after = Get-Service -Name $f.service -ErrorAction SilentlyContinue
      Write-LabLog "INJECT $id`: $($f.service) is now $($after.Status) (start type unchanged: $($after.StartType))."
    } elseif ($id -eq 'temp-bloat') {
      [void](Assert-Allowed $LabRoot)
      if (-not (Test-Path -LiteralPath $LabRoot)) { New-Item -ItemType Directory -Path $LabRoot -Force | Out-Null }
      for ($i = 1; $i -le 4; $i++) {
        $file = Join-Path $LabRoot ("junk-{0}.bin" -f $i)
        [void](Assert-Allowed $file)
        Write-LabLog "INJECT $id`: write 50 MB -> $file"
        $fs = [IO.File]::Open($file, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try {
          $buf = New-Object byte[] (1MB)
          (New-Object Random 20261014).NextBytes($buf)  # not zeros: NTFS compression / sparse files cannot make it vanish
          for ($k = 0; $k -lt 50; $k++) { $fs.Write($buf, 0, $buf.Length) }
        } finally { $fs.Dispose() }
      }
      $entry.injected = $true
      Write-LabLog "INJECT $id`: $LabRoot now holds $((Get-DirBytes $LabRoot).bytes) bytes."
    }
    [void]$faults.Add([pscustomobject]$entry)
  }
  Save-Json ([pscustomobject]@{ startedAt = $(if ($record) { $record.startedAt } else { (Get-Date).ToUniversalTime().ToString('o') }); restoredAt = $null; faults = @($faults) }) $RecordFile
  Write-LabLog "INJECT: done - $(@($faults | Where-Object { $_.injected }).Count) fault(s) live. Restore with -Restore."
}

# -- Verify ---------------------------------------------------------------------------------------------------------
function Invoke-Verify {
  $base = Read-Json $BaselineFile
  if (-not $base) { Write-LabLog 'VERIFY: no baseline - run -Snapshot first.'; exit 2 }
  $now = Get-LabSnapshot
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
  Save-Json $now (Join-Path $StateDir "snapshot-verify-$stamp.json")
  $record = Get-ActiveRecord
  $intended = @()
  if ($record) { foreach ($f in @($record.faults)) { if ($f.injected) { $intended += @($f.intended) } } }
  $a = ConvertTo-KeyMap $base; $b = ConvertTo-KeyMap $now
  $all = @($a.Keys) + @($b.Keys) | Sort-Object -Unique
  $changed = @(); $unintended = @(); $volatile = @()
  foreach ($k in $all) {
    $va = if ($a.Contains($k)) { $a[$k] } else { '(absent)' }
    $vb = if ($b.Contains($k)) { $b[$k] } else { '(absent)' }
    if ($va -eq $vb) { continue }
    $row = [pscustomobject]@{ key = $k; before = $va; after = $vb }
    if (Test-KeyIn $k $VolatilePrefixes) { $volatile += $row; continue }
    if (Test-KeyIn $k $intended) { $changed += $row } else { $unintended += $row }
  }
  foreach ($r in $changed) { Write-LabLog "VERIFY intended  : $($r.key)  $($r.before) -> $($r.after)" }
  foreach ($r in $volatile) { Write-LabLog "VERIFY volatile  : $($r.key)  $($r.before) -> $($r.after) (moves on its own; reported, not judged)" }
  foreach ($r in $unintended) { Write-LabLog "VERIFY UNINTENDED: $($r.key)  $($r.before) -> $($r.after)" }
  $result = [pscustomobject]@{ ok = ($unintended.Count -eq 0); injectionActive = [bool]$record; intendedKeys = $intended; changedIntended = $changed; changedUnintended = $unintended; volatile = $volatile; excludedSkipped = $now.excludedSkipped }
  Save-Json $result (Join-Path $StateDir 'verify-last.json')
  if ($Json) { $result | ConvertTo-Json -Depth 6 }
  if ($unintended.Count -gt 0) { Write-LabLog "VERIFY: FAIL - $($unintended.Count) key(s) changed outside the intended set."; exit 1 }
  Write-LabLog "VERIFY: OK - nothing changed outside the intended keys ($($changed.Count) intended change(s), $($volatile.Count) volatile)."
}

# -- Restore (always safe) ------------------------------------------------------------------------------------------
function Invoke-Restore {
  if (-not (Test-IsAdmin)) { Invoke-Elevated @('-Restore') }
  $record = Get-ActiveRecord
  $base = Read-Json $BaselineFile
  $baseMap = ConvertTo-KeyMap $base
  $failed = 0
  $toStart = New-Object System.Collections.ArrayList
  $resumePrinter = $false
  if ($record) {
    Write-LabLog 'RESTORE: undoing the recorded injection.'
    foreach ($f in @($record.faults)) {
      $def = $RealFaults[[string]$f.id]
      if ($def -and $def.service -and $f.injected -and $f.before -and $f.before.Status -eq 'Running') { [void]$toStart.Add($def.service) }
      if ($f.pausedPrinter) { $resumePrinter = $true }
    }
  } elseif ($base) {
    Write-LabLog 'RESTORE: no injection record - restoring from the baseline snapshot.'
    foreach ($id in $RealFaults.Keys) { $svc = $RealFaults[$id].service; if ($svc -and $baseMap["services.$svc.Status"] -eq 'Running') { [void]$toStart.Add($svc) } }
    if ($baseMap['printers.labPrinter'] -eq 'Normal') { $resumePrinter = $true }
  } else {
    Write-LabLog 'RESTORE: no record and no baseline - conservative restore (Automatic lab services that are stopped are started).'
    foreach ($id in $RealFaults.Keys) { $name = $RealFaults[$id].service; if (-not $name) { continue }; $svc = Get-Service -Name $name -ErrorAction SilentlyContinue; if ($svc -and [string]$svc.StartType -eq 'Automatic') { [void]$toStart.Add($name) } }
  }
  # The spooler first (the queue can only be resumed while it runs).
  $ordered = @($toStart | Sort-Object -Unique | Sort-Object { if ($_ -eq 'Spooler') { 0 } else { 1 } })
  foreach ($name in $ordered) {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (-not $svc) { continue }
    if ($svc.Status -eq 'Running') { Write-LabLog "RESTORE: $name is already running."; continue }
    Write-LabLog "RESTORE: Start-Service -Name $name"
    try { Start-Service -Name $name -ErrorAction Stop; Write-LabLog "RESTORE: $name is $((Get-Service -Name $name).Status)." }
    catch { $failed++; Write-LabLog "RESTORE: starting $name failed - $($_.Exception.Message)" }
  }
  if ($resumePrinter) {
    try {
      $p = Get-CimInstance -ClassName Win32_Printer -Filter ("Name='{0}'" -f $LabPrinter) -ErrorAction Stop | Select-Object -First 1
      if ($p) { Write-LabLog "RESTORE: Invoke-CimMethod Win32_Printer('$LabPrinter').Resume"; $res = Invoke-CimMethod -InputObject $p -MethodName Resume -ErrorAction Stop; Write-LabLog "RESTORE: queue resumed (return $($res.ReturnValue))." }
    } catch { $failed++; Write-LabLog "RESTORE: resuming the queue failed - $($_.Exception.Message)" }
  }
  if (Test-Path -LiteralPath $LabRoot) {
    [void](Assert-Allowed $LabRoot)
    if ((Split-Path -Leaf $LabRoot) -eq 'aria-fault-lab') {
      Write-LabLog "RESTORE: Remove-Item $LabRoot (the lab's own junk folder only)"
      try { Remove-Item -LiteralPath $LabRoot -Recurse -Force -ErrorAction Stop } catch { $failed++; Write-LabLog "RESTORE: removing the junk folder failed - $($_.Exception.Message)" }
    }
  }
  if ($record) { $record.restoredAt = (Get-Date).ToUniversalTime().ToString('o'); Save-Json $record $RecordFile }
  if ($failed -gt 0) { Write-LabLog "RESTORE: $failed step(s) failed - see above. Re-run -Restore, or restart the computer (Windows starts Automatic services itself)."; exit 1 }
  Write-LabLog 'RESTORE: done.'
}

# -- Dispatch -------------------------------------------------------------------------------------------------------
switch ($PSCmdlet.ParameterSetName) {
  'Snapshot' {
    $snap = Get-LabSnapshot
    $target = $BaselineFile
    if ((Test-Path -LiteralPath $BaselineFile) -and (Get-ActiveRecord)) { $target = Join-Path $StateDir ('snapshot-{0}.json' -f (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')); Write-LabLog 'SNAPSHOT: an injection is live - the baseline is kept; this snapshot is saved beside it.' }
    Save-Json $snap $target
    Write-LabLog "SNAPSHOT: $(@($snap.keys.Keys).Count) keys -> $target"
    if ($Json) { $snap | ConvertTo-Json -Depth 6 }
  }
  'Inject' { Invoke-Inject $Inject }
  'Verify' { Invoke-Verify }
  'Restore' { Invoke-Restore }
  default {
    Write-Output 'ARIA Sentinel real-Windows fault lab - injected for real (reversible):'
    foreach ($id in $RealFaults.Keys) { $f = $RealFaults[$id]; Write-Output ('  {0,-14} {1}  {2,-26} {3,-6} admin={4}  {5}' -f $id, $f.level, $f.recipe, $f.color, $f.admin, $f.what) }
    Write-Output 'Simulated only (refused here; see tests/lib/fault-lab.mjs):'
    foreach ($id in $SimulatedOnly.Keys) { Write-Output ('  {0,-21} {1}' -f $id, $SimulatedOnly[$id]) }
  }
}
exit 0
