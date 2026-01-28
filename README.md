# Retro Audio Engine

A lightweight, embeddable Web Audio synthesizer engine that emulates 8-bit sound hardware (Game Boy DMG style). Consumes JSON sound definitions and plays them in any web application.

## Features

- **4-Channel Audio** - Pulse (x2), Wave, and Noise channels matching classic hardware
- **ADSR Envelopes** - Full attack/decay/sustain/release with linear and exponential curves
- **Pitch Effects** - Slides, vibrato, and arpeggios with sample-accurate timing
- **Voice Management** - Automatic voice pooling with configurable stealing modes
- **Pattern Sequencer** - BPM-synced playback with mute/solo per channel
- **Zero Dependencies** - Pure Web Audio API, no external runtime dependencies
- **TypeScript First** - Full type definitions included
- **Tiny Bundle** - ~11KB gzipped

## Installation

```bash
npm install retro-audio
```

Or use directly in a browser:

```html
<script src="https://unpkg.com/retro-audio/dist/index.min.js"></script>
```

## Quick Start

```typescript
import { RetroAudio } from 'retro-audio';

// Create instance
const audio = new RetroAudio();

// Initialize on user gesture (required by browsers)
document.querySelector('#start').addEventListener('click', async () => {
  await audio.init();

  // Play a simple beep
  const beep = {
    version: '1.0',
    type: 'sfx',
    name: 'Beep',
    instrument: {
      id: 'beep',
      name: 'Beep',
      channel: 'pulse1',
      waveform: { type: 'pulse', duty: 0.5 },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 },
      volume: 0.8
    },
    note: 'C5',
    duration: 0.2
  };

  audio.playSfx(beep);
});
```

## Usage

### Playing Sound Effects

```typescript
// Using SfxData format
const coinSfx = await fetch('/sounds/coin.json').then(r => r.json());
const instance = audio.playSfx(coinSfx);

// Or directly with an instrument
const instrument = {
  id: 'laser',
  name: 'Laser',
  channel: 'pulse1',
  waveform: { type: 'pulse', duty: 0.125 },
  envelope: { attack: 0, decay: 0.3, sustain: 0, release: 0 },
  pitch: { slide: -24, slideTime: 0.3 },
  volume: 0.7
};
audio.playSfx(instrument, 'C6');

// Control the playing sound
instance.fadeOut(0.5);  // Fade out over 0.5 seconds
instance.stop();        // Stop immediately
await instance.finished; // Wait for completion
```

### Real-Time Synth

```typescript
// Create a synth for live playing
const synth = audio.createSynth({
  id: 'lead',
  name: 'Lead',
  channel: 'pulse1',
  waveform: { type: 'pulse', duty: 0.25 },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 },
  pitch: { vibratoDepth: 0.5, vibratoSpeed: 5 },
  volume: 0.8
});

// Play notes
synth.noteOn('C4');       // Play middle C
synth.noteOn('E4', 0.5);  // Play E with velocity 0.5
synth.noteOff();          // Release

// Update parameters in real-time
synth.updateEnvelope({ attack: 0.2 });
synth.setWaveform({ type: 'pulse', duty: 0.5 });

// Clean up when done
synth.dispose();
```

### Pattern Playback

```typescript
const pattern = {
  id: 'intro',
  name: 'Intro Pattern',
  steps: 16,
  stepsPerBeat: 4,
  channels: {
    pulse1: [
      { step: 0, note: 'C4', instrumentId: 'lead' },
      { step: 4, note: 'E4', instrumentId: 'lead' },
      { step: 8, note: 'G4', instrumentId: 'lead' },
      { step: 12, note: 'C5', instrumentId: 'lead' }
    ],
    pulse2: [],
    wave: [],
    noise: []
  }
};

// Load instruments first
audio.loadInstruments([leadInstrument]);

// Play the pattern
const player = audio.playPattern(pattern, { bpm: 120, loop: true });

// Control playback
player.pause();
player.play();
player.stop();
player.bpm = 140;  // Change tempo in real-time

// Mute/solo channels
player.setChannelMute('noise', true);
player.setChannelSolo('pulse1', true);

// React to events
player.onStep = (step) => console.log(`Step: ${step}`);
player.onEnd = () => console.log('Pattern ended');
```

### Song Playback

```typescript
const song = await fetch('/music/level1.json').then(r => r.json());
const player = audio.playSong(song);

// Navigate between patterns
player.seekToPattern(2);
player.nextPattern();
player.previousPattern();

// Events
player.onPatternChange = (index, patternId) => {
  console.log(`Now playing: ${patternId}`);
};
```

## API Reference

### RetroAudio

The main class that orchestrates all audio functionality.

```typescript
const audio = new RetroAudio({
  sampleRate: 44100,           // Audio sample rate
  latencyHint: 'interactive',  // 'interactive' | 'balanced' | 'playback'
  maxVoices: 8,                // Maximum concurrent voices
  voiceStealingMode: 'oldest'  // 'oldest' | 'quietest' | 'none'
});
```

#### Methods

| Method | Description |
|--------|-------------|
| `init()` | Initialize audio context (call on user gesture) |
| `suspend()` | Pause audio processing |
| `resume()` | Resume audio processing |
| `playSfx(sfx)` | Play a sound effect |
| `createSynth(instrument)` | Create a real-time synth |
| `playPattern(pattern, options)` | Play a pattern |
| `playSong(song)` | Play a song |
| `loadInstruments(instruments)` | Load instruments for playback |
| `getInstrument(id)` | Get an instrument by ID |
| `clearInstruments()` | Clear all loaded instruments |
| `stopAll()` | Stop all playing sounds |
| `dispose()` | Clean up all resources |

#### Properties

| Property | Description |
|----------|-------------|
| `state` | Current state: `'uninitialized'` \| `'running'` \| `'suspended'` |
| `masterVolume` | Master volume (0.0 - 1.0) |
| `currentTime` | Current audio context time |
| `onStateChange` | Callback for state changes |

### Channel Types

| Channel | Description |
|---------|-------------|
| `pulse1` | First pulse wave channel (square with duty cycle) |
| `pulse2` | Second pulse wave channel |
| `wave` | Wavetable channel (triangle, sawtooth, or custom) |
| `noise` | LFSR noise channel (long or short mode) |

### Waveform Configurations

```typescript
// Pulse waves (pulse1, pulse2)
{ type: 'pulse', duty: 0.5 }  // 0.125, 0.25, 0.5, or 0.75

// Wave channel
{ type: 'triangle' }
{ type: 'sawtooth' }
{ type: 'custom', wavetable: [0,2,4,6,8,10,12,14,15,14,12,10,8,6,4,2,...] }

// Noise channel
{ type: 'noise', mode: 'long' }   // 15-bit LFSR (default)
{ type: 'noise', mode: 'short' }  // 7-bit LFSR (metallic)
```

### Envelope Configuration

```typescript
{
  attack: 0.01,           // Attack time in seconds (0-5)
  decay: 0.1,             // Decay time in seconds (0-5)
  sustain: 0.7,           // Sustain level (0-1)
  release: 0.2,           // Release time in seconds (0-5)
  attackCurve: 'linear',  // 'linear' | 'exponential'
  decayCurve: 'exponential',
  releaseCurve: 'exponential'
}
```

### Pitch Effects

```typescript
{
  slide: -12,           // Semitones to slide (negative = down)
  slideTime: 0.5,       // Slide duration in seconds
  vibratoDepth: 0.5,    // Vibrato depth in semitones (0-2)
  vibratoSpeed: 5,      // Vibrato speed in Hz (0-20)
  arpeggio: [0, 4, 7],  // Semitone offsets (major chord)
  arpeggioSpeed: 12     // Notes per second
}
```

## JSON Schema

### Sound Effect (SfxData)

```json
{
  "version": "1.0",
  "type": "sfx",
  "name": "Coin",
  "instrument": { ... },
  "note": "E6",
  "duration": 0.3
}
```

### Song (SongData)

```json
{
  "version": "1.0",
  "type": "song",
  "name": "Level 1",
  "bpm": 120,
  "instruments": [ ... ],
  "patterns": [ ... ],
  "sequence": ["intro", "verse", "chorus"],
  "loop": true,
  "loopPoint": 1
}
```

## Browser Support

- Chrome 66+
- Firefox 76+
- Safari 14.1+
- Edge 79+

## Handling Audio Interruptions

Mobile browsers may suspend audio for calls or system events:

```typescript
audio.onStateChange = (state) => {
  if (state === 'suspended') {
    showResumeButton();
  } else if (state === 'running') {
    hideResumeButton();
  }
};

// Resume on user gesture
resumeButton.onclick = () => audio.resume();
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - See [LICENSE](LICENSE) for details.
