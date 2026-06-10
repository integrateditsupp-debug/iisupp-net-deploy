$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$Runner = Join-Path $RepoRoot "scripts\run-senior-director-worker.ps1"
$Worker = Join-Path $RepoRoot "scripts\senior-director-worker.mjs"
$StateDir = Join-Path $RepoRoot "senior-director-state"
$TaskName = "IIS Senior Director Agent Worker"

if (!(Test-Path -LiteralPath $Worker)) {
  throw "Worker script not found: $Worker"
}

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

$PowerShell = (Get-Command powershell.exe).Source
$Action = New-ScheduledTaskAction `
  -Execute $PowerShell `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`"" `
  -WorkingDirectory $RepoRoot

$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 5)

$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

node $Worker --once --install-note

$installedScheduledTask = $false
try {
  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Runs the Integrated IT Support Senior Director Agent background worker for ARIA, L1/L2 lead monitoring, and Codex/Claude/OpenClaw coordination." `
    -Force | Out-Null
  Start-ScheduledTask -TaskName $TaskName
  $installedScheduledTask = $true
} catch {
  $Startup = [Environment]::GetFolderPath("Startup")
  $ShortcutPath = Join-Path $Startup "IIS Senior Director Agent Worker.lnk"
  $Shell = New-Object -ComObject WScript.Shell
  $Shortcut = $Shell.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath = $PowerShell
  $Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`""
  $Shortcut.WorkingDirectory = $RepoRoot
  $Shortcut.Description = "Integrated IT Support Senior Director Agent background worker"
  $Shortcut.Save()

  Start-Process `
    -FilePath $PowerShell `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`"" `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden

  Write-Output "Scheduled Task registration was blocked; installed Startup shortcut fallback instead."
  Write-Output "Startup shortcut: $ShortcutPath"
}

if ($installedScheduledTask) {
  Write-Output "Installed and started Scheduled Task: $TaskName"
} else {
  Write-Output "Installed and started Startup background worker: $TaskName"
}
Write-Output "State: $StateDir"
Write-Output "Heartbeat: $(Join-Path $StateDir 'heartbeat.json')"
