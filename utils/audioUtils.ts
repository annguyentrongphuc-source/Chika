import { Blob } from '@google/genai';

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function playAudio(base64Audio: string, sampleRate = 24000): Promise<void> {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass({ sampleRate });
        const uint8 = base64ToUint8Array(base64Audio);
        const buffer = await decodeAudioData(uint8, ctx, sampleRate);
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        
        // Return a promise that resolves when audio finishes
        return new Promise((resolve) => {
            source.onended = () => {
                ctx.close();
                resolve();
            };
        });
    } catch (e) {
        console.error("Audio playback failed", e);
    }
}

export async function playAudioWithAdvancedPitchShift(
  base64Audio: string, 
  sampleRate: number = 24000, 
  pitchRatio: number = 1.0
): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({ sampleRate });
    const uint8 = base64ToUint8Array(base64Audio);
    const buffer = await decodeAudioData(uint8, ctx, sampleRate);
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // Pitch/Speed shift
    source.playbackRate.value = pitchRatio;

    // Formant shifting (EQ) to make it sound more feminine/anime-like
    // Boost highs
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'peaking';
    filter1.frequency.value = 2000;
    filter1.Q.value = 1;
    filter1.gain.value = 8;

    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'peaking';
    filter2.frequency.value = 3500;
    filter2.Q.value = 2;
    filter2.gain.value = 10;
    
    // Connect graph: source -> filter1 -> filter2 -> destination
    source.connect(filter1);
    filter1.connect(filter2);
    filter2.connect(ctx.destination);
    
    source.start(0);

    return new Promise((resolve) => {
      source.onended = () => {
        ctx.close();
        resolve();
      };
    });
  } catch (e) {
    console.error("Audio playback failed", e);
  }
}

export function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: arrayBufferToBase64(int16.buffer),
    mimeType: 'audio/pcm;rate=16000',
  };
}