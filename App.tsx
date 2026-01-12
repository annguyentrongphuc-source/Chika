import React, { useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { LiveVoiceInterface } from './components/LiveVoiceInterface';
import { Heart } from 'lucide-react';
import { ChikaExpression } from './utils/emotionUtils';

const App: React.FC = () => {
  // Shared state for audio playing - sync between ChatInterface and LiveVoiceInterface
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  // Shared state for audio amplitude (0-1) for visualization
  const [audioAmplitude, setAudioAmplitude] = useState(0);
  // Shared state for Chika's current expression
  const [currentExpression, setCurrentExpression] = useState<ChikaExpression>('neutral');

  return (
    <div className="min-h-screen bg-[#fce7f3] flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

      <div className="max-w-7xl w-full h-[92vh] flex flex-col relative z-10 gap-4">
          <div className="text-center flex-none">
            <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/50 mb-2 shadow-sm hover:scale-105 transition-transform cursor-pointer">
                 <Heart className="w-4 h-4 fill-current text-red-500 animate-pulse" />
                 <span className="text-xs font-bold text-pink-500 tracking-wider uppercase">Chika Fujiwara AI</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-800 tracking-tight drop-shadow-sm flex items-center justify-center gap-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-red-500">Love Is War</span>
              <span className="text-gray-300 text-2xl hidden md:inline">|</span> 
              <span className="text-gray-700 hidden md:inline">Secretary Chat</span>
            </h1>
          </div>
          
          {/* Main Layout Grid */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
              
              {/* Left Column: Chat Interface (Main focus - 8/12 cols) */}
              <div className="lg:col-span-8 h-full shadow-2xl rounded-[2rem] overflow-hidden ring-4 ring-white/50 bg-white/40 backdrop-blur-md flex flex-col">
                  <ChatInterface 
                    onAudioStateChange={setIsPlayingAudio}
                    onAmplitudeUpdate={setAudioAmplitude}
                    onExpressionChange={setCurrentExpression}
                  />
              </div>

              {/* Right Column: Live Voice Interface (Side panel - 4/12 cols) */}
              <div className="lg:col-span-4 h-full min-h-[350px] shadow-2xl rounded-[2rem] overflow-hidden ring-4 ring-white/50 bg-white/40 backdrop-blur-md">
                  <LiveVoiceInterface 
                    isPlayingAudio={isPlayingAudio}
                    audioAmplitude={audioAmplitude}
                    expression={currentExpression}
                  />
              </div>
          </div>
      </div>
    </div>
  );
};

export default App;