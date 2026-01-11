import { useRef, useCallback, useEffect, useState } from 'react';

export interface HandData {
  x: number;
  y: number;
  isOpen: boolean;
}

export function useHandTracking(
  onHandUpdate: (hand: HandData | null) => void
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>(0);
  const prevFrameRef = useRef<ImageData | null>(null);
  const isRunningRef = useRef(false);
  const onHandUpdateRef = useRef(onHandUpdate);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Keep callback ref updated
  useEffect(() => {
    onHandUpdateRef.current = onHandUpdate;
  }, [onHandUpdate]);

  const processFrame = useCallback(() => {
    if (!isRunningRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.paused || video.ended || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const prevFrame = prevFrameRef.current;

      if (prevFrame) {
        // Find center of motion
        let motionX = 0;
        let motionY = 0;
        let motionCount = 0;

        const threshold = 25;
        const step = 4;
        const width = canvas.width;
        const height = canvas.height;

        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            const i = (y * width + x) * 4;
            
            const rDiff = Math.abs(currentFrame.data[i] - prevFrame.data[i]);
            const gDiff = Math.abs(currentFrame.data[i + 1] - prevFrame.data[i + 1]);
            const bDiff = Math.abs(currentFrame.data[i + 2] - prevFrame.data[i + 2]);
            
            const diff = (rDiff + gDiff + bDiff) / 3;
            
            if (diff > threshold) {
              motionX += (width - x); // Mirror for natural interaction
              motionY += y;
              motionCount++;
            }
          }
        }

        if (motionCount > 30) {
          const scaleX = video.videoWidth / canvas.width;
          const scaleY = video.videoHeight / canvas.height;
          
          onHandUpdateRef.current({
            x: (motionX / motionCount) * scaleX,
            y: (motionY / motionCount) * scaleY,
            isOpen: motionCount > 150,
          });
        } else {
          onHandUpdateRef.current(null);
        }
      }

      prevFrameRef.current = currentFrame;
    } catch (e) {
      // Ignore frame processing errors
    }

    animationRef.current = requestAnimationFrame(processFrame);
  }, []);

  const initialize = useCallback(async () => {
    if (isRunningRef.current) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Create video element
      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;
      videoRef.current = video;

      // Request camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user',
        },
      });

      streamRef.current = stream;
      video.srcObject = stream;

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Camera timeout')), 8000);
        
        video.onloadeddata = () => {
          clearTimeout(timeout);
          video.play()
            .then(() => resolve())
            .catch(reject);
        };
        
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video failed'));
        };
      });

      // Create analysis canvas
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      canvasRef.current = canvas;

      // Start processing
      isRunningRef.current = true;
      animationRef.current = requestAnimationFrame(processFrame);
      
      setIsActive(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Camera error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      
      if (message.includes('Permission') || message.includes('NotAllowed')) {
        setError('Camera permission denied');
      } else if (message.includes('NotFound') || message.includes('Requested device not found')) {
        setError('No camera found');
      } else {
        setError(`Camera error: ${message}`);
      }
      setIsLoading(false);
      setIsActive(false);
    }
  }, [processFrame]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    
    canvasRef.current = null;
    prevFrameRef.current = null;
    setIsActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    initialize,
    stop,
    isLoading,
    error,
    isActive,
  };
}
