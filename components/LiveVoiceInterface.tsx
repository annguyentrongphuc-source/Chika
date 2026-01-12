import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Radio, Volume2 } from 'lucide-react';
import { CHIKA_SYSTEM_INSTRUCTION } from '../types';
import { createBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

export const LiveVoiceInterface: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false); // Model is talking
  const [error, setError] = useState<string | null>(null);
  
  // Refs for audio handling to avoid re-renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const currentSessionRef = useRef<any>(null); // To track active session for cleanup

  const cleanup = useCallback(async () => {
    // Close session
    if (currentSessionRef.current) {
        try {
            // Using close() if available or just stopping logic
             // The SDK example uses session.close() on finish, but we might just disconnect
             // Currently there isn't a direct explicit close method on the promise result in all versions, 
             // but we will stop sending data.
        } catch (e) {
            console.error("Error closing session", e);
        }
        currentSessionRef.current = null;
    }

    // Stop audio sources
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();

    // Close mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Disconnect audio nodes
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Close contexts
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (inputContextRef.current) {
      await inputContextRef.current.close();
      inputContextRef.current = null;
    }
    
    setIsConnected(false);
    setIsTalking(false);
    nextStartTimeRef.current = 0;
  }, []);

  const startSession = async () => {
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initialize Audio Contexts
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const outputNode = audioContextRef.current.createGain();
      outputNode.connect(audioContextRef.current.destination);

      // Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Connect Live API
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // High pitch female-ish
          },
          systemInstruction: CHIKA_SYSTEM_INSTRUCTION,
        },
        callbacks: {
            onopen: async () => {
              setIsConnected(true);
              
              if (!inputContextRef.current || !streamRef.current) return;
    
              const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
              sourceRef.current = source;
              
              const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;
    
              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                
                sessionPromiseRef.current?.then(session => {
                    currentSessionRef.current = session;
                    session.sendRealtimeInput({ media: pcmBlob });
                });
              };
    
              source.connect(processor);
              processor.connect(inputContextRef.current.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
                const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                
                if (base64Audio && audioContextRef.current) {
                    setIsTalking(true);
                    
                    // Sync time
                    nextStartTimeRef.current = Math.max(
                        nextStartTimeRef.current,
                        audioContextRef.current.currentTime
                    );

                    const audioBuffer = await decodeAudioData(
                        base64ToUint8Array(base64Audio),
                        audioContextRef.current,
                        24000
                    );

                    const source = audioContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    
                    // Apply pitch shifting: +30% pitch without changing speed
                    // Strategy: Slow down playback, then use detune to increase pitch
                    // This compensates: slower speed + higher pitch = normal speed + higher pitch
                    const pitchPercent = 30;
                    const pitchRatio = 1 + (pitchPercent / 100); // 1.30
                    
                    // Slow down to compensate for pitch increase
                    source.playbackRate.value = 1.0 / pitchRatio; // ~0.77 to keep speed normal
                    
                    // Use detune to bring pitch back up
                    const detuneCents = 1200 * Math.log2(pitchRatio);
                    source.detune.value = detuneCents;
                    
                    // Light EQ to slightly brighten without distortion
                    const filter = audioContextRef.current.createBiquadFilter();
                    filter.type = 'highshelf'; // Better for overall brightness
                    filter.frequency.value = 3000;
                    filter.gain.value = 2; // Much lower gain (2dB) to preserve quality
                    
                    // Connect: source -> filter -> outputNode
                    source.connect(filter);
                    filter.connect(outputNode);
                    
                    source.addEventListener('ended', () => {
                        sourcesRef.current.delete(source);
                        if (sourcesRef.current.size === 0) {
                            setIsTalking(false);
                        }
                    });

                    source.start(nextStartTimeRef.current);
                    // No duration adjustment needed - detune doesn't change playback speed
                    nextStartTimeRef.current += audioBuffer.duration;
                    sourcesRef.current.add(source);
                }

                if (msg.serverContent?.interrupted) {
                    sourcesRef.current.forEach(s => {
                        try { s.stop(); } catch(e) {}
                    });
                    sourcesRef.current.clear();
                    nextStartTimeRef.current = 0;
                    setIsTalking(false);
                }
            },
            onclose: () => {
                setIsConnected(false);
            },
            onerror: (err) => {
                console.error("Live API Error", err);
                setError("Connection error. Please try again.");
                setIsConnected(false);
            }
        }
      });

    } catch (e) {
      console.error(e);
      setError("Failed to access microphone or connect.");
      cleanup();
    }
  };

  const handleToggle = () => {
    if (isConnected) {
      cleanup();
    } else {
      startSession();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 bg-gradient-to-br from-pink-50 to-pink-100 rounded-3xl shadow-inner border-4 border-white">
      <div className="relative">
        {/* Avatar / Visualizer */}
        <div className={`w-48 h-48 rounded-full border-8 transition-all duration-300 flex items-center justify-center overflow-hidden bg-white shadow-xl
            ${isConnected ? (isTalking ? 'border-pink-500 scale-110 shadow-pink-300' : 'border-green-400') : 'border-gray-300 grayscale'}
        `}>
           {/* Placeholder for Chika Image - using a cute anime girl placeholder */}
           <img 
             src="https://picsum.photos/400/400" 
             alt="Chika" 
             className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity"
           />
           {isTalking && (
             <div className="absolute inset-0 bg-pink-500 mix-blend-overlay animate-pulse opacity-30 rounded-full"></div>
           )}
        </div>
        
        {/* Status Badge */}
        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
             <span className={`px-4 py-1 rounded-full text-xs font-bold text-white shadow-md uppercase tracking-wider
                ${isConnected ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gray-400'}
             `}>
                {isConnected ? (isTalking ? "Chika Speaking..." : "Listening...") : "Offline"}
             </span>
        </div>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-pink-600 tracking-tight">Live Voice Chat</h2>
        <p className="text-gray-600 text-sm font-medium">Talk to Chika in real-time!</p>
      </div>

      {error && (
        <div className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-bold animate-bounce">
            {error}
        </div>
      )}

      <button
        onClick={handleToggle}
        className={`relative group w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95
            ${isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-pink-500 hover:bg-pink-600'}
        `}
      >
        {isConnected ? (
           <MicOff className="w-8 h-8 text-white" />
        ) : (
           <Mic className="w-8 h-8 text-white animate-pulse" />
        )}
        
        {/* Ripple effect */}
        {isConnected && (
            <span className="absolute inset-0 rounded-full bg-red-500 opacity-75 animate-ping"></span>
        )}
      </button>

      <div className="flex gap-4 text-xs text-pink-400 font-bold uppercase tracking-widest opacity-60">
        <div className="flex items-center gap-1">
            <Radio className="w-4 h-4" /> Live API
        </div>
        <div className="flex items-center gap-1">
            <Volume2 className="w-4 h-4" /> PCM Stream
        </div>
      </div>
    </div>
  );
};
