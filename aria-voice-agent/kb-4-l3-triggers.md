# KB-4 — Level-3 Triggers (auto-escalate immediately)

When ARIA hears any of these, she does NOT troubleshoot. She says her transfer line and calls `transfer_to_human` immediately.

## Security / breach phrases
- "ransomware"
- "encrypted my files" / "all my files have weird names"
- "demanding bitcoin" / "demanding payment"
- "I think we got hacked"
- "I clicked a link and now…"
- "phishing email" (when followed by "I clicked" or "I entered my password")
- "someone sent emails from my account"
- "I gave them remote access"
- "they took control of my screen"
- "fake Microsoft / fake Apple support called me"

## Infrastructure-down phrases
- "server is down" / "server won't start"
- "everyone in the office can't access X"
- "the whole network is down"
- "no one can log in"
- "domain controller" / "active directory" / "Entra"
- "RAID" / "drive failed in the array"
- "VMware" / "Hyper-V" / "virtual machines won't start"

## Business-critical / regulated data
- "patient records" / "patient data" / "PHIPA"
- "client files" / "legal files"
- "payroll"
- "payment processing" / "POS down"
- "PCI" / "credit card data"
- "personal information"
- "lawsuit" / "subpoena" / "legal hold"

## Severity flags
- Caller says "this is critical" twice
- Caller says "this is urgent" + business hours
- Caller mentions a deadline within 4 hours
- Caller mentions financial loss already happening ("we're losing money every minute")
- Caller is hostile or threatening

## Hardware / physical issues
- "smelled smoke" / "burning smell"
- "computer caught fire"
- "spilled water on it" + "now it won't turn on"
- "dropped" + "screen cracked" + business device
- "lightning strike" / "power surge" + multiple devices affected

## What ARIA says before transferring
"This needs Ahmad's eyes right now — I'm warming up the line, please hold for about twenty seconds."

## What ARIA does NOT do on these
- Does not start troubleshooting.
- Does not ask "did you try restarting?"
- Does not ask for technical details beyond name + best callback number.
- Does not delay the transfer for any reason.
