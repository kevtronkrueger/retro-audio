/**
 * Song and SFX type definitions for the Retro Audio Engine
 */

import type { InstrumentData } from './Instrument';
import type { PatternData } from './Pattern';

/**
 * Complete song definition
 * Contains all instruments, patterns, and sequence data
 */
export interface SongData {
  /** Schema version */
  version: '1.0';
  /** File type identifier */
  type: 'song';
  /** Song name */
  name: string;
  /** Optional author */
  author?: string;
  /** Master BPM */
  bpm: number;
  /** All instruments used in this song */
  instruments: InstrumentData[];
  /** All patterns */
  patterns: PatternData[];
  /** Pattern IDs in play order */
  sequence: string[];
  /** Loop the sequence */
  loop?: boolean;
  /** Index in sequence to loop back to */
  loopPoint?: number;
}

/**
 * Sound effect definition
 * A simpler format for one-shot sound effects
 */
export interface SfxData {
  /** Schema version */
  version: '1.0';
  /** File type identifier */
  type: 'sfx';
  /** Effect name */
  name: string;
  /** Single instrument (embedded, not referenced) */
  instrument: InstrumentData;
  /** Default note to play, e.g., "C4" */
  note?: string;
  /**
   * Auto note-off after this many seconds.
   *
   * Behavior:
   * - If set: Note-off triggers after this duration, starting release phase.
   * - If omitted: Note plays through the full ADSR envelope naturally.
   *   - For sustain > 0: Sound holds at sustain level indefinitely until stopped.
   *   - For sustain = 0: Sound decays to silence automatically.
   *
   * Recommendation: Always set duration for SFX with sustain > 0,
   * or design SFX envelopes with sustain = 0 for self-terminating sounds.
   */
  duration?: number;
}

/**
 * Project container format
 *
 * IMPORTANT: ProjectData is NOT directly playable by RetroAudio.
 * It serves as a save/load format for the composition tool that
 * bundles multiple songs, instruments, and patterns together.
 *
 * To play content from a ProjectData:
 *   const project: ProjectData = await loadProject('myproject.json');
 *   audio.loadInstruments(project.instruments);
 *   const player = audio.playSong(project.songs[0]);
 */
export interface ProjectData {
  /** Schema version */
  version: '1.0';
  /** File type identifier */
  type: 'project';
  /** Project name */
  name: string;
  /** Optional author */
  author?: string;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp */
  modifiedAt: string;
  /** Shared instrument library */
  instruments: InstrumentData[];
  /** All patterns (may be shared across songs) */
  patterns: PatternData[];
  /** Multiple songs referencing above */
  songs: SongData[];
}
