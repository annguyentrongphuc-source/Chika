import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Brain, Zap, Volume2, Mic } from 'lucide-react';
import { Message, ModelType } from '../types';
import { createChatSession, generateSpeech } from '../services/gemini';
import { Chat } from '@google/genai';
import { playAudio, playAudioWithAdvancedPitchShift } from '../utils/audioUtils';

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'model', text: 'Ne ne~ Let\'s chat! Don da yo!' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelType, setModelType] = useState<ModelType>('fast');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize or Update Session when model changes
  useEffect(() => {
    chatSessionRef.current = createChatSession(modelType, messages);
    // Note: We pass 'messages' to restore history when switching, 
    // but in a real app you might want to debounce this or only do it on toggle.
  }, [modelType]); 

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
        chatSessionRef.current = createChatSession(modelType, messages);
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

      // Update UI with text response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'thinking');
        return [...filtered, {
          id: Date.now().toString() + '_model',
          role: 'model',
          text: responseText
        }];
      });

      // Generate and Play Audio (TTS) with higher pitch for genki girl voice
      const audioData = await generateSpeech(responseText);
      if (audioData) {
        setIsPlayingAudio(true);
        // Use advanced pitch shift for higher pitch without much speed change
        // pitchShiftRatio: 1.3 = +30% pitch (higher than default 1.25)
        await playAudioWithAdvancedPitchShift(audioData, 24000, 1.3);
        setIsPlayingAudio(false);
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'thinking');
        return [...filtered, {
            id: Date.now().toString() + '_error',
            role: 'model',
            text: "Peshin! Something went wrong! (Error)"
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
                    <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                    {msg.text}
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