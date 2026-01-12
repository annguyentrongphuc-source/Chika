import React, { useState, useEffect } from 'react';
import { ChikaExpression, getExpressionImagePath } from '../utils/emotionUtils';

interface LiveVoiceInterfaceProps {
  isPlayingAudio?: boolean; // Sync with ChatInterface audio state
  audioAmplitude?: number; // Real-time amplitude (0-1) for animation
  expression?: ChikaExpression; // Current expression from ChatInterface
}

export const LiveVoiceInterface: React.FC<LiveVoiceInterfaceProps> = ({ 
  isPlayingAudio = false,
  audioAmplitude = 0,
  expression = 'neutral'
}) => {
  // Calculate scale based on amplitude (1.0 to 1.15)
  const scale = 1.0 + (audioAmplitude * 0.15);
  
  // Always start with neutral expression image (not using prop for initial state)
  const [currentImage, setCurrentImage] = useState<string>(() => 
    getExpressionImagePath('neutral') // Always initialize with neutral.jpg
  );
  const [nextImage, setNextImage] = useState<string>('');
  const [opacity, setOpacity] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Initialize image on mount - ensure it's neutral.jpg
  useEffect(() => {
    const neutralPath = getExpressionImagePath('neutral');
    console.log('Initializing with neutral image:', neutralPath);
    setCurrentImage(neutralPath);
    setOpacity(1);
  }, []); // Only run once on mount

  // Handle expression change với fade transition
  useEffect(() => {
    const currentExpression = (expression || 'neutral') as ChikaExpression;
    const newImagePath = getExpressionImagePath(currentExpression);
    
    // Only transition if the image path actually changes
    if (newImagePath !== currentImage && !isTransitioning) {
      console.log('Expression changed to:', currentExpression, 'New path:', newImagePath);
      setIsTransitioning(true);
      setNextImage(newImagePath);
      setOpacity(0); // Fade out current
      
      // Sau khi fade out, switch image và fade in
      setTimeout(() => {
        console.log('Switching to new image:', newImagePath);
        setCurrentImage(newImagePath);
        setOpacity(1); // Fade in new
        setIsTransitioning(false);
      }, 300); // Transition duration
    }
  }, [expression]); // Only depend on expression prop

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-6 bg-gradient-to-br from-pink-50 to-pink-100 rounded-3xl shadow-inner border-4 border-white">
      <div className="relative">
        {/* Avatar - Animated by amplitude with expression fade transition */}
        <div 
          className={`w-48 h-48 rounded-full border-8 transition-all duration-75 flex items-center justify-center overflow-hidden bg-white shadow-xl relative
            ${isPlayingAudio ? 'border-pink-500 shadow-pink-300' : 'border-pink-200'}
          `}
          style={{
            transform: `scale(${scale})`,
            transition: 'transform 0.05s ease-out' // Fast transition for smooth animation
          }}
        >
          {/* Current image */}
          <img 
            src={currentImage}
            alt="Chika"
            className="w-full h-full object-cover object-center avatar-optimized absolute inset-0"
            style={{
              opacity: opacity,
              transition: 'opacity 0.3s ease-in-out'
            }}
            onError={(e) => {
              console.error('Failed to load image:', currentImage);
              // Hide image if it fails - show empty/white background
              e.currentTarget.style.display = 'none';
              console.error('Image failed to load - showing empty background');
            }}
          />
          
          {/* Next image (during transition) */}
          {isTransitioning && nextImage && (
            <img 
              src={nextImage}
              alt="Chika"
              className="w-full h-full object-cover object-center avatar-optimized absolute inset-0"
              style={{
                opacity: 1 - opacity,
                transition: 'opacity 0.3s ease-in-out'
              }}
              onError={(e) => {
                 // Handle error for the transitioning image too
                 console.error('Transitioning image failed:', nextImage);
                 e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>
        
        {/* Status Badge - Always Online */}
        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
             <span className="px-4 py-1 rounded-full text-xs font-bold text-white shadow-md uppercase tracking-wider bg-gradient-to-r from-green-400 to-green-500">
                {isPlayingAudio ? "Speaking..." : "Online"}
             </span>
        </div>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-pink-600 tracking-tight">Chika Avatar</h2>
        <p className="text-gray-600 text-sm font-medium">Text chat audio visualization</p>
      </div>
    </div>
  );
};