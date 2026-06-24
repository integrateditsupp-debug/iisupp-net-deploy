# Linux (Fedora / RHEL)

## Architecture
Fedora and Red Hat Enterprise Linux (RHEL) — along with downstreams like Rocky Linux and AlmaLinux — are GNU/Linux distributions on the **Linux kernel** with the GNU userland. The native package format is the **`.rpm`**, managed by **DNF** (the `dnf` command, successor to `yum`) over **rpm**; **Flatpak** is the preferred desktop app sandbox. Fedora also offers immutable/atomic variants (**Fedora Silverblue/Kinoite**) managed with **`rpm-ostree`**. The default login shell is **Bash** (`/bin/bash`), init/service management is **systemd**, and **GNOME** is the default desktop on Fedora Workstation and RHEL.

Security model:
- **SELinux in enforcing mode by default** — the defining trait of this family; mandatory access control labels every process and file (targeted policy). Booleans tune behavior (`getsebool`/`setsebool`).
- **POSIX users/groups + `sudo`** for privilege escalation; **Polkit** governs desktop privileged actions.
- **firewalld** is the default host firewall (zone-based).
- **UEFI Secure Boot** supported with signed shim/GRUB/kernel; kernel modules signed.
- **LUKS full-disk encryption** offered at install; on atomic variants the OS image is immutable and updated transactionally.

## Settings access
On GNOME, open **Settings** from the app grid or the top-right system menu.
- **Wi-Fi:** Settings > Wi-Fi (or the network icon in the top bar)
- **Bluetooth:** Settings > Bluetooth
- **Display:** Settings > Displays
- **Sound:** Settings > Sound
- **Storage:** Use **Disk Usage Analyzer** (baobab) or **Disks** (gnome-disks); CLI: `df -h`
- **Accounts:** Settings > Online Accounts (cloud) and Settings > Users (local accounts)
- **Updates:** **Software** (GNOME Software) > Updates; CLI: `sudo dnf upgrade` (atomic: `rpm-ostree upgrade`)
- **Privacy:** Settings > Privacy (location, screen lock, file history, diagnostics)

## Common pain points
1. **Wi-Fi not connecting** — Reconnect from the top-bar network menu; CLI: `nmcli device wifi list` then `nmcli device wifi connect "SSID"`.
2. **SELinux blocking an app/service ("permission denied" with no obvious cause)** — Check `sudo ausearch -m avc -ts recent` or `sealert`; fix the label with `restorecon -Rv /path` or set the right boolean — do NOT just disable SELinux.
3. **No sound / wrong device** — Settings > Sound to choose output; restart audio: `systemctl --user restart pipewire pipewire-pulse`.
4. **DNF transaction fails / cache issues** — `sudo dnf clean all` then `sudo dnf makecache`; for a stuck transaction, `sudo dnf distro-sync`.
5. **Disk full ( / partition)** — `sudo dnf clean all`, remove old kernels (`sudo dnf remove $(dnf repoquery --installonly --latest-limit=-2 -q)`), and `journalctl --vacuum-time=7d`.
6. **NVIDIA / proprietary driver missing** — Enable RPM Fusion and install `akmod-nvidia`; reboot.
7. **System won't reach desktop** — Boot a previous kernel from GRUB or switch to multi-user target (see Safe-mode).
8. **firewalld blocking a service/port** — `sudo firewall-cmd --list-all`; open with `sudo firewall-cmd --add-service=... --permanent` then `--reload`.
9. **Bluetooth won't pair** — `bluetoothctl`: `power on`, `scan on`, `pair <MAC>`; or re-add in Settings > Bluetooth.
10. **Slow boot** — `systemd-analyze blame`; disable unneeded units with `sudo systemctl disable <service>`.

## Voice-guidable steps
ARIA dictates; the user types/clicks. ARIA never runs commands for the user.

- **Connect to Wi-Fi:** "Click the network icon in the top-right corner, choose Wi-Fi, then Select Network. Click your network, type the password, and click Connect."
- **Update the system (GUI):** "Open the Software app from the app grid, click the Updates tab, then click Update or Download, and enter your password."
- **Update the system (terminal):** "Open a Terminal and type: sudo space dnf space upgrade, press Enter, enter your password, and type y to confirm."
- **Check SELinux status:** "Open a Terminal and type: getenforce, then press Enter. It should say Enforcing."
- **Check free disk space:** "Open a Terminal and type: df space dash h, then press Enter, and look at the line ending in slash."
- **Restart networking:** "Open a Terminal and type: sudo space systemctl space restart space NetworkManager, then press Enter and your password."

## Hardware diagnostic commands
Run these in a terminal. All are **READ-ONLY** — they report state and make no changes.

- `df -h` — disk space per filesystem. READ-ONLY.
- `free -h` — RAM and swap. READ-ONLY.
- `top` / `htop` — live CPU and memory. READ-ONLY.
- `lscpu` — CPU details. READ-ONLY.
- `lspci` — PCI devices (GPU, NIC). READ-ONLY.
- `lsusb` — USB devices. READ-ONLY.
- `lsblk` — block devices/partitions. READ-ONLY.
- `dmesg` (or `sudo dmesg`) — kernel/boot messages. READ-ONLY.
- `journalctl -b` / `journalctl -p err -b` — systemd journal for this boot. READ-ONLY.
- `getenforce` / `sestatus` — SELinux mode and status. READ-ONLY.
- `sudo ausearch -m avc -ts recent` — recent SELinux denials. READ-ONLY.
- `sensors` (lm_sensors) — temps/fans. READ-ONLY.
- `sudo smartctl -a /dev/sda` — drive SMART health (reading only). READ-ONLY.

## Network reset procedure
1. Toggle Wi-Fi off and on from the top-bar network menu.
2. Restart the stack: `sudo systemctl restart NetworkManager`.
3. Forget and rejoin: Settings > Wi-Fi > (gear) > Forget Connection, then reconnect; or `nmcli connection delete "SSID"` and reconnect.
4. Flush DNS (systemd-resolved): `sudo resolvectl flush-caches`.
5. Verify the firewall isn't the cause: `sudo firewall-cmd --list-all`.
6. If a connection profile is corrupt, the file lives in `/etc/NetworkManager/system-connections/` (root); delete and recreate it, then reboot.

## Safe-mode equivalent
- **GRUB recovery / previous kernel:** At boot, press **Esc** to reach the GRUB menu, then choose an older kernel or a **rescue** entry to recover from a bad update.
- **Rescue / emergency target:** Press `e` at the GRUB entry and append `systemd.unit=rescue.target` (single-user maintenance shell) or `systemd.unit=emergency.target` (most minimal) to the `linux` line, then Ctrl-X to boot.
- **Multi-user (no GUI):** Append `systemd.unit=multi-user.target` to bypass a broken desktop; set persistently with `sudo systemctl set-default multi-user.target` (revert with `graphical.target`).
- **SELinux relabel (fixes label-related boot failures):** Append `autorelabel=1` (or `touch /.autorelabel` then reboot) to relabel the filesystem on next boot.
- **Atomic variants (Silverblue/Kinoite):** At the GRUB menu pick the **previous deployment** to roll back instantly, or run `rpm-ostree rollback`.

## Backup/restore mechanism
- **Déjà Dup ("Backups"):** GNOME's built-in encrypted, scheduled backup tool to local/network/cloud, with simple restore.
- **Btrfs snapshots:** Fedora defaults to the **Btrfs** filesystem, enabling fast snapshots (e.g., via `snapper` or `btrfs subvolume snapshot`) for point-in-time system rollback. READ-WRITE — use on the intended subvolume only.
- **rpm-ostree (atomic variants):** Every update is a versioned, bootable deployment; `rpm-ostree rollback` reverts to the prior known-good image — effectively built-in OS backup/restore.
- **rsync / tar:** Scriptable file-level backups, e.g. `rsync -aAXv --delete /home/ /mnt/backup/home/` or `tar -czf home.tar.gz /home/user` (READ-WRITE — confirm the destination first).
- **Package list:** `dnf repoquery --installed > pkglist.txt` to rebuild a system later.
- **Restore:** Use the matching tool — Déjà Dup restore, snapshot rollback, `rpm-ostree rollback`, or `rsync`/`tar` extraction.
