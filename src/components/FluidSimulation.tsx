import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useParticleSystem } from '@/hooks/useParticleSystem';
import { useHandTracking, HandData } from '@/hooks/useHandTracking';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Hand, Camera, MousePointer, RotateCcw, Settings, X } from 'lucide-react';

export function FluidSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [showControls, setShowControls] = useState(false);
  const [particleCount] = useState(400);
  const [interactionRadius, setInteractionRadius] = useState(150);
  const [interactionStrength, setInteractionStrength] = useState(0.5);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [useHandControl, setUseHandControl] = useState(false);

  const { start, stop, setHandPosition, reinitialize } = useParticleSystem(
    canvasRef,
    particleCount,
    interactionRadius,
    interactionStrength
  );

  const handleHandUpdate = useCallback((hand: HandData | null) => {
    if (hand && canvasRef.current && videoRef.current) {
      const scaleX = canvasRef.current.width / videoRef.current.videoWidth;
      const scaleY = canvasRef.current.height / videoRef.current.videoHeight;
      
      setHandPosition({
        x: hand.x * scaleX,
        y: hand.y * scaleY,
        isOpen: hand.isOpen,
      });
    } else if (useHandControl) {
      setHandPosition(null);
    }
  }, [setHandPosition, useHandControl]);

  const { initialize: initHandTracking, stop: stopHandTracking, isLoading: handLoading, error: handError, isActive: handActive } = useHandTracking(
    videoRef,
    handleHandUpdate
  );

  // Mouse/touch controls
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!useHandControl) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setHandPosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          isOpen: !isMouseDown, // Click to attract, release to repel
        });
      }
    }
  }, [useHandControl, isMouseDown, setHandPosition]);

  const handleMouseLeave = useCallback(() => {
    if (!useHandControl) {
      setHandPosition(null);
    }
  }, [useHandControl, setHandPosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!useHandControl && e.touches.length > 0) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setHandPosition({
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
          isOpen: false, // Touch always attracts
        });
      }
    }
  }, [useHandControl, setHandPosition]);

  // Handle canvas resize and start simulation immediately
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      reinitialize();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    // Start simulation immediately
    start();

    return () => {
      window.removeEventListener('resize', handleResize);
      stop();
    };
  }, []);

  const toggleHandControl = async () => {
    if (useHandControl) {
      stopHandTracking();
      setUseHandControl(false);
    } else {
      setUseHandControl(true);
      await initHandTracking();
    }
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
        className="absolute inset-0 w-full h-full cursor-none"
        onMouseMove={handleMouseMove}
        onMouseDown={() => setIsMouseDown(true)}
        onMouseUp={() => setIsMouseDown(false)}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setHandPosition(null)}
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
                {useHandControl ? 'Control with hand gestures' : 'Move mouse to interact • Click to attract'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Control mode indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
                {useHandControl ? (
                  <>
                    {handActive ? (
                      <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
                    ) : handLoading ? (
                      <div className="w-3 h-3 border-2 border-muted-foreground/30 border-t-accent rounded-full animate-spin" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {handActive ? 'Hand Active' : handLoading ? 'Loading...' : 'Hand Mode'}
                    </span>
                  </>
                ) : (
                  <>
                    <MousePointer className="w-3 h-3 text-primary" />
                    <span className="text-sm text-muted-foreground">Mouse Mode</span>
                  </>
                )}
              </div>
              
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
            <h3 className="text-sm font-semibold text-foreground mb-4">Settings</h3>
            
            <div className="space-y-5">
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

              <div className="pt-2 border-t border-border/50">
                <Button
                  variant={useHandControl ? "secondary" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={toggleHandControl}
                  disabled={handLoading}
                >
                  {handLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin mr-2" />
                      Loading Camera...
                    </>
                  ) : useHandControl ? (
                    <>
                      <MousePointer className="w-4 h-4 mr-2" />
                      Switch to Mouse
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mr-2" />
                      Enable Hand Tracking
                    </>
                  )}
                </Button>
                {handError && (
                  <p className="text-xs text-destructive mt-2">{handError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={reinitialize}
            className="border-border/50 hover:bg-muted"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-6 left-6 max-w-xs pointer-events-auto">
          <div className="p-4 rounded-lg bg-card/80 backdrop-blur-md border border-border/50">
            {useHandControl ? (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Hand className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-accent font-medium">Open palm</span> → repels
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-secondary font-medium">Closed fist</span> → attracts
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <MousePointer className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-primary font-medium">Move</span> → repels particles
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-secondary font-medium">Click & hold</span> → attracts
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
