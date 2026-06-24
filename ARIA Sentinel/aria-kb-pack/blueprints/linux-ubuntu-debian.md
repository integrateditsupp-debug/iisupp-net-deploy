# Linux (Ubuntu / Debian)

## Architecture
Ubuntu and Debian are GNU/Linux distributions built on the **Linux kernel** with the GNU userland. The native package format is **`.deb`**, managed by **APT** (`apt` / `apt-get`) on top of **dpkg**; Ubuntu also ships **Snap** (snapd) and both support **Flatpak**. The default login shell is **Bash** (`/bin/bash`); `/bin/sh` is `dash` on Debian/Ubuntu. Modern releases use **systemd** as the init system and service manager, and **GNOME** is Ubuntu's default desktop (Debian offers a choice at install).

Security model:
- **POSIX users/groups + file permissions** with privilege escalation via **`sudo`** (Ubuntu disables the root login by default).
- **AppArmor** is the default Mandatory Access Control layer (profiles confine programs like browsers, snaps, and services); SELinux is available but not default here.
- **Snap packages** run confined with their own sandbox and interface-based permissions.
- **UEFI Secure Boot** is supported (Ubuntu ships signed shim + GRUB); kernel modules are signed.
- **Full-disk encryption** via LUKS is offered at install; **Polkit** governs fine-grained privileged actions in the desktop.

## Settings access
On GNOME (Ubuntu default), open **Settings** from the app grid or the top-right system menu.
- **Wi-Fi:** Settings > Wi-Fi (or the network icon in the top bar)
- **Bluetooth:** Settings > Bluetooth
- **Display:** Settings > Displays (resolution, scaling, multi-monitor)
- **Sound:** Settings > Sound
- **Storage:** Settings > About > nothing detailed here — use **Disk Usage Analyzer** (baobab) or **Disks** (gnome-disks); `df -h` in a terminal
- **Accounts:** Settings > Online Accounts (cloud accounts) and Settings > Users (local user accounts)
- **Updates:** **Software Updater** app, or Settings > (Ubuntu) "Software & Updates" for sources; CLI: `sudo apt update && sudo apt upgrade`
- **Privacy:** Settings > Privacy (location, screen lock, file history, diagnostics)

## Common pain points
1. **Wi-Fi not connecting** — Click the network icon, reconnect; CLI: `nmcli device wifi list` then `nmcli device wifi connect "SSID"`; restart NetworkManager (see Network reset).
2. **No sound / wrong output device** — Settings > Sound, pick the correct Output Device; restart audio with `systemctl --user restart pipewire pipewire-pulse` (or `pulseaudio -k`).
3. **"Could not get lock /var/lib/dpkg/lock"** — Another apt process is running; wait, or after confirming none run, fix with `sudo dpkg --configure -a`.
4. **Disk full ( / partition)** — `sudo apt clean`, remove old kernels with `sudo apt autoremove --purge`, and clear old logs with `journalctl --vacuum-time=7d`.
5. **Broken/held packages after upgrade** — `sudo apt --fix-broken install`, then `sudo apt update && sudo apt full-upgrade`.
6. **System won't boot to desktop (black screen)** — Often a GPU driver issue; boot a previous kernel or recovery from GRUB (see Safe-mode).
7. **Screen tearing / external monitor not detected** — Install/switch the proprietary NVIDIA driver via Software & Updates > Additional Drivers; re-check Settings > Displays.
8. **Bluetooth device won't pair** — `bluetoothctl` then `power on`, `scan on`, `pair <MAC>`; or remove & re-add in Settings > Bluetooth.
9. **Slow boot** — `systemd-analyze blame` to find the worst service; disable unneeded ones with `sudo systemctl disable <service>`.
10. **Snap apps slow to launch / sandbox errors** — `sudo snap refresh`; check confinement with `snap connections <app>`.

## Voice-guidable steps
ARIA dictates; the user types/clicks. ARIA never runs commands for the user.

- **Connect to Wi-Fi:** "Click the network icon in the top-right corner, choose Wi-Fi, then Select Network. Click your network name, type the password, and click Connect."
- **Update the system (GUI):** "Open the Activities or app grid, type 'Software Updater' and open it. When it lists updates, click Install Now and enter your password."
- **Update the system (terminal):** "Open a Terminal, type: sudo space apt space update, press Enter and your password. Then type: sudo space apt space upgrade, press Enter, and type y to confirm."
- **Check free disk space:** "Open a Terminal and type: df space dash h, then press Enter. Look at the line ending in slash for your main disk."
- **Find what's using space:** "Open Disk Usage Analyzer from the app grid, then click Scan on your home folder."
- **Restart networking:** "Open a Terminal and type: sudo space systemctl space restart space NetworkManager, then press Enter and your password."

## Hardware diagnostic commands
Run these in a terminal. All are **READ-ONLY** — they report hardware/system state and make no changes.

- `df -h` — disk space per filesystem. READ-ONLY.
- `free -h` — RAM and swap usage. READ-ONLY.
- `top` / `htop` — live process, CPU, and memory view. READ-ONLY.
- `lscpu` — CPU details. READ-ONLY.
- `lspci` — PCI devices (GPU, network, controllers). READ-ONLY.
- `lsusb` — connected USB devices. READ-ONLY.
- `lsblk` — block devices and partitions. READ-ONLY.
- `dmesg` (or `sudo dmesg`) — kernel ring buffer / boot & hardware messages. READ-ONLY.
- `journalctl -b` / `journalctl -p err -b` — systemd logs for this boot (errors only with -p err). READ-ONLY.
- `sensors` (lm-sensors) — temperatures and fan speeds. READ-ONLY.
- `inxi -Fxz` — full anonymized hardware summary. READ-ONLY.
- `sudo smartctl -a /dev/sda` — drive SMART health (reading attributes only). READ-ONLY.

## Network reset procedure
1. Toggle Wi-Fi off and on from the top-bar network menu.
2. Restart the network stack: `sudo systemctl restart NetworkManager`.
3. Forget and rejoin: Settings > Wi-Fi > (gear on the network) > Forget Connection, then reconnect; or `nmcli connection delete "SSID"` then reconnect.
4. Renew the lease (if on a wired/dynamic link): `sudo dhclient -r && sudo dhclient` (or let NetworkManager re-acquire it).
5. Flush DNS cache (systemd-resolved): `sudo resolvectl flush-caches`.
6. As a deeper reset, reboot; if a specific connection profile is corrupt, delete it under `/etc/NetworkManager/system-connections/` (requires sudo) and recreate it.

## Safe-mode equivalent
Linux uses the **GRUB recovery menu** and **systemd targets** instead of a single "safe mode."
- **GRUB recovery:** At boot, hold/press **Esc** (or **Shift**) to show the GRUB menu, choose **Advanced options for Ubuntu**, then a kernel entry marked **(recovery mode)**. The recovery menu offers safe actions: drop to a root shell, repair broken packages (`dpkg`), clean disk space, and check the filesystem (`fsck`).
- **Multi-user (no GUI) target:** To bypass a broken desktop, boot to text mode by editing the GRUB entry (press `e`) and appending `systemd.unit=multi-user.target` to the `linux` line, then Ctrl-X to boot. Set it persistently with `sudo systemctl set-default multi-user.target` (revert with `graphical.target`).
- **Single-user / emergency:** Append `single` or `systemd.unit=rescue.target` to the kernel line for a minimal maintenance shell.

## Backup/restore mechanism
- **Déjà Dup ("Backups" app):** GNOME's built-in tool (front-end to **restic/duplicity**); supports scheduled, encrypted backups to a local disk, network share, or cloud, and one-click restore. Open "Backups" from the app grid.
- **Timeshift:** Popular system snapshot tool (rsync or BTRFS snapshots) for restoring the OS to an earlier working state — ideal before risky upgrades. Install via `sudo apt install timeshift`.
- **rsync:** Scriptable file-level backups, e.g. `rsync -aAXv --delete /home/ /mnt/backup/home/` (READ-WRITE — only run with a known-good destination).
- **tar:** Archive a directory, e.g. `tar -czf home-backup.tar.gz /home/user`.
- **APT package list:** Capture installed packages with `dpkg --get-selections > pkglist.txt` to rebuild a system later.
- **Restore:** Use the same tool that created the backup (Déjà Dup restore, Timeshift restore, or `rsync`/`tar` extraction).
