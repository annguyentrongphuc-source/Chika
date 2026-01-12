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
  pitchPercent: number = 5 // Pitch increase in percentage (default 5%)
): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({ sampleRate });
    const uint8 = base64ToUint8Array(base64Audio);
    const buffer = await decodeAudioData(uint8, ctx, sampleRate);
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // Strategy: Use detune for pitch, keep playbackRate close to 1.0 for normal speed
    // Adjust playbackRate slightly to compensate if needed
    const pitchRatio = 1 + (pitchPercent / 100); // e.g., 1.30 for +30%
    
    // Use detune to increase pitch
    const detuneCents = 1200 * Math.log2(pitchRatio);
    source.detune.value = detuneCents;
    
    // Keep playbackRate close to 1.0 for normal speed (slight adjustment if needed)
    // For +30% pitch, use playbackRate slightly above 1.0 to compensate for perceived slowness
    source.playbackRate.value = 1.05; // Slightly faster to compensate

    // Light EQ to preserve quality while slightly brightening voice
    const filter = ctx.createBiquadFilter();
    filter.type = 'highshelf';
    filter.frequency.value = 3000;
    filter.gain.value = 2;
    
    // Connect graph: source -> filter -> destination
    source.connect(filter);
    filter.connect(ctx.destination);
    
    source.start(0);

    return new Promise((resolve) => {
      source.onended = () => {
        ctx.close();
        resolve();
      };
    });
  } catch (e) {
    console.error("Audio playback failed", e);
    // Fallback to simple playback if filter fails
    return playAudio(base64Audio, sampleRate);
  }
}

// Play audio with real-time amplitude analysis for visualization
export async function playAudioWithAmplitudeAnalysis(
  base64Audio: string,
  onAmplitudeUpdate: (amplitude: number) => void, // Callback with amplitude (0-1)
  sampleRate: number = 24000,
  pitchPercent: number = 30
): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({ sampleRate });
    const uint8 = base64ToUint8Array(base64Audio);
    const buffer = await decodeAudioData(uint8, ctx, sampleRate);
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // Pitch shifting
    const pitchRatio = 1 + (pitchPercent / 100);
    const detuneCents = 1200 * Math.log2(pitchRatio);
    source.detune.value = detuneCents;
    source.playbackRate.value = 1.05;

    // EQ filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'highshelf';
    filter.frequency.value = 3000;
    filter.gain.value = 2;
    
    // AnalyserNode for amplitude analysis
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256; // Smaller for faster updates
    analyser.smoothingTimeConstant = 0.8; // Smooth transitions
    
    // Connect: source -> filter -> analyser -> destination
    source.connect(filter);
    filter.connect(analyser);
    analyser.connect(ctx.destination);
    
    // Data array for frequency analysis
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrameId: number;
    let isPlaying = true;
    
    // Function to analyze amplitude
    const analyze = () => {
      if (!isPlaying) return;
      
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average amplitude
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const amplitude = average / 255; // Normalize to 0-1
      
      // Update callback
      onAmplitudeUpdate(amplitude);
      
      // Continue analyzing
      animationFrameId = requestAnimationFrame(analyze);
    };
    
    source.start(0);
    analyze(); // Start analysis loop

    return new Promise((resolve) => {
      source.onended = () => {
        isPlaying = false;
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        onAmplitudeUpdate(0); // Reset amplitude
        ctx.close();
        resolve();
      };
    });
  } catch (e) {
    console.error("Audio playback with amplitude analysis failed", e);
    onAmplitudeUpdate(0);
    // Fallback to simple playback
    return playAudioWithAdvancedPitchShift(base64Audio, sampleRate, pitchPercent);
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