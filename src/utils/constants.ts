/**
 * Shared constants for the Retro Audio Engine
 */

/** Default sample rate for audio context */
export const DEFAULT_SAMPLE_RATE = 44100;

/** Default maximum number of concurrent voices */
export const DEFAULT_MAX_VOICES = 8;

/** Default voice stealing mode */
export const DEFAULT_STEALING_MODE = 'oldest' as const;

/** Default BPM for pattern playback */
export const DEFAULT_BPM = 120;

/** Minimum BPM allowed */
export const MIN_BPM = 30;

/** Maximum BPM allowed */
export const MAX_BPM = 300;

/** Default steps per beat (16th notes) */
export const DEFAULT_STEPS_PER_BEAT = 4;

/**
 * Schedule ahead time in seconds for precise timing.
 * Set to >1 second to handle browser background tab throttling,
 * where setTimeout is throttled to 1 second intervals.
 */
export const SCHEDULE_AHEAD_TIME = 1.1;

/**
 * Timer interval in ms for scheduler checks.
 * This is the desired interval; browsers may throttle in background tabs.
 */
export const SCHEDULER_INTERVAL = 100;

/** Number of harmonics for pulse wave generation */
export const PULSE_HARMONICS = 64;

/** LFSR length for long mode noise (15-bit) */
export const LFSR_LONG_LENGTH = 32767;

/** LFSR length for short mode noise (7-bit) */
export const LFSR_SHORT_LENGTH = 127;

/** Wavetable size for custom waveforms */
export const WAVETABLE_SIZE = 32;

/** Maximum wavetable sample value (4-bit) */
export const WAVETABLE_MAX_VALUE = 15;

/** Minimum value to avoid exponential ramp issues */
export const MIN_EXPONENTIAL_VALUE = 0.001;

/** Available duty cycles for pulse waves */
export const PULSE_DUTY_CYCLES = [0.125, 0.25, 0.5, 0.75] as const;

/** Channel names for iteration */
export const CHANNEL_NAMES = ['pulse1', 'pulse2', 'wave', 'noise'] as const;
