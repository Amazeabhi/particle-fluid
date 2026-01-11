import { useRef, useCallback, useEffect } from 'react';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface HandPosition {
  x: number;
  y: number;
  isOpen: boolean;
}

const PARTICLE_COLORS = [
  'hsl(185, 100%, 55%)',  // cyan
  'hsl(210, 100%, 60%)',  // blue
  'hsl(270, 80%, 65%)',   // purple
  'hsl(195, 100%, 50%)',  // light blue
  'hsl(240, 80%, 60%)',   // indigo
];

export function useParticleSystem(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  particleCount: number = 500,
  interactionRadius: number = 150,
  interactionStrength: number = 0.5
) {
  const particlesRef = useRef<Particle[]>([]);
  const handPositionRef = useRef<HandPosition | null>(null);
  const animationFrameRef = useRef<number>(0);

  const initParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: Math.random() * 3 + 1,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        alpha: Math.random() * 0.5 + 0.5,
        life: Math.random() * 100,
        maxLife: 100 + Math.random() * 100,
      });
    }
    particlesRef.current = particles;
  }, [particleCount]);

  const updateParticles = useCallback((width: number, height: number) => {
    const particles = particlesRef.current;
    const hand = handPositionRef.current;

    particles.forEach((particle) => {
      // Apply hand interaction
      if (hand) {
        const dx = particle.x - hand.x;
        const dy = particle.y - hand.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < interactionRadius && distance > 0) {
          const force = (interactionRadius - distance) / interactionRadius;
          const angle = Math.atan2(dy, dx);
          
          // Attract when hand is closed, repel when open
          const direction = hand.isOpen ? 1 : -1;
          
          particle.vx += Math.cos(angle) * force * interactionStrength * direction;
          particle.vy += Math.sin(angle) * force * interactionStrength * direction;
        }
      }

      // Apply fluid dynamics (simplified SPH-like behavior)
      particles.forEach((other) => {
        if (particle === other) return;
        
        const dx = other.x - particle.x;
        const dy = other.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Separation force
        if (distance < 20 && distance > 0) {
          const force = (20 - distance) / 20 * 0.05;
          particle.vx -= (dx / distance) * force;
          particle.vy -= (dy / distance) * force;
        }
      });

      // Apply velocity damping
      particle.vx *= 0.98;
      particle.vy *= 0.98;

      // Apply gravity (subtle)
      particle.vy += 0.02;

      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Boundary collision with soft bounce
      if (particle.x < 0) {
        particle.x = 0;
        particle.vx *= -0.5;
      }
      if (particle.x > width) {
        particle.x = width;
        particle.vx *= -0.5;
      }
      if (particle.y < 0) {
        particle.y = 0;
        particle.vy *= -0.5;
      }
      if (particle.y > height) {
        particle.y = height;
        particle.vy *= -0.5;
      }

      // Update life
      particle.life += 1;
      if (particle.life > particle.maxLife) {
        particle.life = 0;
        particle.alpha = Math.random() * 0.5 + 0.5;
      }
    });
  }, [interactionRadius, interactionStrength]);

  const renderParticles = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Clear with trail effect
    ctx.fillStyle = 'rgba(8, 12, 18, 0.15)';
    ctx.fillRect(0, 0, width, height);

    const particles = particlesRef.current;
    const hand = handPositionRef.current;

    // Draw connections between nearby particles
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.1)';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 50) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[j].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.globalAlpha = (50 - distance) / 50 * 0.3;
          ctx.stroke();
        }
      }
    }

    // Draw particles
    particles.forEach((particle) => {
      const lifeRatio = Math.sin((particle.life / particle.maxLife) * Math.PI);
      
      // Glow effect
      const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.radius * 3
      );
      gradient.addColorStop(0, particle.color.replace(')', `, ${particle.alpha * lifeRatio})`).replace('hsl', 'hsla'));
      gradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * 3, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 1;
      ctx.fill();

      // Core particle
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = particle.alpha * lifeRatio;
      ctx.fill();
    });

    // Draw hand indicator
    if (hand) {
      const gradient = ctx.createRadialGradient(
        hand.x, hand.y, 0,
        hand.x, hand.y, interactionRadius
      );
      gradient.addColorStop(0, hand.isOpen ? 'rgba(0, 255, 200, 0.3)' : 'rgba(255, 100, 200, 0.3)');
      gradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(hand.x, hand.y, interactionRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.5;
      ctx.fill();

      // Hand center dot
      ctx.beginPath();
      ctx.arc(hand.x, hand.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = hand.isOpen ? 'hsl(175, 100%, 50%)' : 'hsl(320, 80%, 60%)';
      ctx.globalAlpha = 1;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }, [interactionRadius]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    updateParticles(width, height);
    renderParticles(ctx, width, height);

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [canvasRef, updateParticles, renderParticles]);

  const setHandPosition = useCallback((position: HandPosition | null) => {
    handPositionRef.current = position;
  }, []);

  const start = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    initParticles(canvas.width, canvas.height);
    animate();
  }, [canvasRef, initParticles, animate]);

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    start,
    stop,
    setHandPosition,
    reinitialize: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        initParticles(canvas.width, canvas.height);
      }
    },
  };
}
