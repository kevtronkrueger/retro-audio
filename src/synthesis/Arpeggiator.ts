/**
 * Arpeggiator - Rapid note cycling
 *
 * Pre-schedules arpeggio steps using Web Audio timing for sample-accurate
 * playback. The arpeggiator cycles through semitone offsets at a specified rate.
 */

import { semitonesToRatio } from '../utils/noteToFrequency';

export class Arpeggiator {
  private context: AudioContext;
  private scheduledUntil: number = 0;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Schedule arpeggio using Web Audio timing for sample-accurate playback
   * @param param - The frequency AudioParam
   * @param baseFreq - Base frequency in Hz
   * @param offsets - Semitone offsets, e.g., [0, 4, 7] for major chord
   * @param speed - Notes per second (e.g., 12 for 12 notes/sec)
   * @param startTime - When to start
   * @param duration - How long to arpeggiate (in seconds)
   */
  start(
    param: AudioParam,
    baseFreq: number,
    offsets: number[],
    speed: number,
    startTime: number,
    duration: number
  ): void {
    // Ensure we have at least one offset
    const safeOffsets = offsets.length > 0 ? offsets : [0];
    const stepDuration = 1 / speed;
    const totalSteps = Math.ceil(duration / stepDuration);

    // Pre-schedule all arpeggio steps using Web Audio timing
    // This gives sample-accurate timing without JavaScript timing jitter
    for (let i = 0; i < totalSteps; i++) {
      const semitones = safeOffsets[i % safeOffsets.length];
      const freq = baseFreq * semitonesToRatio(semitones);
      param.setValueAtTime(freq, startTime + (i * stepDuration));
    }

    this.scheduledUntil = startTime + duration;
  }

  /**
   * Start arpeggio with a specific pattern direction
   * @param param - The frequency AudioParam
   * @param baseFreq - Base frequency in Hz
   * @param offsets - Semitone offsets
   * @param speed - Notes per second
   * @param startTime - When to start
   * @param duration - How long to arpeggiate
   * @param direction - 'up', 'down', 'updown', or 'random'
   */
  startWithDirection(
    param: AudioParam,
    baseFreq: number,
    offsets: number[],
    speed: number,
    startTime: number,
    duration: number,
    direction: 'up' | 'down' | 'updown' | 'random'
  ): void {
    const safeOffsets = offsets.length > 0 ? offsets : [0];
    let pattern: number[];

    switch (direction) {
      case 'up':
        pattern = [...safeOffsets].sort((a, b) => a - b);
        break;
      case 'down':
        pattern = [...safeOffsets].sort((a, b) => b - a);
        break;
      case 'updown': {
        const sorted = [...safeOffsets].sort((a, b) => a - b);
        if (sorted.length <= 2) {
          // For 1-2 elements, alternate between them
          // [0] -> [0], [0, 4] -> [0, 4, 4, 0] (or simply cycle)
          pattern = sorted.length === 1 ? sorted : [...sorted, ...sorted.slice().reverse()];
        } else {
          // For 3+ elements, exclude endpoints on the way down to avoid repeats
          // [0, 4, 7] -> [0, 4, 7, 4] (7 and 0 only appear once per cycle)
          const reversed = [...sorted].reverse().slice(1, -1);
          pattern = [...sorted, ...reversed];
        }
        break;
      }
      case 'random':
        // Create a shuffled pattern
        pattern = this.shuffleArray([...safeOffsets]);
        break;
    }

    this.start(param, baseFreq, pattern, speed, startTime, duration);
  }

  private shuffleArray(array: number[]): number[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Cancel any scheduled arpeggio changes from a given time
   * @param param - The frequency AudioParam
   * @param time - Time from which to cancel (default: now)
   */
  stop(param: AudioParam, time?: number): void {
    const stopTime = time ?? this.context.currentTime;
    param.cancelScheduledValues(stopTime);
    this.scheduledUntil = 0;
  }

  /**
   * Get the time until which arpeggio is scheduled
   */
  getScheduledUntil(): number {
    return this.scheduledUntil;
  }

  /**
   * Check if arpeggio is currently scheduled
   */
  isScheduled(): boolean {
    return this.scheduledUntil > this.context.currentTime;
  }
}
