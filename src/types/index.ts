/**
 * Retro Audio Engine - Type Definitions
 *
 * All TypeScript interfaces and types for the engine
 */

// Instrument types
export type {
  ChannelType,
  CurveType,
  PulseWaveformConfig,
  WaveWaveformConfig,
  NoiseWaveformConfig,
  WaveformConfig,
  EnvelopeConfig,
  PitchConfig,
  EffectsConfig,
  InstrumentData,
} from './Instrument';

// Pattern types
export type {
  NoteEffects,
  NoteEvent,
  ChannelPattern,
  PatternData,
  PlaybackOptions,
} from './Pattern';

// Song types
export type {
  SongData,
  SfxData,
  ProjectData,
} from './Song';

/**
 * Voice pool configuration
 */
export interface VoiceConfig {
  /** Maximum concurrent voices. Default: 8 */
  maxVoices: number;
  /** Voice stealing strategy. Default: 'oldest' */
  stealingMode: 'oldest' | 'quietest' | 'none';
}

/**
 * RetroAudio initialization options
 */
export interface RetroAudioOptions {
  /** Audio sample rate. Default: 44100 */
  sampleRate?: number;
  /** Latency hint for audio context */
  latencyHint?: 'interactive' | 'balanced' | 'playback';
  /** Maximum concurrent voices. Default: 8 */
  maxVoices?: number;
  /** Voice stealing strategy. Default: 'oldest' */
  voiceStealingMode?: 'oldest' | 'quietest' | 'none';
}

/**
 * Audio engine state
 */
export type AudioState = 'uninitialized' | 'running' | 'suspended';

/**
 * State change callback type
 */
export type StateChangeCallback = (state: AudioState) => void;

/**
 * Step callback for sequencer
 */
export type StepCallback = (step: number) => void;

/**
 * Pattern change callback for song player
 */
export type PatternChangeCallback = (index: number, patternId: string) => void;

/**
 * Options for noteOn method
 */
export interface NoteOnOptions {
  /** Velocity (0.0-1.0). Default: 1.0 */
  velocity?: number;
  /** Scheduled start time */
  time?: number;
  /** Duration hint for arpeggiator scheduling */
  duration?: number;
}
