# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-27

### Added

- Initial release of Retro Audio Engine
- **Core Audio System**
  - Web Audio API-based audio engine with state management
  - Support for mobile audio interruptions and browser autoplay policies
  - Master volume control
- **4 Channel Types**
  - Pulse channels (x2) with variable duty cycles (12.5%, 25%, 50%, 75%)
  - Wave channel with triangle, sawtooth, and custom 32-sample wavetables
  - Noise channel with LFSR implementation (long/short modes)
- **Voice Management**
  - Configurable voice pool (default 8 voices)
  - Voice stealing modes: oldest, quietest, or none
  - Automatic voice cleanup after envelope completion
- **ADSR Envelopes**
  - Full attack/decay/sustain/release parameters
  - Linear and exponential curve options for each phase
- **Pitch Effects**
  - Pitch slides (portamento)
  - Vibrato with configurable depth and speed
  - Arpeggiator with sample-accurate timing
- **Playback System**
  - Pattern sequencer with BPM control
  - Song player with pattern sequences
  - Channel mute/solo functionality
  - Step and pattern change callbacks
- **Sound Loading**
  - JSON schema validation for instruments, patterns, songs, and SFX
  - Instrument bank for managing loaded instruments
- **API Classes**
  - `RetroAudio` - Main orchestrator class
  - `Synth` - Real-time instrument control
  - `SoundInstance` - One-shot sound handle
  - `PatternPlayer` - Pattern playback controls
  - `SongPlayer` - Song playback controls
- **Utilities**
  - Note-to-frequency conversion with support for sharps, flats, and octaves
  - Frequency-to-note conversion
  - MIDI note number utilities
- **Build Outputs**
  - ES Module build
  - CommonJS build
  - Minified UMD build for browser `<script>` tags
  - Full TypeScript declarations
- **Documentation**
  - Comprehensive README with usage examples
  - Full API reference
  - TypeScript types for all public interfaces

### Technical Details

- Zero runtime dependencies
- ~11KB gzipped bundle size
- TypeScript strict mode
- Browser support: Chrome 66+, Firefox 76+, Safari 14.1+, Edge 79+

[1.0.0]: https://github.com/username/retro-audio-engine/releases/tag/v1.0.0
