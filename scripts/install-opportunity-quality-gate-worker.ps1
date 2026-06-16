$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$Runner = Join-Path $RepoRoot "scripts\run-opportunity-quality-gate-agent.ps1"
$StateDir = Join-Path $RepoRoot "senior-director-state\opportunity-engine"
$TaskName = "IIS Opportunity Quality Gate Hourly"

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
  -At (Get-Date).AddMinutes(18) `
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

npm run opportunities:quality

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Principal $Principal `
  -Description "Runs the IIS Opportunity Engine quality gate hourly to park weak-fit items before prep packets refresh. No external sends/submits/applies." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName

$Heartbeat = @{
  taskName = $TaskName
  installedAt = (Get-Date).ToString("o")
  intervalMinutes = 60
  mode = "opportunity quality gate"
  rule = "Park weak-fit opportunities before routing/prep. No external action."
} | ConvertTo-Json -Depth 4

Set-Content -LiteralPath (Join-Path $StateDir "quality-gate-worker-heartbeat.json") -Value $Heartbeat -Encoding UTF8

Write-Output "Installed and started Scheduled Task: $TaskName"
Write-Output "Runs every 60 minutes while Windows can run scheduled tasks."
