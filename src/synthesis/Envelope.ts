/**
 * Envelope - ADSR envelope generator
 *
 * Applies Attack-Decay-Sustain-Release envelope to a gain AudioParam.
 * Supports linear and exponential curves for each phase.
 */

import type { EnvelopeConfig } from '../types';
import { MIN_EXPONENTIAL_VALUE } from '../utils/constants';

export class Envelope {
  private config: EnvelopeConfig;

  constructor(_context: AudioContext, config: EnvelopeConfig) {
    this.config = {
      ...config,
      attackCurve: config.attackCurve ?? 'linear',
      decayCurve: config.decayCurve ?? 'exponential',
      releaseCurve: config.releaseCurve ?? 'exponential',
    };
  }

  /**
   * Apply envelope attack and decay phases to a gain AudioParam
   * @param param - The gain parameter to modulate
   * @param startTime - When to start the envelope
   * @param velocity - Velocity multiplier (0-1)
   * @returns The time when sustain phase begins
   */
  triggerAttack(param: AudioParam, startTime: number, velocity: number = 1): number {
    const { attack, decay, sustain, attackCurve, decayCurve } = this.config;
    const peakLevel = velocity;
    const sustainLevel = sustain * velocity;

    // Cancel any previous automation
    param.cancelScheduledValues(startTime);

    // Start at zero
    param.setValueAtTime(0, startTime);

    // Attack phase
    const attackEnd = startTime + attack;
    if (attackCurve === 'exponential' && attack > 0.001) {
      // Exponential attack (starts slow, ends fast)
      // Need to start from a small value for exponentialRamp
      param.setValueAtTime(MIN_EXPONENTIAL_VALUE, startTime);
      param.exponentialRampToValueAtTime(
        Math.max(peakLevel, MIN_EXPONENTIAL_VALUE),
        attackEnd
      );
    } else {
      // Linear attack
      param.linearRampToValueAtTime(peakLevel, attackEnd);
    }

    // Decay phase
    const decayEnd = attackEnd + decay;
    if (decayCurve === 'exponential' && decay > 0.001 && sustainLevel > MIN_EXPONENTIAL_VALUE) {
      param.exponentialRampToValueAtTime(
        Math.max(sustainLevel, MIN_EXPONENTIAL_VALUE),
        decayEnd
      );
    } else {
      param.linearRampToValueAtTime(sustainLevel, decayEnd);
    }

    return decayEnd;
  }

  /**
   * Trigger release phase
   * @param param - The gain parameter
   * @param startTime - When to start release
   * @returns The time when envelope reaches zero
   */
  triggerRelease(param: AudioParam, startTime: number): number {
    const { release, releaseCurve } = this.config;

    // Cancel any scheduled changes from this point
    param.cancelScheduledValues(startTime);

    // Get current value and set it explicitly
    // Note: param.value may not reflect the scheduled value at startTime
    // but this is the best we can do without complex value tracking
    let currentValue = param.value;

    // Handle zero or very small values - use linear ramp instead of exponential
    // because exponential ramp fails with values at or near zero
    if (currentValue <= MIN_EXPONENTIAL_VALUE) {
      currentValue = MIN_EXPONENTIAL_VALUE;
    }

    param.setValueAtTime(currentValue, startTime);

    // Release to zero
    const releaseEnd = startTime + release;
    if (releaseCurve === 'exponential' && release > 0.001 && currentValue > MIN_EXPONENTIAL_VALUE) {
      param.exponentialRampToValueAtTime(MIN_EXPONENTIAL_VALUE, releaseEnd);
      param.setValueAtTime(0, releaseEnd);
    } else {
      // Use linear ramp for zero/small values or when linear curve is configured
      param.linearRampToValueAtTime(0, releaseEnd);
    }

    return releaseEnd;
  }

  /**
   * Get the total duration of attack + decay phases
   */
  getAttackDecayDuration(): number {
    return this.config.attack + this.config.decay;
  }

  /**
   * Get the release duration
   */
  getReleaseDuration(): number {
    return this.config.release;
  }

  /**
   * Update envelope configuration
   */
  update(config: Partial<EnvelopeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): EnvelopeConfig {
    return { ...this.config };
  }
}
