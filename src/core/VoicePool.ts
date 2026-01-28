/**
 * VoicePool - Voice allocation and stealing
 *
 * Manages a pool of Voice instances, handling allocation and voice stealing
 * when the pool is exhausted.
 */

import { Voice } from './Voice';
import type { VoiceConfig } from '../types';
import { DEFAULT_MAX_VOICES, DEFAULT_STEALING_MODE } from '../utils/constants';

export class VoicePool {
  private context: AudioContext;
  private destination: AudioNode;
  private voices: Voice[] = [];
  private maxVoices: number;
  private stealingMode: VoiceConfig['stealingMode'];

  constructor(
    context: AudioContext,
    destination: AudioNode,
    config: Partial<VoiceConfig> = {}
  ) {
    this.context = context;
    this.destination = destination;
    this.maxVoices = config.maxVoices ?? DEFAULT_MAX_VOICES;
    this.stealingMode = config.stealingMode ?? DEFAULT_STEALING_MODE;
  }

  /**
   * Acquire a voice from the pool
   * @returns A Voice instance, or null if stealing is disabled and pool is full
   */
  acquire(): Voice | null {
    // First, try to find an inactive voice
    const inactive = this.voices.find(v => !v.isActive);
    if (inactive) {
      return inactive;
    }

    // If under limit, create a new voice
    if (this.voices.length < this.maxVoices) {
      const voice = new Voice(this.context, this.destination);
      this.voices.push(voice);
      return voice;
    }

    // Pool is full, attempt voice stealing
    return this.stealVoice();
  }

  /**
   * Attempt to steal a voice based on the configured stealing mode
   */
  private stealVoice(): Voice | null {
    if (this.stealingMode === 'none') {
      return null;
    }

    const activeVoices = this.voices.filter(v => v.isActive);
    if (activeVoices.length === 0) {
      // This shouldn't happen, but just in case
      return this.voices[0] ?? null;
    }

    let victim: Voice;

    if (this.stealingMode === 'oldest') {
      // Steal the voice that started earliest
      victim = activeVoices.reduce((a, b) =>
        a.startTime < b.startTime ? a : b
      );
    } else {
      // 'quietest' - steal the voice with lowest amplitude
      victim = activeVoices.reduce((a, b) =>
        a.currentAmplitude < b.currentAmplitude ? a : b
      );
    }

    // Stop the victim voice
    victim.stop();

    return victim;
  }

  /**
   * Release a specific voice back to the pool
   * Note: Voices are automatically marked as inactive when their envelope completes
   */
  release(voice: Voice): void {
    voice.stop();
  }

  /**
   * Release all active voices
   */
  releaseAll(): void {
    for (const voice of this.voices) {
      voice.stop();
    }
  }

  /**
   * Get the number of currently active voices
   */
  getActiveCount(): number {
    return this.voices.filter(v => v.isActive).length;
  }

  /**
   * Get the total number of voices in the pool
   */
  getTotalCount(): number {
    return this.voices.length;
  }

  /**
   * Get the maximum number of voices allowed
   */
  getMaxVoices(): number {
    return this.maxVoices;
  }

  /**
   * Check if the pool is at capacity
   */
  isAtCapacity(): boolean {
    return this.voices.length >= this.maxVoices;
  }

  /**
   * Check if all voices are active
   */
  isFullyActive(): boolean {
    return this.voices.length >= this.maxVoices &&
           this.voices.every(v => v.isActive);
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<VoiceConfig>): void {
    if (config.maxVoices !== undefined) {
      this.maxVoices = config.maxVoices;
    }
    if (config.stealingMode !== undefined) {
      this.stealingMode = config.stealingMode;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): VoiceConfig {
    return {
      maxVoices: this.maxVoices,
      stealingMode: this.stealingMode,
    };
  }

  /**
   * Clean up all voices and resources
   */
  dispose(): void {
    for (const voice of this.voices) {
      voice.dispose();
    }
    this.voices = [];
  }
}
