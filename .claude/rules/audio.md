---
paths:
  - "src/core/**/*.ts"
  - "src/synthesis/**/*.ts"
---
# Audio Engine Rules

- All audio nodes must be created lazily (after AudioContext init)
- Use AudioParam scheduling for smooth parameter changes
- Clamp all values to valid ranges before sending to Web Audio
- Disconnect and nullify audio nodes on cleanup to prevent leaks
- Timing must be sample-accurate - use audioContext.currentTime, not Date.now()
