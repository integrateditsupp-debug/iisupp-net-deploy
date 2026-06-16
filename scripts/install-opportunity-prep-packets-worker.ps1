$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$Runner = Join-Path $RepoRoot "scripts\run-opportunity-prep-packets-agent.ps1"
$StateDir = Join-Path $RepoRoot "senior-director-state\opportunity-engine"
$TaskName = "IIS Opportunity Prep Packets Hourly"

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
  -At (Get-Date).AddMinutes(25) `
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

npm run opportunities:prep

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Principal $Principal `
  -Description "Refreshes IIS Opportunity Engine prep packets for top jobs, tenders, contracts, and vendor portals. No external sends/submits/applies." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName

$Heartbeat = @{
  taskName = $TaskName
  installedAt = (Get-Date).ToString("o")
  intervalMinutes = 60
  mode = "opportunity prep packet refresh"
  rule = "Refresh CEO-final-action packets without sending, submitting, applying, creating accounts, paying, signing, or certifying."
} | ConvertTo-Json -Depth 4

Set-Content -LiteralPath (Join-Path $StateDir "prep-packets-worker-heartbeat.json") -Value $Heartbeat -Encoding UTF8

Write-Output "Installed and started Scheduled Task: $TaskName"
Write-Output "Runs every 60 minutes while Windows can run scheduled tasks."
