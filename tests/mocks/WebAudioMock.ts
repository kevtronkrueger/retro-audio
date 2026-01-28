/**
 * Web Audio API Mocks for Testing
 *
 * Provides mock implementations of Web Audio API classes for unit testing
 * without requiring a browser environment.
 */

export class MockAudioParam {
  value: number = 0;
  defaultValue: number = 0;
  minValue: number = -3.4028235e38;
  maxValue: number = 3.4028235e38;

  setValueAtTime(value: number, _time: number): MockAudioParam {
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number, _time: number): MockAudioParam {
    this.value = value;
    return this;
  }

  exponentialRampToValueAtTime(value: number, _time: number): MockAudioParam {
    this.value = value;
    return this;
  }

  setTargetAtTime(target: number, _startTime: number, _timeConstant: number): MockAudioParam {
    this.value = target;
    return this;
  }

  cancelScheduledValues(_startTime: number): MockAudioParam {
    return this;
  }
}

export class MockAudioNode {
  context: MockAudioContext;
  numberOfInputs: number = 1;
  numberOfOutputs: number = 1;

  constructor(context: MockAudioContext) {
    this.context = context;
  }

  connect(_destination: MockAudioNode | MockAudioParam): MockAudioNode {
    return this;
  }

  disconnect(): void {}
}

export class MockGainNode extends MockAudioNode {
  gain: MockAudioParam = new MockAudioParam();

  constructor(context: MockAudioContext) {
    super(context);
    this.gain.value = 1;
  }
}

export class MockOscillatorNode extends MockAudioNode {
  frequency: MockAudioParam = new MockAudioParam();
  detune: MockAudioParam = new MockAudioParam();
  type: OscillatorType = 'sine';
  private _started: boolean = false;
  private _stopped: boolean = false;

  constructor(context: MockAudioContext) {
    super(context);
    this.frequency.value = 440;
  }

  start(_when?: number): void {
    if (this._started) throw new Error('Cannot start oscillator more than once');
    this._started = true;
  }

  stop(_when?: number): void {
    if (!this._started) throw new Error('Cannot stop oscillator before starting');
    this._stopped = true;
  }

  setPeriodicWave(_wave: PeriodicWave): void {}
}

export class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: AudioBuffer | null = null;
  playbackRate: MockAudioParam = new MockAudioParam();
  loop: boolean = false;
  loopStart: number = 0;
  loopEnd: number = 0;
  private _started: boolean = false;

  constructor(context: MockAudioContext) {
    super(context);
    this.playbackRate.value = 1;
  }

  start(_when?: number): void {
    this._started = true;
  }

  stop(_when?: number): void {
    if (!this._started) throw new Error('Cannot stop before starting');
  }
}

export class MockAudioBuffer {
  sampleRate: number;
  length: number;
  duration: number;
  numberOfChannels: number;
  private channels: Float32Array[];

  constructor(options: { numberOfChannels: number; length: number; sampleRate: number }) {
    this.numberOfChannels = options.numberOfChannels;
    this.length = options.length;
    this.sampleRate = options.sampleRate;
    this.duration = options.length / options.sampleRate;
    this.channels = [];
    for (let i = 0; i < options.numberOfChannels; i++) {
      this.channels.push(new Float32Array(options.length));
    }
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel];
  }

  copyFromChannel(destination: Float32Array, channelNumber: number, startInChannel?: number): void {
    const source = this.channels[channelNumber];
    const start = startInChannel ?? 0;
    for (let i = 0; i < destination.length && i + start < source.length; i++) {
      destination[i] = source[i + start];
    }
  }

  copyToChannel(source: Float32Array, channelNumber: number, startInChannel?: number): void {
    const dest = this.channels[channelNumber];
    const start = startInChannel ?? 0;
    for (let i = 0; i < source.length && i + start < dest.length; i++) {
      dest[i + start] = source[i];
    }
  }
}

export class MockPeriodicWave {}

export class MockAudioContext {
  sampleRate: number = 44100;
  currentTime: number = 0;
  state: AudioContextState = 'running';
  destination: MockAudioNode;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(options?: { sampleRate?: number; latencyHint?: string }) {
    if (options?.sampleRate) {
      this.sampleRate = options.sampleRate;
    }
    this.destination = new MockAudioNode(this);
  }

  createGain(): MockGainNode {
    return new MockGainNode(this);
  }

  createOscillator(): MockOscillatorNode {
    return new MockOscillatorNode(this);
  }

  createBufferSource(): MockAudioBufferSourceNode {
    return new MockAudioBufferSourceNode(this);
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): MockAudioBuffer {
    return new MockAudioBuffer({ numberOfChannels, length, sampleRate });
  }

  createPeriodicWave(
    _real: Float32Array,
    _imag: Float32Array,
    _constraints?: PeriodicWaveConstraints
  ): MockPeriodicWave {
    return new MockPeriodicWave();
  }

  async resume(): Promise<void> {
    this.state = 'running';
    this.dispatchEvent('statechange');
  }

  async suspend(): Promise<void> {
    this.state = 'suspended';
    this.dispatchEvent('statechange');
  }

  async close(): Promise<void> {
    this.state = 'closed';
    this.dispatchEvent('statechange');
  }

  addEventListener(type: string, listener: Function): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: Function): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private dispatchEvent(type: string): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => listener());
    }
  }

  // Advance time for testing
  advanceTime(seconds: number): void {
    this.currentTime += seconds;
  }
}

// Install mocks globally for testing
export function installWebAudioMocks(): void {
  (globalThis as any).AudioContext = MockAudioContext;
  (globalThis as any).GainNode = MockGainNode;
  (globalThis as any).OscillatorNode = MockOscillatorNode;
  (globalThis as any).AudioBufferSourceNode = MockAudioBufferSourceNode;
  (globalThis as any).AudioBuffer = MockAudioBuffer;
  (globalThis as any).PeriodicWave = MockPeriodicWave;
}

export function uninstallWebAudioMocks(): void {
  delete (globalThis as any).AudioContext;
  delete (globalThis as any).GainNode;
  delete (globalThis as any).OscillatorNode;
  delete (globalThis as any).AudioBufferSourceNode;
  delete (globalThis as any).AudioBuffer;
  delete (globalThis as any).PeriodicWave;
}
