import React from 'react';
import { ChatInterface } from './components/ChatInterface';
import { Heart } from 'lucide-react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#fce7f3] flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

      <div className="max-w-2xl w-full h-[85vh] flex flex-col relative z-10">
          <div className="mb-4 text-center">
            <div className="inline-flex items-center gap-2 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border border-white mb-2 shadow-sm">
                 <Heart className="w-4 h-4 fill-current text-red-500 animate-pulse" />
                 <span className="text-xs font-bold text-pink-500 tracking-wider">Chika - chan 💖</span>
            </div>
            <h1 className="text-4xl font-black text-gray-800 tracking-tight drop-shadow-sm">Your Secretary <span className="text-pink-500">.</span></h1>
            <p className="text-gray-500 font-medium text-sm mt-1">Chat & Voice Response</p>
          </div>
          
          <div className="flex-1 h-full shadow-2xl rounded-3xl overflow-hidden ring-4 ring-white/50">
              <ChatInterface />
          </div>
      </div>
    </div>
  );
};

export default App;