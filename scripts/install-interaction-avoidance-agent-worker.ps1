$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$Runner = Join-Path $RepoRoot "scripts\run-interaction-avoidance-agent.ps1"
$StateDir = Join-Path $RepoRoot "senior-director-state"
$TaskName = "IIS Interaction Avoidance Agent Hourly"

if (!(Test-Path -LiteralPath $Runner)) {
  throw "Runner script not found: $Runner"
}

$PowerShell = (Get-Command powershell.exe).Source
$Action = New-ScheduledTaskAction `
  -Execute $PowerShell `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`"" `
  -WorkingDirectory $RepoRoot

$Trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(15) `
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

npm run interaction-avoidance:once

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Principal $Principal `
  -Description "Compresses IIS Opportunity Engine work into prep-agent packets and one-minute CEO final-action queues. No external sends/submits/applies." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName

$Heartbeat = @{
  taskName = $TaskName
  installedAt = (Get-Date).ToString("o")
  intervalMinutes = 60
  mode = "interaction avoidance and prep routing"
  rule = "Create agent prep packets before asking Ahmad; stop at hard risk gates and final external actions."
} | ConvertTo-Json -Depth 4

Set-Content -LiteralPath (Join-Path $StateDir "interaction-avoidance-worker-heartbeat.json") -Value $Heartbeat -Encoding UTF8

Write-Output "Installed and started Scheduled Task: $TaskName"
Write-Output "Runs every 60 minutes while Windows can run scheduled tasks."
