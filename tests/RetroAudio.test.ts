/**
 * Integration tests for RetroAudio
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockAudioContext,
  installWebAudioMocks,
  uninstallWebAudioMocks,
} from './mocks/WebAudioMock';
import { RetroAudio } from '../src/RetroAudio';
import type { InstrumentData, SfxData } from '../src/types';

describe('RetroAudio', () => {
  beforeEach(() => {
    installWebAudioMocks();
  });

  afterEach(() => {
    uninstallWebAudioMocks();
  });

  describe('initialization', () => {
    it('starts in uninitialized state', () => {
      const audio = new RetroAudio();
      expect(audio.state).toBe('uninitialized');
    });

    it('transitions to running after init()', async () => {
      const audio = new RetroAudio();
      await audio.init();
      expect(audio.state).toBe('running');
      audio.dispose();
    });

    it('accepts configuration options', async () => {
      const audio = new RetroAudio({
        sampleRate: 48000,
        maxVoices: 4,
        voiceStealingMode: 'quietest',
      });
      await audio.init();
      expect(audio.state).toBe('running');
      audio.dispose();
    });
  });

  describe('suspend and resume', () => {
    it('can suspend audio', async () => {
      const audio = new RetroAudio();
      await audio.init();
      await audio.suspend();
      expect(audio.state).toBe('suspended');
      audio.dispose();
    });

    it('can resume audio', async () => {
      const audio = new RetroAudio();
      await audio.init();
      await audio.suspend();
      await audio.resume();
      expect(audio.state).toBe('running');
      audio.dispose();
    });
  });

  describe('master volume', () => {
    it('has default volume of 1', async () => {
      const audio = new RetroAudio();
      await audio.init();
      expect(audio.masterVolume).toBe(1);
      audio.dispose();
    });

    it('can set master volume', async () => {
      const audio = new RetroAudio();
      await audio.init();
      audio.masterVolume = 0.5;
      expect(audio.masterVolume).toBe(0.5);
      audio.dispose();
    });
  });

  describe('instrument bank', () => {
    const testInstrument: InstrumentData = {
      id: 'test-inst',
      name: 'Test Instrument',
      channel: 'pulse1',
      waveform: { type: 'pulse', duty: 0.5 },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 },
      volume: 0.8,
    };

    it('can load instruments', () => {
      const audio = new RetroAudio();
      audio.loadInstruments([testInstrument]);
      expect(audio.getInstrument('test-inst')).toEqual(testInstrument);
    });

    it('returns undefined for unknown instrument', () => {
      const audio = new RetroAudio();
      expect(audio.getInstrument('unknown')).toBeUndefined();
    });

    it('can clear instruments', () => {
      const audio = new RetroAudio();
      audio.loadInstruments([testInstrument]);
      audio.clearInstruments();
      expect(audio.getInstrument('test-inst')).toBeUndefined();
    });

    it('can load multiple instruments', () => {
      const audio = new RetroAudio();
      const inst2: InstrumentData = {
        ...testInstrument,
        id: 'test-inst-2',
        name: 'Test Instrument 2',
      };
      audio.loadInstruments([testInstrument, inst2]);
      expect(audio.getInstrument('test-inst')).toEqual(testInstrument);
      expect(audio.getInstrument('test-inst-2')).toEqual(inst2);
    });
  });

  describe('createSynth', () => {
    const testInstrument: InstrumentData = {
      id: 'synth-test',
      name: 'Synth Test',
      channel: 'pulse1',
      waveform: { type: 'pulse', duty: 0.5 },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 },
      volume: 0.8,
    };

    it('creates a synth after init', async () => {
      const audio = new RetroAudio();
      await audio.init();
      const synth = audio.createSynth(testInstrument);
      expect(synth).toBeDefined();
      expect(synth.isPlaying).toBe(false);
      synth.dispose();
      audio.dispose();
    });

    it('throws when not initialized', () => {
      const audio = new RetroAudio();
      expect(() => audio.createSynth(testInstrument)).toThrow('not initialized');
    });
  });

  describe('state change callback', () => {
    it('fires on state changes', async () => {
      const audio = new RetroAudio();
      const states: string[] = [];
      audio.onStateChange = (state) => states.push(state);

      await audio.init();
      await audio.suspend();
      await audio.resume();

      expect(states).toContain('running');
      expect(states).toContain('suspended');
      audio.dispose();
    });
  });

  describe('dispose', () => {
    it('cleans up resources', async () => {
      const audio = new RetroAudio();
      await audio.init();
      audio.dispose();
      expect(audio.state).toBe('uninitialized');
    });

    it('can be called multiple times safely', async () => {
      const audio = new RetroAudio();
      await audio.init();
      audio.dispose();
      audio.dispose(); // Should not throw
      expect(audio.state).toBe('uninitialized');
    });
  });
});

describe('Synth', () => {
  const testInstrument: InstrumentData = {
    id: 'synth-test',
    name: 'Synth Test',
    channel: 'pulse1',
    waveform: { type: 'pulse', duty: 0.5 },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 },
    volume: 0.8,
  };

  beforeEach(() => {
    installWebAudioMocks();
  });

  afterEach(() => {
    uninstallWebAudioMocks();
  });

  it('plays and stops notes', async () => {
    const audio = new RetroAudio();
    await audio.init();
    const synth = audio.createSynth(testInstrument);

    synth.noteOn('C4');
    expect(synth.isPlaying).toBe(true);

    synth.noteOff();
    expect(synth.isPlaying).toBe(false);

    synth.dispose();
    audio.dispose();
  });

  it('accepts frequency instead of note name', async () => {
    const audio = new RetroAudio();
    await audio.init();
    const synth = audio.createSynth(testInstrument);

    synth.noteOn(440); // A4
    expect(synth.isPlaying).toBe(true);

    synth.noteOff();
    synth.dispose();
    audio.dispose();
  });

  it('can update envelope', async () => {
    const audio = new RetroAudio();
    await audio.init();
    const synth = audio.createSynth(testInstrument);

    synth.updateEnvelope({ attack: 0.5 });
    expect(synth.instrument.envelope.attack).toBe(0.5);

    synth.dispose();
    audio.dispose();
  });

  it('can update waveform', async () => {
    const audio = new RetroAudio();
    await audio.init();
    const synth = audio.createSynth(testInstrument);

    synth.setWaveform({ type: 'pulse', duty: 0.25 });
    const waveform = synth.instrument.waveform as { type: string; duty: number };
    expect(waveform.duty).toBe(0.25);

    synth.dispose();
    audio.dispose();
  });
});

describe('InstrumentBank', () => {
  beforeEach(() => {
    installWebAudioMocks();
  });

  afterEach(() => {
    uninstallWebAudioMocks();
  });

  it('manages instruments correctly', () => {
    const audio = new RetroAudio();

    const instruments: InstrumentData[] = [
      {
        id: 'lead',
        name: 'Lead',
        channel: 'pulse1',
        waveform: { type: 'pulse', duty: 0.25 },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 },
        volume: 0.8,
      },
      {
        id: 'bass',
        name: 'Bass',
        channel: 'wave',
        waveform: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 },
        volume: 0.9,
      },
    ];

    audio.loadInstruments(instruments);
    expect(audio.getInstrument('lead')?.channel).toBe('pulse1');
    expect(audio.getInstrument('bass')?.channel).toBe('wave');

    audio.clearInstruments();
    expect(audio.getInstrument('lead')).toBeUndefined();
    expect(audio.getInstrument('bass')).toBeUndefined();
  });
});
