$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$Runner = Join-Path $RepoRoot "scripts\run-opportunity-engine-once.ps1"
$StateDir = Join-Path $RepoRoot "senior-director-state\opportunity-engine"
$TaskName = "IIS Opportunity Engine Hourly"

if (!(Test-Path -LiteralPath $Runner)) {
  throw "Runner script not found: $Runner"
}

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

$PowerShell = (Get-Command powershell.exe).Source
$Action = New-ScheduledTaskAction `
  -Execute $PowerShell `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`"" `
  -WorkingDirectory $RepoRoot

$Trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(5) `
  -RepetitionInterval (New-TimeSpan -Hours 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -RestartCount 2 `
  -RestartInterval (New-TimeSpan -Minutes 5) `
  -WakeToRun

$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

npm run opportunities:once

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Principal $Principal `
  -Description "Runs the Integrated IT Support no-paid-API Opportunity Engine hourly for tenders, jobs, vendor portals, and growth opportunities. No external send/submit/apply actions." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName

$Heartbeat = @{
  taskName = $TaskName
  installedAt = (Get-Date).ToString("o")
  intervalMinutes = 60
  mode = "24/7 backend research and review"
  communicationRule = "Prepare anytime; external communication remains approval-gated and should be timed to recipient 8-5 business hours."
} | ConvertTo-Json -Depth 4

Set-Content -LiteralPath (Join-Path $StateDir "worker-heartbeat.json") -Value $Heartbeat -Encoding UTF8

Write-Output "Installed and started Scheduled Task: $TaskName"
Write-Output "Runs every 60 minutes while Windows can run scheduled tasks."
Write-Output "State: $StateDir"
