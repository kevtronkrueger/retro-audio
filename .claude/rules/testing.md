---
paths:
  - "tests/**/*.ts"
---
# Testing Standards

- Use WebAudioMock from `tests/mocks/WebAudioMock.ts` for audio tests
- Tests should not depend on actual audio playback
- Use descriptive test names explaining the behavior
- Mock external dependencies, especially AudioContext
- Keep tests isolated - no shared mutable state
