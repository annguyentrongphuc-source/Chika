import React, { useState, useEffect, useRef } from 'react';
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
  const imagesPreloadedRef = useRef<Set<string>>(new Set());

  // Preload all emotion images on mount to ensure smooth transitions
  useEffect(() => {
    const allExpressions: ChikaExpression[] = ['neutral', 'angry', 'shock', 'panic', 'thinking', 'clueless'];
    console.log('Preloading all emotion images...');
    
    allExpressions.forEach(expr => {
      const imagePath = getExpressionImagePath(expr);
      if (!imagesPreloadedRef.current.has(imagePath)) {
        const img = new Image();
        img.onload = async () => {
          try {
            // Decode image to ensure it's ready for rendering (prevents decoding lag)
            await img.decode();
            imagesPreloadedRef.current.add(imagePath);
            console.log(`Preloaded and decoded: ${expr} (${imagePath})`);
          } catch (error) {
            console.error(`Failed to decode preload: ${expr}`, error);
            // Still mark as preloaded even if decode fails
            imagesPreloadedRef.current.add(imagePath);
          }
        };
        img.onerror = () => {
          console.error(`Failed to preload: ${expr} (${imagePath})`);
        };
        img.src = imagePath;
      }
    });
  }, []); // Only run once on mount

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
      
      const startTransition = () => {
        setIsTransitioning(true);
        setNextImage(newImagePath); // Set next image first
        
        // Wait for next frame to ensure DOM is updated with new image
        // Double requestAnimationFrame ensures image is rendered before fade starts
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Start crossfade - image is decoded and ready
            setOpacity(0); // Current fades out, next fades in
          });
        });
        
        // After transition completes, switch images
        setTimeout(() => {
          console.log('Switching to new image:', newImagePath);
          setCurrentImage(newImagePath);
          setOpacity(1); // Reset opacity for current image
          setIsTransitioning(false);
          setNextImage(''); // Clear next image
        }, 150);
      };
      
      // Check if image was already preloaded and decoded
      if (imagesPreloadedRef.current.has(newImagePath)) {
        // Image is preloaded - decode it again to ensure it's ready for rendering
        const img = new Image();
        img.src = newImagePath;
        
        // Decode image before starting transition (prevents decoding lag)
        img.decode()
          .then(() => {
            console.log('Image decoded, starting transition');
            startTransition();
          })
          .catch((error) => {
            console.error('Failed to decode image, starting anyway:', error);
            // Still start transition even if decode fails
            startTransition();
          });
      } else {
        // Image not preloaded - load and decode it now
        console.log('Image not preloaded, loading and decoding now...');
        const img = new Image();
        img.onload = async () => {
          try {
            // Decode image to ensure it's ready for rendering
            await img.decode();
            imagesPreloadedRef.current.add(newImagePath);
            console.log('Image loaded and decoded, starting transition');
            startTransition();
          } catch (error) {
            console.error('Failed to decode image:', error);
            // Still mark as preloaded and start transition even if decode fails
            imagesPreloadedRef.current.add(newImagePath);
            startTransition();
          }
        };
        img.onerror = () => {
          console.error('Failed to preload image:', newImagePath);
          // Still try to transition even if preload fails
          startTransition();
        };
        img.src = newImagePath;
      }
    }
  }, [expression, currentImage, isTransitioning]); // Add dependencies for proper re-rendering

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
              transition: 'opacity 0.15s ease-in-out'
            }}
            onError={(e) => {
              console.error('Failed to load image:', currentImage);
              // Hide image if it fails - show empty/white background
              e.currentTarget.style.display = 'none';
              console.error('Image failed to load - showing empty background');
            }}
          />
          
          {/* Next image (during transition) - soft blend with mix-blend-mode */}
          {isTransitioning && nextImage && (
            <img 
              src={nextImage}
              alt="Chika"
              className="w-full h-full object-cover object-center avatar-optimized absolute inset-0"
              style={{
                opacity: 1 - opacity, // Starts at 1 (when opacity=0), fades to 0 (when opacity=1)
                transition: 'opacity 0.15s ease-in-out',
                zIndex: 1, // Always on top during transition
                mixBlendMode: opacity > 0.5 ? 'normal' : 'multiply' // Soft blend when fading in
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