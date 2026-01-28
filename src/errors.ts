/**
 * Custom error types for the Retro Audio Engine
 */

export class RetroAudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetroAudioError';
  }
}

export class AudioContextNotInitializedError extends RetroAudioError {
  constructor(message?: string) {
    super(message ?? 'AudioContext not initialized. Call init() first.');
    this.name = 'AudioContextNotInitializedError';
  }
}

export class InstrumentNotFoundError extends RetroAudioError {
  constructor(id: string) {
    super(`Instrument not found: ${id}`);
    this.name = 'InstrumentNotFoundError';
  }
}

export class InvalidNoteError extends RetroAudioError {
  constructor(note: string) {
    super(`Invalid note format: ${note}. Expected format like "C4", "D#5", "Gb3".`);
    this.name = 'InvalidNoteError';
  }
}

export class AudioSuspendedError extends RetroAudioError {
  constructor() {
    super('Audio is suspended. Call resume() after user gesture.');
    this.name = 'AudioSuspendedError';
  }
}

export class VoiceLimitReachedError extends RetroAudioError {
  constructor() {
    super('Maximum voice limit reached and voice stealing is disabled.');
    this.name = 'VoiceLimitReachedError';
  }
}

export class ValidationError extends RetroAudioError {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(`Validation failed: ${errors.join(', ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class PatternNotFoundError extends RetroAudioError {
  constructor(id: string) {
    super(`Pattern not found: ${id}`);
    this.name = 'PatternNotFoundError';
  }
}
