import { useRef, useCallback, useEffect, useState } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

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
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  const calculateHandOpenness = useCallback((landmarks: { x: number; y: number; z: number }[]): boolean => {
    // Check if fingers are extended by comparing fingertip positions to knuckle positions
    const fingerTips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky tips
    const fingerBases = [5, 9, 13, 17]; // Corresponding MCP joints
    
    let extendedFingers = 0;
    
    for (let i = 0; i < fingerTips.length; i++) {
      const tip = landmarks[fingerTips[i]];
      const base = landmarks[fingerBases[i]];
      
      // If fingertip is higher (smaller y) than the base, finger is extended
      if (tip.y < base.y) {
        extendedFingers++;
      }
    }
    
    // Check thumb separately
    const thumbTip = landmarks[4];
    const thumbBase = landmarks[2];
    if (Math.abs(thumbTip.x - thumbBase.x) > 0.05) {
      extendedFingers++;
    }
    
    // Consider hand open if 3 or more fingers are extended
    return extendedFingers >= 3;
  }, []);

  const onResults = useCallback((results: Results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // Get palm center (average of wrist and middle finger MCP)
      const wrist = landmarks[0];
      const middleMcp = landmarks[9];
      
      const video = videoRef.current;
      if (!video) return;

      // Convert normalized coordinates to canvas coordinates
      // Note: x is mirrored for natural interaction
      const x = (1 - (wrist.x + middleMcp.x) / 2) * video.videoWidth;
      const y = ((wrist.y + middleMcp.y) / 2) * video.videoHeight;

      const isOpen = calculateHandOpenness(landmarks);

      onHandUpdate({
        x,
        y,
        isOpen,
        landmarks: landmarks.map((lm) => ({
          x: (1 - lm.x) * video.videoWidth,
          y: lm.y * video.videoHeight,
        })),
      });
    } else {
      onHandUpdate(null);
    }
  }, [videoRef, onHandUpdate, calculateHandOpenness]);

  const initialize = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setError(null);

    try {
      const hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        },
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });

      hands.onResults(onResults);
      handsRef.current = hands;

      const camera = new Camera(video, {
        onFrame: async () => {
          if (handsRef.current) {
            await handsRef.current.send({ image: video });
          }
        },
        width: 640,
        height: 480,
      });

      cameraRef.current = camera;
      await camera.start();
      
      setIsActive(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Hand tracking initialization error:', err);
      setError('Failed to initialize hand tracking. Please allow camera access.');
      setIsLoading(false);
    }
  }, [videoRef, onResults]);

  const stop = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    if (handsRef.current) {
      handsRef.current.close();
      handsRef.current = null;
    }
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
