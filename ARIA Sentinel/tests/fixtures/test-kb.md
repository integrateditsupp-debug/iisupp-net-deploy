# IIS ARIA Test Knowledge Base (RUN 16 §G fixture)

20 targeted entries used to verify KB ingest + grounded retrieval. Each entry has a distinctive
fault code or keyword so retrieval can be asserted exactly. Committed LOCAL ONLY (test fixture; not
bundled in the customer build).

## Outlook OST corruption 0x800CCC0F
If Outlook crashes or stalls with error code 0x800CCC0F, close Outlook and rename the OST file at
%LOCALAPPDATA%\Microsoft\Outlook so Outlook rebuilds a fresh cached copy on next launch.

## Windows Update stuck 0x80070643
When Windows Update fails with 0x80070643, stop the wuauserv service, clear SoftwareDistribution,
restart the service, and re-run the update.

## DNS resolution failure ERR_NAME_NOT_RESOLVED
For ERR_NAME_NOT_RESOLVED in the browser, flush the DNS cache with ipconfig /flushdns and confirm the
DNS server setting before retrying the site.

## BSOD CRITICAL_PROCESS_DIED 0x000000EF
A CRITICAL_PROCESS_DIED stop code 0x000000EF usually means a corrupted system file; boot to recovery
and run sfc /scannow plus DISM RestoreHealth.

## Teams cache stuck signin
When Microsoft Teams hangs on the loading screen and will not sign in, quit Teams and clear the Teams
cache folder, then relaunch.

## OneDrive sync stuck processing
If OneDrive is stuck on "processing changes", reset OneDrive with onedrive.exe /reset and let it
re-index the local folder.

## VPN tunnel error 809
VPN connection error 809 indicates the gateway is unreachable through NAT; enable the
AssumeUDPEncapsulation registry value and retry the tunnel.

## Printer spooler offline
When a printer shows offline and the print queue is stuck, restart the Print Spooler service and
clear the stuck jobs in the spool folder.

## Disk almost full low space
If the C drive reports low space under 8 percent free, clear safe temp locations and old browser cache
to recover disk space.

## WiFi connected no internet 169.254
A 169.254 self-assigned address with WiFi connected but no internet points to a DHCP failure; release
and renew the IP lease and restart the adapter.

## Microsoft 365 activation unlicensed
If Microsoft 365 shows "unlicensed product", sign out and back into the Office account, then run an
online repair of the installation.

## Audio no output device missing
When there is no audio output and the speaker shows missing, restart the Windows Audio service and
re-enable the default playback device.

## Certificate expired NET::ERR_CERT_DATE_INVALID
NET::ERR_CERT_DATE_INVALID is almost always a wrong system clock; correct the date and time and
re-sync to the time server.

## Camera blocked permission
When the camera or microphone is blocked, check the Windows privacy permission toggles and allow the
specific app to access the device.

## Windows Defender signatures stale
If Defender reports stale antivirus signatures, run the signature update command to pull the latest
definitions immediately.

## Chrome tab crash Aw Snap
A repeating "Aw, Snap!" tab crash loop is usually a corrupt profile or extension; test in a new
profile and disable extensions one at a time.

## Bluetooth device not pairing
When a Bluetooth device will not pair, remove the device, restart the Bluetooth service, and re-pair
from scratch.

## Start menu not opening
If the Start menu will not open, restart the StartMenuExperienceHost process and re-register the
Start menu app package.

## Windows search broken not working
When Windows Search returns nothing, rebuild the search index from Indexing Options.

## USB drive not recognized
If a USB drive is not recognized, rescan disks in Device Manager and assign a drive letter in Disk
Management.
