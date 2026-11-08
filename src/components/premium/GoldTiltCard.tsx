import { useRef, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** GPU-friendly perspective tilt. No device sensors, tracking, or WebGL required. */
export default function GoldTiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = ref.current;
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2));
    target.style.setProperty("--rk-tilt-x", `${(-y * 5).toFixed(2)}deg`);
    target.style.setProperty("--rk-tilt-y", `${(x * 5).toFixed(2)}deg`);
    target.style.setProperty("--rk-glint-x", `${((x + 1) * 50).toFixed(1)}%`);
    target.style.setProperty("--rk-glint-y", `${((y + 1) * 50).toFixed(1)}%`);
  };

  const reset = () => {
    const target = ref.current;
    if (!target) return;
    target.style.setProperty("--rk-tilt-x", "0deg");
    target.style.setProperty("--rk-tilt-y", "0deg");
  };

  return (
    <div ref={ref} className={cn("rk-gold-tilt-card", className)} onPointerMove={move} onPointerLeave={reset}>
      {children}
    </div>
  );
}
