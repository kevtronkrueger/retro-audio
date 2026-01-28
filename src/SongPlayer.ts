/**
 * SongPlayer - Controls for song playback
 *
 * Extends PatternPlayer to handle song sequences (multiple patterns)
 * and provides additional controls for navigating between patterns.
 */

import type {
  SongData,
  PatternData,
  PatternChangeCallback,
} from './types';
import type { RetroAudio } from './RetroAudio';
import { PatternPlayer } from './PatternPlayer';
import { PatternNotFoundError } from './errors';

export class SongPlayer extends PatternPlayer {
  private song: SongData;
  private patterns: Map<string, PatternData>;
  private _currentPatternIndex: number = 0;

  /** Event callback when pattern changes */
  onPatternChange: PatternChangeCallback | null = null;

  constructor(
    context: AudioContext,
    engine: RetroAudio,
    song: SongData
  ) {
    // Build pattern map
    const patterns = new Map<string, PatternData>();
    for (const pattern of song.patterns) {
      patterns.set(pattern.id, pattern);
    }

    // Get the first pattern in the sequence
    const firstPatternId = song.sequence[0];
    const firstPattern = patterns.get(firstPatternId);
    if (!firstPattern) {
      throw new PatternNotFoundError(firstPatternId);
    }

    // Initialize with first pattern
    super(context, engine, firstPattern, {
      bpm: song.bpm,
      loop: false, // We handle looping at the song level
    });

    this.song = song;
    this.patterns = patterns;

    // Override the sequencer's onEnd to handle pattern transitions
    this.sequencer.onEnd = () => this.handlePatternEnd();
    this.sequencer.onLoop = () => {}; // Disable pattern-level looping
  }

  /**
   * Current pattern index in the sequence
   */
  get currentPatternIndex(): number {
    return this._currentPatternIndex;
  }

  /**
   * Current pattern ID
   */
  get currentPatternId(): string {
    return this.song.sequence[this._currentPatternIndex];
  }

  /**
   * Total number of patterns in the sequence
   */
  get totalPatterns(): number {
    return this.song.sequence.length;
  }

  /**
   * Jump to a specific pattern in the sequence
   */
  seekToPattern(index: number): void {
    if (index < 0 || index >= this.song.sequence.length) {
      throw new Error(`Pattern index out of range: ${index}`);
    }

    const wasPlaying = this.isPlaying;
    this.sequencer.stop();

    this._currentPatternIndex = index;
    this.loadCurrentPattern();

    if (wasPlaying) {
      this.sequencer.play();
    }

    this.onPatternChange?.(index, this.currentPatternId);
  }

  /**
   * Move to the next pattern
   */
  nextPattern(): void {
    const nextIndex = this._currentPatternIndex + 1;
    if (nextIndex < this.song.sequence.length) {
      this.seekToPattern(nextIndex);
    } else if (this.song.loop) {
      const loopPoint = this.song.loopPoint ?? 0;
      this.seekToPattern(loopPoint);
    }
  }

  /**
   * Move to the previous pattern
   */
  previousPattern(): void {
    if (this._currentPatternIndex > 0) {
      this.seekToPattern(this._currentPatternIndex - 1);
    }
  }

  /**
   * Get the song data
   */
  getSong(): SongData {
    return this.song;
  }

  /**
   * Get a pattern by ID
   */
  getPattern(id: string): PatternData | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all pattern IDs in the sequence
   */
  getSequence(): string[] {
    return [...this.song.sequence];
  }

  private loadCurrentPattern(): void {
    const patternId = this.song.sequence[this._currentPatternIndex];
    const pattern = this.patterns.get(patternId);

    if (!pattern) {
      throw new PatternNotFoundError(patternId);
    }

    this._pattern = pattern;
    this.sequencer.setPattern(pattern);
  }

  private handlePatternEnd(): void {
    // Fire step end callback
    this.onEnd?.();

    const nextIndex = this._currentPatternIndex + 1;

    if (nextIndex < this.song.sequence.length) {
      // Move to next pattern
      this._currentPatternIndex = nextIndex;
      this.loadCurrentPattern();
      this.sequencer.play();
      this.onPatternChange?.(nextIndex, this.currentPatternId);
    } else if (this.song.loop) {
      // Loop back
      const loopPoint = this.song.loopPoint ?? 0;
      this._currentPatternIndex = loopPoint;
      this.loadCurrentPattern();
      this.sequencer.play();
      this.onPatternChange?.(loopPoint, this.currentPatternId);
    } else {
      // Song ended
      this._currentPatternIndex = 0;
    }
  }

  /**
   * Override stop to reset pattern index
   */
  stop(): void {
    super.stop();
    this._currentPatternIndex = 0;
    this.loadCurrentPattern();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    super.dispose();
    this.onPatternChange = null;
  }
}
