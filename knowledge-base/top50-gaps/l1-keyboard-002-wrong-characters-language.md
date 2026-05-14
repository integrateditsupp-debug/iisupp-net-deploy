---
id: l1-keyboard-002
title: "Keyboard typing wrong characters — language switched accidentally"
category: keyboard
support_level: L1
severity: low
estimated_time_minutes: 3
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - keyboard wrong characters
  - typing wrong letters
  - keyboard language changed
  - at sign typing quote
  - shift 2 wrong character
  - input language switched
  - keyboard layout reset
  - dead keys typing accents
tags:
  - keyboard
  - input
  - language
  - top-50
related: [l1-input-001-keyboard-mouse-not-working]
---

# Keyboard typing wrong characters

### @ types as " (or other Shift-key swaps) → keyboard set to UK / wrong region

You hit Win+Space (Windows) or Cmd+Space accidentally and switched layouts. Quick check: Windows — bottom-right taskbar shows a small "ENG" or "FR" or similar. Click it → switch back to US (or your correct one). Mac: menu bar top-right shows flag/letters. Click → pick correct.

### Cycle through input methods to verify

Windows: Win + Space (hold Win, tap Space repeatedly) cycles through installed languages. Mac: Cmd + Space if shortcut enabled, OR Ctrl + Space. Try pressing once to swap, type a test "@" — if right now, that was it.

### Remove unwanted languages so you can't accidentally switch

Windows: Settings → Time & language → Language & region → click each unwanted language → Remove. Keep only the one(s) you actually use. Mac: System Settings → Keyboard → Input Sources → minus button to remove extras.

### Disable the hotkey that switched it

Win+Space and Ctrl+Shift are common accidents. Windows: Settings → Time & language → Typing → Advanced keyboard settings → Input language hot keys → change or disable Win+Space switch. Mac: System Settings → Keyboard → Keyboard Shortcuts → Input Sources → uncheck the switcher hotkeys.

### Number row types as French / Spanish characters

You're on AZERTY (French) or another layout instead of QWERTY. Visible test: press the key labeled `Q` — if it types `A`, you're on AZERTY. Switch via the language indicator (taskbar/menu bar). Or Windows: Win + Space. Confirm by typing the alphabet — should match the printed keys.

### Caps Lock LED is off but everything types uppercase

Sticky Keys or accessibility option active. Windows: Settings → Accessibility → Keyboard → Sticky Keys off. Tap Shift 5 times if that's the accidental trigger. Mac: System Settings → Accessibility → Keyboard → Sticky Keys off.

### Specific keys broken (not whole keyboard)

That's hardware, not language. See KB l1-input-001 for stuck/dead keys. Or external keyboard: unplug + replug, try a different USB port. Laptop keyboard with a few dead keys → physical cleaning or replacement.

### Mac: dead keys typing accents (option-key behavior)

You're on US-International layout. Mac System Settings → Keyboard → Input Sources → remove "U.S. International - PC" or "ABC - Extended" → keep plain "ABC" (US). Restart any open apps; dead-key behavior disappears.

### When to escalate to L2

Language indicator missing entirely from system tray (Windows display issue). Hardware keyboard pristine but laptop keyboard whole rows dead — physical replacement. After Windows feature update, keyboard layouts reset and won't stick after re-config — L2 checks policy.
