/**
 * Instrument type definitions for the Retro Audio Engine
 */

/** Channel types matching Game Boy DMG hardware */
export type ChannelType = 'pulse1' | 'pulse2' | 'wave' | 'noise';

/** Envelope curve types */
export type CurveType = 'linear' | 'exponential';

/**
 * Pulse wave configuration for pulse1/pulse2 channels
 * Game Boy pulse waves have 4 duty cycles: 12.5%, 25%, 50% (square), 75%
 */
export interface PulseWaveformConfig {
  type: 'pulse';
  /** Duty cycle. Default: 0.5 (square wave) */
  duty?: 0.125 | 0.25 | 0.5 | 0.75;
}

/**
 * Wave channel configuration
 * Supports triangle, sawtooth (native), or custom wavetable
 */
export interface WaveWaveformConfig {
  type: 'triangle' | 'sawtooth' | 'custom';
  /** 32 samples, values 0-15 (required if type is 'custom') */
  wavetable?: number[];
}

/**
 * Noise channel configuration using LFSR
 * Long mode: 15-bit LFSR (32767 samples before repeat)
 * Short mode: 7-bit LFSR (127 samples - more tonal/metallic)
 */
export interface NoiseWaveformConfig {
  type: 'noise';
  /** Default: 'long'. Short = metallic/tonal */
  mode?: 'long' | 'short';
}

/**
 * Discriminated union for waveform configurations
 * Validation: pulse1/pulse2 channels require PulseWaveformConfig,
 *             wave channel requires WaveWaveformConfig,
 *             noise channel requires NoiseWaveformConfig
 */
export type WaveformConfig = PulseWaveformConfig | WaveWaveformConfig | NoiseWaveformConfig;

/**
 * ADSR envelope configuration
 */
export interface EnvelopeConfig {
  /** Attack time in seconds (0.0 - 5.0) */
  attack: number;
  /** Decay time in seconds (0.0 - 5.0) */
  decay: number;
  /** Sustain level (0.0 - 1.0) */
  sustain: number;
  /** Release time in seconds (0.0 - 5.0) */
  release: number;
  /** Attack curve type. Default: 'linear' */
  attackCurve?: CurveType;
  /** Decay curve type. Default: 'exponential' */
  decayCurve?: CurveType;
  /** Release curve type. Default: 'exponential' */
  releaseCurve?: CurveType;
}

/**
 * Pitch effect configuration
 */
export interface PitchConfig {
  /** Semitones to slide (negative = down) */
  slide?: number;
  /** Seconds for slide */
  slideTime?: number;
  /** Vibrato depth in semitones (0 - 2) */
  vibratoDepth?: number;
  /** Vibrato speed in Hz (0 - 20) */
  vibratoSpeed?: number;
  /** Semitone offsets for arpeggio, e.g., [0, 4, 7] */
  arpeggio?: number[];
  /** Notes per second for arpeggio */
  arpeggioSpeed?: number;
}

/**
 * Effects configuration
 */
export interface EffectsConfig {
  /**
   * Bit depth reduction (1-16). 0 or undefined = off.
   * v1.0: ScriptProcessorNode implementation
   * v1.1: AudioWorklet implementation
   */
  bitcrush?: number;
  // Future: reverb, delay, etc.
}

/**
 * Complete instrument definition
 */
export interface InstrumentData {
  /** Unique identifier for referencing */
  id: string;
  /** Human-readable name */
  name: string;
  /** Which channel type this uses */
  channel: ChannelType;
  /** Waveform configuration */
  waveform: WaveformConfig;
  /** ADSR envelope */
  envelope: EnvelopeConfig;
  /** Optional pitch effects */
  pitch?: PitchConfig;
  /** Optional effects */
  effects?: EffectsConfig;
  /** Volume level (0.0 - 1.0) */
  volume: number;
}
