/**
 * Utility functions for value manipulation
 */

/**
 * Clamp a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamp a volume value between 0 and 1
 * @param volume - Volume value
 * @returns Clamped volume
 */
export function clampVolume(volume: number): number {
  return clamp(volume, 0, 1);
}

/**
 * Clamp BPM to valid range
 * @param bpm - BPM value
 * @returns Clamped BPM
 */
export function clampBpm(bpm: number): number {
  return clamp(bpm, 30, 300);
}

/**
 * Linear interpolation between two values
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another
 * @param value - Value to map
 * @param inMin - Input range minimum
 * @param inMax - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 * @returns Mapped value
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  // Guard against division by zero when input range is zero
  if (inMin === inMax) {
    return outMin;
  }
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/**
 * Normalize a wavetable sample value (0-15) to audio range (-1 to 1)
 * @param sample - Sample value (0-15)
 * @returns Normalized value (-1 to 1)
 */
export function normalizeWavetableSample(sample: number): number {
  return (sample / 7.5) - 1;
}

/**
 * Convert decibels to linear amplitude
 * @param db - Decibel value
 * @returns Linear amplitude (0-1 range for negative dB)
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear amplitude to decibels
 * @param linear - Linear amplitude
 * @returns Decibel value
 */
export function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(linear, 0.00001));
}
