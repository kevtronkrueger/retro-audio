/**
 * Pattern type definitions for the Retro Audio Engine
 */

/**
 * Per-note effects that can override instrument settings
 */
export interface NoteEffects {
  /** Slide to this note */
  slideToNote?: string;
  /** Enable vibrato for this note */
  vibrato?: boolean;
  /** Override arpeggio */
  arpeggio?: number[];
}

/**
 * A single note event in a pattern
 */
export interface NoteEvent {
  /** Step position (0 to steps - 1) */
  step: number;
  /** Note name ("C4", "D#5") or null for explicit note-off */
  note: string | null;
  /** Reference to instrument by ID */
  instrumentId: string;
  /**
   * Duration in steps.
   * - If set: note releases after that many steps
   * - If omitted: note plays until next note on same channel or pattern loops
   */
  duration?: number;
  /** Override instrument volume (0.0 - 1.0) */
  volume?: number;
  /** Per-note effects */
  effects?: NoteEffects;
}

/**
 * Channel pattern data structure
 */
export interface ChannelPattern {
  pulse1: NoteEvent[];
  pulse2: NoteEvent[];
  wave: NoteEvent[];
  noise: NoteEvent[];
}

/**
 * Complete pattern definition
 */
export interface PatternData {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Total steps in pattern (16, 32, 64) */
  steps: number;
  /** Steps per beat, usually 4 (16th notes) */
  stepsPerBeat: number;
  /** Note events for each channel */
  channels: ChannelPattern;
  // Note: BPM is controlled at the Song level or via playPattern() options
}

/**
 * Playback options for patterns
 */
export interface PlaybackOptions {
  /** Tempo in BPM. Required for pattern playback, defaults to 120 */
  bpm?: number;
  /** Whether to loop the pattern */
  loop?: boolean;
  /** Starting step position */
  startStep?: number;
}
