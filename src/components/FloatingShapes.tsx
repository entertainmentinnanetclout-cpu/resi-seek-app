import { useEffect, useRef } from 'react';

interface FloatingShapesProps {
  className?: string;
}

const FloatingShapes = ({ className = '' }: FloatingShapesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { width, height, left, top } = container.getBoundingClientRect();
      const x = (clientX - left - width / 2) / width;
      const y = (clientY - top - height / 2) / height;

      const shapes = container.querySelectorAll('.floating-shape');
      shapes.forEach((shape, index) => {
        const depth = (index + 1) * 0.5;
        const moveX = x * 20 * depth;
        const moveY = y * 20 * depth;
        (shape as HTMLElement).style.transform = `translate(${moveX}px, ${moveY}px)`;
      });
    };

    container.addEventListener('mousemove', handleMouseMove);
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div ref={containerRef} className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {/* Geometric Cubes */}
      <div className="floating-shape absolute top-[10%] left-[5%] w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg animate-float rotate-12 backdrop-blur-sm border border-primary/10" />
      <div className="floating-shape absolute top-[20%] right-[10%] w-12 h-12 bg-gradient-to-br from-secondary/20 to-primary/20 rounded-lg animate-float-delayed rotate-45 backdrop-blur-sm border border-secondary/10" />
      <div className="floating-shape absolute bottom-[30%] left-[15%] w-20 h-20 bg-gradient-to-br from-accent/15 to-secondary/15 rounded-xl animate-float-slow -rotate-12 backdrop-blur-sm border border-accent/10" />
      
      {/* Spheres */}
      <div className="floating-shape absolute top-[40%] right-[5%] w-24 h-24 rounded-full bg-gradient-radial from-primary/30 via-primary/10 to-transparent animate-pulse-glow" />
      <div className="floating-shape absolute bottom-[20%] right-[20%] w-16 h-16 rounded-full bg-gradient-radial from-accent/25 via-accent/5 to-transparent animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
      <div className="floating-shape absolute top-[60%] left-[8%] w-14 h-14 rounded-full bg-gradient-radial from-secondary/20 via-secondary/5 to-transparent animate-pulse-glow" style={{ animationDelay: '0.8s' }} />

      {/* Orbiting dots */}
      <div className="absolute top-[25%] left-[25%] w-2 h-2 bg-primary/60 rounded-full animate-orbit" />
      <div className="absolute top-[50%] right-[30%] w-3 h-3 bg-accent/50 rounded-full animate-orbit" style={{ animationDelay: '-5s', animationDuration: '12s' }} />
      <div className="absolute bottom-[40%] left-[40%] w-2 h-2 bg-secondary/40 rounded-full animate-orbit" style={{ animationDelay: '-10s', animationDuration: '18s' }} />

      {/* Gradient lines */}
      <div className="floating-shape absolute top-[15%] left-[30%] w-32 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent rotate-45 animate-float" />
      <div className="floating-shape absolute bottom-[25%] right-[25%] w-40 h-0.5 bg-gradient-to-r from-transparent via-accent/20 to-transparent -rotate-12 animate-float-delayed" />
    </div>
  );
};

export default FloatingShapes;
