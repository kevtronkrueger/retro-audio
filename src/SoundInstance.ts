/**
 * SoundInstance - Handle for a playing one-shot sound
 *
 * Provides control over a playing sound effect, including stopping
 * and fade out capabilities.
 */

import { Voice } from './core/Voice';

export class SoundInstance {
  private context: AudioContext;
  private voice: Voice;
  private _isPlaying: boolean = true;
  private _finished: Promise<void>;
  private resolveFinished!: () => void;
  private durationTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    context: AudioContext,
    voice: Voice,
    duration?: number
  ) {
    this.context = context;
    this.voice = voice;

    // Create the finished promise
    this._finished = new Promise<void>((resolve) => {
      this.resolveFinished = resolve;
    });

    // If duration is specified, schedule note-off
    if (duration !== undefined && duration > 0) {
      this.durationTimeout = setTimeout(() => {
        this.triggerNoteOff();
      }, duration * 1000);
    }
  }

  /**
   * Stop this sound immediately
   */
  stop(): void {
    if (!this._isPlaying) return;

    this.clearDurationTimeout();
    this.voice.stop();
    this._isPlaying = false;
    this.resolveFinished();
  }

  /**
   * Fade out over duration
   * @param duration - Fade duration in seconds
   */
  fadeOut(duration: number): void {
    if (!this._isPlaying) return;

    this.clearDurationTimeout();

    const gainNode = this.voice.getGainNode();
    const currentTime = this.context.currentTime;
    const currentValue = gainNode.gain.value;

    // Cancel any scheduled changes
    gainNode.gain.cancelScheduledValues(currentTime);
    gainNode.gain.setValueAtTime(currentValue, currentTime);
    gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

    // Schedule cleanup after fade
    setTimeout(() => {
      this.voice.stop();
      this._isPlaying = false;
      this.resolveFinished();
    }, duration * 1000);
  }

  /**
   * Trigger note-off (starts release phase)
   */
  private triggerNoteOff(): void {
    if (!this._isPlaying) return;

    this.voice.noteOff();

    // The voice will handle cleanup after release phase
    // We mark as not playing but wait for release to complete
    // The voice's release will complete on its own schedule
    this._isPlaying = false;

    // Get the actual envelope release time, capped at max of 5 seconds
    const releaseTime = this.voice.instrument?.envelope.release ?? 0;
    const bufferMs = (releaseTime * 1000) + 100; // Add small buffer
    setTimeout(() => {
      this.resolveFinished();
    }, Math.min(bufferMs, 5100)); // Cap at max release (5s) + buffer
  }

  private clearDurationTimeout(): void {
    if (this.durationTimeout) {
      clearTimeout(this.durationTimeout);
      this.durationTimeout = null;
    }
  }

  /**
   * Is this sound still playing?
   */
  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Promise that resolves when sound finishes
   */
  get finished(): Promise<void> {
    return this._finished;
  }

  /**
   * Get the underlying voice (for advanced control)
   */
  getVoice(): Voice {
    return this.voice;
  }
}
