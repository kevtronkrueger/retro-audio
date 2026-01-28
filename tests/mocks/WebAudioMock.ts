/**
 * Web Audio API Mocks for Testing
 *
 * Provides mock implementations of Web Audio API classes for unit testing
 * without requiring a browser environment.
 */

/**
 * Scheduled automation event for time-aware value changes
 */
interface ScheduledEvent {
  type: 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime' | 'setTargetAtTime';
  value: number;
  time: number;
  timeConstant?: number; // For setTargetAtTime
}

export class MockAudioParam {
  private _value: number = 0;
  private _scheduledEvents: ScheduledEvent[] = [];
  private _context: MockAudioContext | null = null;
  defaultValue: number = 0;
  minValue: number = -3.4028235e38;
  maxValue: number = 3.4028235e38;

  /**
   * Set the context reference for time-aware processing
   */
  setContext(context: MockAudioContext): void {
    this._context = context;
    context.registerParam(this);
  }

  get value(): number {
    return this._value;
  }

  set value(v: number) {
    this._value = v;
  }

  setValueAtTime(value: number, time: number): MockAudioParam {
    this._scheduledEvents.push({ type: 'setValueAtTime', value, time });
    this._scheduledEvents.sort((a, b) => a.time - b.time);
    // Process immediately if time is in the past or now
    if (this._context && time <= this._context.currentTime) {
      this._value = value;
    }
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): MockAudioParam {
    this._scheduledEvents.push({ type: 'linearRampToValueAtTime', value, time });
    this._scheduledEvents.sort((a, b) => a.time - b.time);
    // Immediately set value if time is in the past or now
    if (this._context && time <= this._context.currentTime) {
      this._value = value;
    }
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): MockAudioParam {
    this._scheduledEvents.push({ type: 'exponentialRampToValueAtTime', value, time });
    this._scheduledEvents.sort((a, b) => a.time - b.time);
    // Immediately set value if time is in the past or now
    if (this._context && time <= this._context.currentTime) {
      this._value = value;
    }
    return this;
  }

  setTargetAtTime(target: number, startTime: number, timeConstant: number): MockAudioParam {
    this._scheduledEvents.push({
      type: 'setTargetAtTime',
      value: target,
      time: startTime,
      timeConstant
    });
    this._scheduledEvents.sort((a, b) => a.time - b.time);
    return this;
  }

  cancelScheduledValues(startTime: number): MockAudioParam {
    this._scheduledEvents = this._scheduledEvents.filter(e => e.time < startTime);
    return this;
  }

  /**
   * Process scheduled events up to the given time
   * Called by MockAudioContext.advanceTime()
   */
  processScheduledEventsUntil(time: number): void {
    while (this._scheduledEvents.length > 0 && this._scheduledEvents[0].time <= time) {
      const event = this._scheduledEvents.shift()!;
      this._value = event.value;
    }
  }

  /**
   * Get all pending scheduled events (for testing)
   */
  getScheduledEvents(): ScheduledEvent[] {
    return [...this._scheduledEvents];
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
    this.gain.setContext(context);
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
    this.frequency.setContext(context);
    this.detune.setContext(context);
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
    this.playbackRate.setContext(context);
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
  private registeredParams: Set<MockAudioParam> = new Set();

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

  /**
   * Register an AudioParam for time-aware processing
   */
  registerParam(param: MockAudioParam): void {
    this.registeredParams.add(param);
  }

  /**
   * Advance time for testing and process scheduled param automation
   */
  advanceTime(seconds: number): void {
    this.currentTime += seconds;
    // Process all registered params' scheduled events
    for (const param of this.registeredParams) {
      param.processScheduledEventsUntil(this.currentTime);
    }
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
