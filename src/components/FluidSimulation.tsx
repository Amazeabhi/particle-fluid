import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useParticleSystem } from '@/hooks/useParticleSystem';
import { useHandTracking, HandData } from '@/hooks/useHandTracking';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Hand, Play, Pause, RotateCcw, Settings, X } from 'lucide-react';

export function FluidSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [showControls, setShowControls] = useState(false);
  const [particleCount, setParticleCount] = useState(400);
  const [interactionRadius, setInteractionRadius] = useState(150);
  const [interactionStrength, setInteractionStrength] = useState(0.5);
  const [isSimulating, setIsSimulating] = useState(false);

  const { start, stop, setHandPosition, reinitialize } = useParticleSystem(
    canvasRef,
    particleCount,
    interactionRadius,
    interactionStrength
  );

  const handleHandUpdate = useCallback((hand: HandData | null) => {
    if (hand && canvasRef.current && videoRef.current) {
      // Scale hand position from video coordinates to canvas coordinates
      const scaleX = canvasRef.current.width / videoRef.current.videoWidth;
      const scaleY = canvasRef.current.height / videoRef.current.videoHeight;
      
      setHandPosition({
        x: hand.x * scaleX,
        y: hand.y * scaleY,
        isOpen: hand.isOpen,
      });
    } else {
      setHandPosition(null);
    }
  }, [setHandPosition]);

  const { initialize: initHandTracking, stop: stopHandTracking, isLoading, error, isActive } = useHandTracking(
    videoRef,
    handleHandUpdate
  );

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      if (isSimulating) {
        reinitialize();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSimulating, reinitialize]);

  const handleStart = async () => {
    await initHandTracking();
    start();
    setIsSimulating(true);
  };

  const handleStop = () => {
    stop();
    stopHandTracking();
    setIsSimulating(false);
  };

  const handleReset = () => {
    reinitialize();
  };

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-background">
      {/* Hidden video for camera feed */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-6 pointer-events-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Fluid Particles
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Control particles with your hand gestures
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {isActive && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
                  <span className="text-sm text-accent">Hand Tracking Active</span>
                </div>
              )}
              
              <Button
                variant="outline"
                size="icon"
                className="border-border/50 hover:bg-muted"
                onClick={() => setShowControls(!showControls)}
              >
                {showControls ? <X className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Controls Panel */}
        {showControls && (
          <div className="absolute top-24 right-6 w-72 p-5 rounded-xl bg-card/90 backdrop-blur-xl border border-border/50 shadow-glow pointer-events-auto">
            <h3 className="text-sm font-semibold text-foreground mb-4">Simulation Settings</h3>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Particle Count: {particleCount}
                </label>
                <Slider
                  value={[particleCount]}
                  onValueChange={(v) => setParticleCount(v[0])}
                  min={100}
                  max={1000}
                  step={50}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Interaction Radius: {interactionRadius}px
                </label>
                <Slider
                  value={[interactionRadius]}
                  onValueChange={(v) => setInteractionRadius(v[0])}
                  min={50}
                  max={300}
                  step={10}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Interaction Strength: {interactionStrength.toFixed(2)}
                </label>
                <Slider
                  value={[interactionStrength * 100]}
                  onValueChange={(v) => setInteractionStrength(v[0] / 100)}
                  min={10}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border/50">
              Changes apply on restart or reset
            </p>
          </div>
        )}

        {/* Center start prompt */}
        {!isSimulating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-6 pointer-events-auto">
              <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center animate-pulse-glow">
                <Hand className="w-12 h-12 text-primary" />
              </div>
              
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Hand Gesture Control
                </h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Open your hand to repel particles, close it to attract them
                </p>
              </div>

              <Button
                size="lg"
                onClick={handleStart}
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Simulation
                  </>
                )}
              </Button>

              {error && (
                <p className="text-destructive text-sm">{error}</p>
              )}
            </div>
          </div>
        )}

        {/* Bottom controls */}
        {isSimulating && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              className="border-border/50 hover:bg-muted"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            
            <Button
              variant="destructive"
              onClick={handleStop}
              className="px-6"
            >
              <Pause className="w-4 h-4 mr-2" />
              Stop
            </Button>
          </div>
        )}

        {/* Instructions */}
        {isSimulating && (
          <div className="absolute bottom-6 left-6 max-w-xs pointer-events-auto">
            <div className="p-4 rounded-lg bg-card/80 backdrop-blur-md border border-border/50">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Hand className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-accent font-medium">Open palm</span> → repels particles
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-secondary font-medium">Closed fist</span> → attracts particles
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
