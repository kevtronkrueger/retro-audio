/**
 * Tests for utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  clamp,
  clampVolume,
  clampBpm,
  lerp,
  mapRange,
  normalizeWavetableSample,
  dbToLinear,
  linearToDb,
} from '../src/utils/clamp';

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('handles equal min and max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

describe('clampVolume', () => {
  it('clamps volume to 0-1 range', () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(-0.5)).toBe(0);
    expect(clampVolume(1.5)).toBe(1);
  });
});

describe('clampBpm', () => {
  it('clamps BPM to 30-300 range', () => {
    expect(clampBpm(120)).toBe(120);
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(400)).toBe(300);
  });
});

describe('lerp', () => {
  it('returns start value at t=0', () => {
    expect(lerp(0, 100, 0)).toBe(0);
  });

  it('returns end value at t=1', () => {
    expect(lerp(0, 100, 1)).toBe(100);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it('extrapolates beyond 0-1', () => {
    expect(lerp(0, 100, 2)).toBe(200);
    expect(lerp(0, 100, -1)).toBe(-100);
  });
});

describe('mapRange', () => {
  it('maps value from one range to another', () => {
    expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
  });

  it('maps to inverted range', () => {
    expect(mapRange(0, 0, 10, 100, 0)).toBe(100);
    expect(mapRange(10, 0, 10, 100, 0)).toBe(0);
  });
});

describe('normalizeWavetableSample', () => {
  it('normalizes 0 to -1', () => {
    expect(normalizeWavetableSample(0)).toBeCloseTo(-1, 5);
  });

  it('normalizes 15 to 1', () => {
    expect(normalizeWavetableSample(15)).toBeCloseTo(1, 5);
  });

  it('normalizes 7.5 to 0', () => {
    expect(normalizeWavetableSample(7.5)).toBeCloseTo(0, 5);
  });
});

describe('dbToLinear', () => {
  it('converts 0 dB to 1', () => {
    expect(dbToLinear(0)).toBeCloseTo(1, 5);
  });

  it('converts -6 dB to ~0.5', () => {
    expect(dbToLinear(-6)).toBeCloseTo(0.5012, 3);
  });

  it('converts -20 dB to 0.1', () => {
    expect(dbToLinear(-20)).toBeCloseTo(0.1, 5);
  });
});

describe('linearToDb', () => {
  it('converts 1 to 0 dB', () => {
    expect(linearToDb(1)).toBeCloseTo(0, 5);
  });

  it('converts 0.5 to ~-6 dB', () => {
    expect(linearToDb(0.5)).toBeCloseTo(-6.02, 1);
  });

  it('converts 0.1 to -20 dB', () => {
    expect(linearToDb(0.1)).toBeCloseTo(-20, 1);
  });
});
