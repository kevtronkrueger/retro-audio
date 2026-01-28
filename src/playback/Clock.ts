/**
 * Clock - BPM-based timing
 *
 * Provides timing calculations for pattern and song playback.
 */

import { clampBpm } from '../utils/clamp';
import { DEFAULT_BPM, DEFAULT_STEPS_PER_BEAT } from '../utils/constants';

export class Clock {
  private _bpm: number;
  private _stepsPerBeat: number;

  constructor(bpm: number = DEFAULT_BPM, stepsPerBeat: number = DEFAULT_STEPS_PER_BEAT) {
    this._bpm = clampBpm(bpm);
    // Ensure stepsPerBeat is at least 1 to prevent division by zero
    this._stepsPerBeat = Math.max(1, Math.floor(stepsPerBeat));
  }

  /**
   * Get the current BPM
   */
  get bpm(): number {
    return this._bpm;
  }

  /**
   * Set the BPM (clamped to valid range)
   */
  set bpm(value: number) {
    this._bpm = clampBpm(value);
  }

  /**
   * Get steps per beat
   */
  get stepsPerBeat(): number {
    return this._stepsPerBeat;
  }

  /**
   * Set steps per beat
   */
  set stepsPerBeat(value: number) {
    this._stepsPerBeat = Math.max(1, Math.floor(value));
  }

  /**
   * Get seconds per beat
   */
  get secondsPerBeat(): number {
    return 60 / this._bpm;
  }

  /**
   * Get seconds per step
   */
  get secondsPerStep(): number {
    return this.secondsPerBeat / this._stepsPerBeat;
  }

  /**
   * Get steps per second
   */
  get stepsPerSecond(): number {
    return this._stepsPerBeat * (this._bpm / 60);
  }

  /**
   * Get beats per second
   */
  get beatsPerSecond(): number {
    return this._bpm / 60;
  }

  /**
   * Convert steps to seconds
   */
  stepsToSeconds(steps: number): number {
    return steps * this.secondsPerStep;
  }

  /**
   * Convert seconds to steps
   */
  secondsToSteps(seconds: number): number {
    return seconds / this.secondsPerStep;
  }

  /**
   * Convert beats to steps
   */
  beatsToSteps(beats: number): number {
    return beats * this._stepsPerBeat;
  }

  /**
   * Convert steps to beats
   */
  stepsToBeats(steps: number): number {
    return steps / this._stepsPerBeat;
  }

  /**
   * Get the duration of a pattern in seconds
   */
  getPatternDuration(totalSteps: number): number {
    return this.stepsToSeconds(totalSteps);
  }

  /**
   * Calculate the time for a specific step
   */
  getStepTime(step: number, startTime: number): number {
    return startTime + this.stepsToSeconds(step);
  }

  /**
   * Get the step at a given time relative to start
   */
  getStepAtTime(time: number, startTime: number): number {
    return Math.floor(this.secondsToSteps(time - startTime));
  }

  /**
   * Tap tempo - calculate BPM from tap intervals
   * @param intervals - Array of time intervals between taps (in seconds)
   * @returns Calculated BPM
   */
  static calculateTapTempo(intervals: number[]): number {
    if (intervals.length === 0) return DEFAULT_BPM;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const calculatedBpm = 60 / avgInterval;

    return clampBpm(calculatedBpm);
  }
}
