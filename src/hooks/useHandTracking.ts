import { useRef, useCallback, useEffect, useState } from 'react';

export interface HandData {
  x: number;
  y: number;
  isOpen: boolean;
  landmarks: { x: number; y: number }[];
}

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement>,
  onHandUpdate: (hand: HandData | null) => void
) {
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Simple motion-based tracking using canvas pixel analysis
  const prevFrameRef = useRef<ImageData | null>(null);

  const detectMotion = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const currentFrame = ctx.getImageData(0, 0, width, height);
    const prevFrame = prevFrameRef.current;

    if (!prevFrame) {
      prevFrameRef.current = currentFrame;
      return null;
    }

    // Find center of motion (simplified hand detection)
    let motionX = 0;
    let motionY = 0;
    let motionCount = 0;
    let totalBrightness = 0;

    const threshold = 30;
    const step = 4; // Sample every 4th pixel for performance

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        
        const rDiff = Math.abs(currentFrame.data[i] - prevFrame.data[i]);
        const gDiff = Math.abs(currentFrame.data[i + 1] - prevFrame.data[i + 1]);
        const bDiff = Math.abs(currentFrame.data[i + 2] - prevFrame.data[i + 2]);
        
        const diff = (rDiff + gDiff + bDiff) / 3;
        
        if (diff > threshold) {
          // Mirror x coordinate for natural interaction
          motionX += (width - x);
          motionY += y;
          motionCount++;
          totalBrightness += (currentFrame.data[i] + currentFrame.data[i + 1] + currentFrame.data[i + 2]) / 3;
        }
      }
    }

    prevFrameRef.current = currentFrame;

    if (motionCount > 50) { // Minimum motion pixels to detect
      const avgBrightness = totalBrightness / motionCount;
      // Use motion area size to determine if hand is "open" (larger area)
      const isOpen = motionCount > 200;
      
      return {
        x: motionX / motionCount,
        y: motionY / motionCount,
        isOpen,
        landmarks: [],
      };
    }

    return null;
  }, []);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.paused || video.ended) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const handData = detectMotion(ctx, canvas.width, canvas.height);
    
    if (handData) {
      // Scale from canvas size to video size
      const scaleX = video.videoWidth / canvas.width;
      const scaleY = video.videoHeight / canvas.height;
      
      onHandUpdate({
        ...handData,
        x: handData.x * scaleX,
        y: handData.y * scaleY,
      });
    } else {
      onHandUpdate(null);
    }

    animationRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, detectMotion, onHandUpdate]);

  const initialize = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      setError('Video element not found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user',
        },
      });

      streamRef.current = stream;
      video.srcObject = stream;
      
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play()
            .then(() => resolve())
            .catch(reject);
        };
        video.onerror = () => reject(new Error('Video failed to load'));
        
        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Camera timeout')), 5000);
      });

      // Create analysis canvas
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      canvasRef.current = canvas;

      // Start processing
      animationRef.current = requestAnimationFrame(processFrame);
      
      setIsActive(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Camera initialization error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      
      if (message.includes('Permission') || message.includes('NotAllowed')) {
        setError('Camera permission denied. Please allow camera access.');
      } else if (message.includes('NotFound')) {
        setError('No camera found on this device.');
      } else {
        setError(`Camera error: ${message}`);
      }
      setIsLoading(false);
    }
  }, [videoRef, processFrame]);

  const stop = useCallback(() => {
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
    }
    
    canvasRef.current = null;
    prevFrameRef.current = null;
    setIsActive(false);
  }, [videoRef]);

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
