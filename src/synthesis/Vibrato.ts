/**
 * Vibrato - LFO-based pitch modulation
 *
 * Uses the oscillator's detune parameter for correct pitch modulation
 * at any frequency. Detune is specified in cents (100 cents = 1 semitone).
 */

export class Vibrato {
  private context: AudioContext;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Start vibrato on an oscillator's detune param
   * @param oscillator - The oscillator to modulate
   * @param depthSemitones - Vibrato depth in semitones (0-2)
   * @param speed - Vibrato speed in Hz (0-20)
   * @param startTime - When to start vibrato
   */
  start(
    oscillator: OscillatorNode,
    depthSemitones: number,
    speed: number,
    startTime: number
  ): void {
    // Stop any existing vibrato
    this.stop();

    // Convert semitones to cents (100 cents = 1 semitone)
    const depthCents = depthSemitones * 100;

    // Create LFO (sine wave)
    this.lfo = this.context.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = speed;

    // Gain to scale LFO output to cents
    this.lfoGain = this.context.createGain();
    this.lfoGain.gain.value = depthCents;

    // Connect LFO -> Gain -> Oscillator's detune param
    // Detune is in cents, which gives correct pitch modulation
    // regardless of the base frequency
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(oscillator.detune);

    this.lfo.start(startTime);
  }

  /**
   * Start vibrato with a delay (e.g., after a pitch slide)
   * @param oscillator - The oscillator to modulate
   * @param depthSemitones - Vibrato depth in semitones
   * @param speed - Vibrato speed in Hz
   * @param startTime - When to start
   * @param delay - Delay before vibrato starts (seconds)
   */
  startWithDelay(
    oscillator: OscillatorNode,
    depthSemitones: number,
    speed: number,
    startTime: number,
    delay: number
  ): void {
    this.start(oscillator, depthSemitones, speed, startTime + delay);
  }

  /**
   * Start vibrato with fade-in
   * @param oscillator - The oscillator to modulate
   * @param depthSemitones - Target vibrato depth
   * @param speed - Vibrato speed in Hz
   * @param startTime - When to start
   * @param fadeTime - Time to reach full depth
   */
  startWithFadeIn(
    oscillator: OscillatorNode,
    depthSemitones: number,
    speed: number,
    startTime: number,
    fadeTime: number
  ): void {
    // Stop any existing vibrato
    this.stop();

    const depthCents = depthSemitones * 100;

    // Create LFO
    this.lfo = this.context.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = speed;

    // Gain with fade-in
    this.lfoGain = this.context.createGain();
    this.lfoGain.gain.setValueAtTime(0, startTime);
    this.lfoGain.gain.linearRampToValueAtTime(depthCents, startTime + fadeTime);

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(oscillator.detune);

    this.lfo.start(startTime);
  }

  /**
   * Update vibrato parameters in real-time
   * @param depthSemitones - New depth in semitones
   * @param speed - New speed in Hz
   */
  update(depthSemitones?: number, speed?: number): void {
    if (depthSemitones !== undefined && this.lfoGain) {
      this.lfoGain.gain.setValueAtTime(
        depthSemitones * 100,
        this.context.currentTime
      );
    }
    if (speed !== undefined && this.lfo) {
      this.lfo.frequency.setValueAtTime(speed, this.context.currentTime);
    }
  }

  /**
   * Stop vibrato
   * @param time - Optional scheduled stop time
   */
  stop(time?: number): void {
    const stopTime = time ?? this.context.currentTime;

    if (this.lfo) {
      try {
        this.lfo.stop(stopTime);
        this.lfo.disconnect();
      } catch {
        // LFO may already be stopped
      }
      this.lfo = null;
    }

    if (this.lfoGain) {
      this.lfoGain.disconnect();
      this.lfoGain = null;
    }
  }

  /**
   * Check if vibrato is currently active
   */
  isActive(): boolean {
    return this.lfo !== null;
  }
}
