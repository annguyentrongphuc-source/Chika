import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Brain, Zap, Volume2, Mic } from 'lucide-react';
import { Message, ModelType } from '../types';
import { createChatSession, generateSpeech, ApiKeyType } from '../services/gemini';
import { Chat } from '@google/genai';
import { playAudio, playAudioWithAdvancedPitchShift, playAudioWithAmplitudeAnalysis, base64ToUint8Array, decodeAudioData } from '../utils/audioUtils';
import { parseEmotionTags, removeEmotionTags, getFirstEmotion, getLastEmotion, ChikaExpression } from '../utils/emotionUtils';

interface ChatInterfaceProps {
  onAudioStateChange?: (isPlaying: boolean) => void; // Callback to sync audio state with LiveVoiceInterface
  onAmplitudeUpdate?: (amplitude: number) => void; // Callback to sync amplitude (0-1) with LiveVoiceInterface
  onExpressionChange?: (expression: ChikaExpression) => void; // Callback to sync expression with LiveVoiceInterface
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onAudioStateChange, onAmplitudeUpdate, onExpressionChange }) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
        id: 'init', 
        role: 'model', 
        text: 'Ne ne~ Let\'s chat! Don da yo!',
        translation: 'Hey hey~ Let\'s chat! Bam!'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelType, setModelType] = useState<ModelType>('fast');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [apiKeyType, setApiKeyType] = useState<ApiKeyType>('primary');
  
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize or Update Session when model or API key changes
  useEffect(() => {
    chatSessionRef.current = createChatSession(modelType, messages, apiKeyType);
  }, [modelType, apiKeyType]); 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPlayingAudio]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Ensure session exists (it should)
    if (!chatSessionRef.current) {
        chatSessionRef.current = createChatSession(modelType, messages, apiKeyType);
    }

    const userText = inputValue;
    setInputValue('');
    setIsLoading(true);

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText
    };

    const newHistory = [...messages, newMessage];
    setMessages(newHistory);

    try {
      // Optimistic update for thinking/loading state
      setMessages(prev => [...prev, { id: 'thinking', role: 'model', text: '', isThinking: true }]);

      const result = await chatSessionRef.current.sendMessage({
        message: userText
      });

      const responseText = result.text;
      if (!responseText) throw new Error("No response text");

      let japaneseText = responseText;
      let englishTranslation = "";

      // Parse JSON response
      try {
        const jsonResponse = JSON.parse(responseText);
        japaneseText = jsonResponse.japanese || responseText;
        englishTranslation = jsonResponse.english || "";
      } catch (e) {
        console.warn("Could not parse JSON response, falling back to raw text", e);
        // Fallback: assume raw text is Japanese
        japaneseText = responseText;
      }

      // Parse emotion tags from text (but don't schedule yet - wait for audio)
      const emotionTags = parseEmotionTags(japaneseText);
      console.log('Emotion tags found:', emotionTags);

      // Remove emotion tags from display text
      const cleanJapaneseText = removeEmotionTags(japaneseText);

      // Update UI with cleaned text (no emotion tags visible) - text appears first
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'thinking');
        return [...filtered, {
          id: Date.now().toString() + '_model',
          role: 'model',
          text: cleanJapaneseText, // Clean text without tags
          translation: englishTranslation
        }];
      });

      // Generate Audio (TTS) using cleaned text (without emotion tags)
      const audioData = await generateSpeech(cleanJapaneseText, apiKeyType);
      if (audioData) {
        // Get actual audio duration BEFORE starting playback
        // This ensures emotion changes are synced with actual audio playback
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const tempCtx = new AudioContextClass({ sampleRate: 24000 });
        const uint8 = base64ToUint8Array(audioData);
        const audioBuffer = await decodeAudioData(uint8, tempCtx, 24000);
        // Account for playbackRate (0.95) used in playAudioWithAmplitudeAnalysis
        const actualDurationMs = (audioBuffer.duration / 0.95) * 1000; // Convert to ms (playbackRate = 0.95, so divide to get actual duration)
        tempCtx.close();
        
        console.log(`Audio duration: ${actualDurationMs}ms`);

        // NOW schedule emotion changes based on ACTUAL audio duration
        // This syncs emotions with voice playback, not text display
        if (emotionTags.length > 0) {
          // Schedule all emotion changes based on text position and actual audio duration
          emotionTags.forEach((tag, index) => {
            // Calculate timing based on character position in original text (with tags)
            // Position ratio tells us where in the text the emotion tag appears
            const positionRatio = tag.position / (japaneseText.length || 1);
            // Map this ratio to actual audio duration
            const updateTimeMs = actualDurationMs * positionRatio;
            
            console.log(`Scheduling emotion change to ${tag.emotion} at ${updateTimeMs}ms (position: ${tag.position}, ratio: ${positionRatio.toFixed(2)})`);
            
            setTimeout(() => {
              onExpressionChange?.(tag.emotion);
              console.log('Emotion changed to:', tag.emotion);
            }, updateTimeMs);
          });
          
          // Ensure last emotion is set at the end of audio
          const lastEmotion = emotionTags[emotionTags.length - 1].emotion;
          setTimeout(() => {
            onExpressionChange?.(lastEmotion);
            console.log('Final emotion set to:', lastEmotion);
          }, actualDurationMs);
        } else {
          // Fallback: no tags found, use neutral when audio starts
          console.log('No emotion tags found, using neutral');
        }
        
        // NOW start audio playback (after scheduling emotions)
        setIsPlayingAudio(true);
        onAudioStateChange?.(true); // Sync with LiveVoiceInterface
        
        // Set first emotion (or neutral) when audio actually starts playing
        if (emotionTags.length > 0) {
          const firstEmotion = emotionTags[0].emotion;
          onExpressionChange?.(firstEmotion);
          console.log('Setting first emotion when audio starts:', firstEmotion);
        } else {
          onExpressionChange?.('neutral');
        }
        
        // Use amplitude analysis for real-time visualization
        if (onAmplitudeUpdate) {
          await playAudioWithAmplitudeAnalysis(
            audioData,
            (amplitude) => onAmplitudeUpdate(amplitude),
            24000,
            30
          );
        } else {
          // Fallback to simple playback if no amplitude callback
          await playAudioWithAdvancedPitchShift(audioData, 24000, 30);
        }
        
        setIsPlayingAudio(false);
        onAudioStateChange?.(false); // Sync with LiveVoiceInterface
        onAmplitudeUpdate?.(0); // Reset amplitude
      } else {
        // No audio data - fallback to neutral
        onExpressionChange?.('neutral');
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'thinking');
        return [...filtered, {
            id: Date.now().toString() + '_error',
            role: 'model',
            text: "Peshin! Something went wrong! (Error)",
            translation: "Whack! An error occurred!"
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleModel = () => {
    setModelType(prev => prev === 'fast' ? 'thinking' : 'fast');
  };

  return (
    <div className="flex flex-col h-full bg-white/50 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden border border-pink-100">
      
      {/* Header with Switch and Avatar */}
      <div className="bg-white/80 p-3 md:p-4 border-b border-pink-100 flex items-center justify-between z-10">
         <div className="flex items-center gap-3">
            {/* Dynamic Avatar */}
            <div className="relative">
                <div className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all duration-300 relative z-10
                    ${isLoading ? 'border-yellow-400 scale-95' : 
                      isPlayingAudio ? 'border-pink-500 scale-105' : 'border-pink-200'}
                `}>
                    <img 
                        src="https://pbs.twimg.com/media/E2WXLzOXoAE-ld5.png" 
                        alt="Chika Avatar" 
                        className="w-full h-full object-cover object-center avatar-optimized"
                    />
                </div>
                
                {/* Speaking Ripple Effect */}
                {isPlayingAudio && (
                    <>
                        <div className="absolute inset-0 rounded-full bg-pink-400 opacity-20 animate-ping"></div>
                        <div className="absolute -inset-1 rounded-full bg-pink-300 opacity-20 animate-pulse"></div>
                    </>
                )}

                {/* Thinking Indicator */}
                {isLoading && (
                    <div className="absolute -top-1 -right-1 bg-yellow-400 text-white rounded-full p-1 shadow-sm animate-bounce z-20 border border-white">
                        <Sparkles className="w-2.5 h-2.5" />
                    </div>
                )}
            </div>

            <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-800">Chika Fujiwara</span>
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : (isPlayingAudio ? 'bg-pink-500 animate-pulse' : 'bg-green-400')}`}></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                        {isLoading ? 'Thinking...' : (isPlayingAudio ? 'Speaking...' : 'Online')}
                    </span>
                </div>
            </div>
         </div>

         <div className="flex items-center gap-2">
            {/* API Key Toggle Switch */}
            <button
              onClick={() => setApiKeyType(prev => prev === 'primary' ? 'secondary' : 'primary')}
              disabled={isLoading}
              className={`px-2 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                apiKeyType === 'primary'
                  ? 'bg-pink-500 text-white border-pink-600 shadow-sm'
                  : 'bg-blue-500 text-white border-blue-600 shadow-sm'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
              title={`TTS API: ${apiKeyType === 'primary' ? 'API 1' : 'API 2'}`}
            >
              <span className="hidden md:inline">TTS: </span>{apiKeyType === 'primary' ? 'API 1' : 'API 2'}
            </button>

            {/* Model Toggle Switch */}
            <button 
               onClick={toggleModel}
               disabled={isLoading}
               className={`flex items-center gap-1 p-1 rounded-full border transition-all duration-300 ${
                   modelType === 'thinking' 
                   ? 'bg-purple-50 border-purple-200' 
                   : 'bg-yellow-50 border-yellow-200'
               }`}
            >
               <div className={`px-2 py-1.5 rounded-full flex items-center gap-1 transition-all text-[10px] font-bold ${
                   modelType === 'fast' ? 'bg-yellow-400 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
               }`}>
                   <Zap className="w-3 h-3" /> <span className="hidden md:inline">Fast</span>
               </div>
               <div className={`px-2 py-1.5 rounded-full flex items-center gap-1 transition-all text-[10px] font-bold ${
                   modelType === 'thinking' ? 'bg-purple-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
               }`}>
                   <Brain className="w-3 h-3" /> <span className="hidden md:inline">Thinking</span>
               </div>
            </button>
         </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
                
                {/* Avatar for Model Messages (Small) */}
                {msg.role === 'model' && !msg.isThinking && (
                    <div className="flex items-center gap-2 mb-1 ml-1">
                         <div className="w-5 h-5 rounded-full overflow-hidden border border-pink-200">
                             <img 
                                src="https://pbs.twimg.com/media/E2WXLzOXoAE-ld5.png" 
                                alt="Chika Mini" 
                                className="w-full h-full object-cover object-center avatar-optimized"
                            />
                         </div>
                         <span className="text-[10px] font-bold text-pink-500">Chika</span>
                    </div>
                )}
                
                <div
                className={`rounded-2xl px-5 py-3 shadow-sm relative ${
                    msg.role === 'user'
                    ? 'bg-pink-500 text-white rounded-br-none'
                    : 'bg-white text-gray-800 border border-pink-100 rounded-bl-none'
                }`}
                >
                {msg.isThinking ? (
                    <div className="flex items-center gap-2 text-pink-400 font-bold animate-pulse py-1">
                        {modelType === 'thinking' ? <Brain className="w-4 h-4 animate-bounce" /> : <Sparkles className="w-4 h-4 animate-spin" />}
                        <span className="text-xs">
                            {modelType === 'thinking' ? 'Thinking deeply...' : 'Writing...'}
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium">
                            {msg.text}
                        </div>
                        {msg.translation && (
                            <div className="text-xs text-black/50 font-normal border-t border-black/5 pt-1 mt-1">
                                ({msg.translation})
                            </div>
                        )}
                    </div>
                )}
                </div>

                {/* Audio Indicator for Model messages */}
                {msg.role === 'model' && !msg.isThinking && msg.id !== 'init' && (
                    <div className="mt-1 ml-2 flex items-center gap-1 text-pink-300">
                         {isPlayingAudio && msg === messages[messages.length - 1] ? (
                            <div className="flex gap-0.5 items-end h-3">
                                <div className="w-0.5 bg-pink-400 animate-[bounce_1s_infinite] h-2"></div>
                                <div className="w-0.5 bg-pink-400 animate-[bounce_1.2s_infinite] h-3"></div>
                                <div className="w-0.5 bg-pink-400 animate-[bounce_0.8s_infinite] h-1.5"></div>
                            </div>
                         ) : (
                            <Volume2 className="w-3 h-3 opacity-50" />
                         )}
                    </div>
                )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-pink-100">
        <div className="flex items-end gap-2 bg-pink-50 p-2 rounded-2xl border border-pink-200 focus-within:ring-2 focus-within:ring-pink-300 transition-all">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to Chika..."
            className="flex-1 bg-transparent border-none outline-none resize-none text-gray-700 placeholder-pink-300 p-2 max-h-32"
            rows={1}
            disabled={isLoading || isPlayingAudio}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim() || isPlayingAudio}
            className="p-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
          >
            {isLoading ? <Sparkles className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <div className="mt-2 text-center flex justify-center gap-4">
            <span className="text-[10px] text-gray-400 font-medium">
                Mode: {modelType === 'thinking' ? 'Gemini 3 Pro (Thinking)' : 'Gemini 3 Flash (Fast)'}
            </span>
        </div>
      </div>
    </div>
  );
};