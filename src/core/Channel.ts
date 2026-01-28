/**
 * Channel - Base interface for all channel types
 *
 * All channel types implement this interface, exposing oscillator/frequency
 * for pitch effects.
 */

export interface Channel {
  /**
   * Start playing a note at the given frequency
   * @param frequency - Frequency in Hz
   * @param time - AudioContext time to start
   */
  noteOn(frequency: number, time: number): void;

  /**
   * Stop playing the current note
   * @param time - AudioContext time to stop
   */
  noteOff(time: number): void;

  /** Gain AudioParam for envelope control */
  readonly gain: AudioParam;

  /**
   * Oscillator node for vibrato (uses detune param).
   * Only available on oscillator-based channels (pulse, wave).
   * Null for noise channel.
   */
  readonly oscillator: OscillatorNode | null;

  /**
   * Frequency AudioParam for pitch slide and arpeggio.
   * For noise, this controls playback rate.
   */
  readonly frequencyParam: AudioParam | null;
}
