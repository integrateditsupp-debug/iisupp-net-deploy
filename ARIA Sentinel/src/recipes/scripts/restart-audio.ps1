# ARIA Sentinel recipe: audio-no-output-v1 / restart-audio  (R-11 AUDIO.MUTE)
# Reversible green. Restarts Windows Audio and Audio Endpoint Builder; output devices
# re-enumerate automatically. No device, driver or volume setting is modified.
# Source-of-truth mirror of the command in src/shared/recipes.mjs (executed inline via -Command).
Restart-Service Audiosrv,AudioEndpointBuilder -Force
