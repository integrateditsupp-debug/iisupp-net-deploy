# install-sentry-worker.ps1 — register the Sentry inbox monitor as a Windows Scheduled Task at logon.
# Matches the existing fleet installer pattern. Sentry stays DORMANT until Gmail OAuth is configured
# (scripts/gmail-auth.mjs), so installing it is safe before OAuth. Registers under the current user.
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $PSScriptRoot 'run-sentry-worker.ps1'
$TaskName = 'IIS AXIS Sentry Inbox Monitor'

try {
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`"" -WorkingDirectory $RepoRoot
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Write-Output "Registered scheduled task: $TaskName (dormant until Gmail OAuth)."
} catch {
  # Fallback: Startup-folder shortcut
  $startup = [Environment]::GetFolderPath('Startup')
  $lnk = Join-Path $startup 'IIS-AXIS-Sentry.lnk'
  $ws = New-Object -ComObject WScript.Shell
  $sc = $ws.CreateShortcut($lnk)
  $sc.TargetPath = 'powershell.exe'
  $sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`""
  $sc.WorkingDirectory = $RepoRoot
  $sc.Save()
  Write-Output "Scheduled task registration failed ($($_.Exception.Message)); created Startup shortcut instead."
}
