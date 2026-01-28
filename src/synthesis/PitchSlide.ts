/**
 * PitchSlide - Pitch bend/slide effects
 *
 * Applies smooth pitch transitions using exponential ramps for
 * musically correct pitch changes.
 */

import { noteToFrequency, semitonesToRatio } from '../utils/noteToFrequency';

export class PitchSlide {
  constructor(_context: AudioContext) {
    // Context stored for potential future use
  }

  /**
   * Apply pitch slide to a frequency AudioParam
   * @param param - The frequency AudioParam
   * @param startFreq - Starting frequency in Hz
   * @param semitones - Semitones to slide (positive = up, negative = down)
   * @param duration - Slide duration in seconds
   * @param startTime - When to start the slide
   */
  apply(
    param: AudioParam,
    startFreq: number,
    semitones: number,
    duration: number,
    startTime: number
  ): void {
    const endFreq = startFreq * semitonesToRatio(semitones);

    param.setValueAtTime(startFreq, startTime);
    param.exponentialRampToValueAtTime(endFreq, startTime + duration);
  }

  /**
   * Slide to a specific note
   * @param param - The frequency AudioParam
   * @param startFreq - Starting frequency in Hz
   * @param targetNote - Target note name (e.g., "C4", "D#5")
   * @param duration - Slide duration in seconds
   * @param startTime - When to start the slide
   */
  slideToNote(
    param: AudioParam,
    startFreq: number,
    targetNote: string,
    duration: number,
    startTime: number
  ): void {
    const targetFreq = noteToFrequency(targetNote);

    param.setValueAtTime(startFreq, startTime);
    param.exponentialRampToValueAtTime(targetFreq, startTime + duration);
  }

  /**
   * Slide from one note to another
   * @param param - The frequency AudioParam
   * @param fromNote - Starting note name
   * @param toNote - Target note name
   * @param duration - Slide duration in seconds
   * @param startTime - When to start the slide
   */
  slideNoteToNote(
    param: AudioParam,
    fromNote: string,
    toNote: string,
    duration: number,
    startTime: number
  ): void {
    const startFreq = noteToFrequency(fromNote);
    const endFreq = noteToFrequency(toNote);

    param.setValueAtTime(startFreq, startTime);
    param.exponentialRampToValueAtTime(endFreq, startTime + duration);
  }

  /**
   * Apply pitch bend (temporary pitch deviation that returns to original)
   * @param param - The frequency AudioParam
   * @param baseFreq - Base frequency
   * @param bendSemitones - Max bend amount in semitones
   * @param duration - Total bend duration (up + down)
   * @param startTime - When to start
   */
  applyBend(
    param: AudioParam,
    baseFreq: number,
    bendSemitones: number,
    duration: number,
    startTime: number
  ): void {
    const peakFreq = baseFreq * semitonesToRatio(bendSemitones);
    const halfDuration = duration / 2;

    param.setValueAtTime(baseFreq, startTime);
    param.exponentialRampToValueAtTime(peakFreq, startTime + halfDuration);
    param.exponentialRampToValueAtTime(baseFreq, startTime + duration);
  }
}
