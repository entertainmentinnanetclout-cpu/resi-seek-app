import { BRAND } from "@/constants/brand";

/**
 * Premium full-screen ResKonnect loading experience.
 * Pure CSS, reduced-motion safe (see .rk-* utilities in index.css).
 */
const Preloader = () => {
  return (
    <div
      role="status"
      aria-label="Loading ResKonnect"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 overflow-hidden bg-brand-navy"
      style={{ background: "var(--gradient-command)" }}
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="rk-loader-glow absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-blue/20 blur-[100px]" />
        <div className="rk-loader-glow absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gold/15 blur-[80px]" />
      </div>

      {/* icon-only transparent mark on a soft navy plate — no drop-shadow halo */}
      <div className="rk-loader-mark relative grid h-24 w-24 place-items-center rounded-3xl bg-white/[0.04] ring-1 ring-white/10 sm:h-28 sm:w-28">
        <img
          src={BRAND.logos.icon}
          alt={BRAND.name}
          className="h-14 w-14 object-contain sm:h-16 sm:w-16"
        />
      </div>

      <div className="relative flex flex-col items-center gap-3">
        <p className="text-[10px] tracking-[0.38em] text-white/70">{BRAND.descriptor}</p>
        <div className="h-[2px] w-40 overflow-hidden rounded-full bg-white/10">
          <div className="rk-loader-line h-full w-1/3 rounded-full bg-gradient-to-r from-brand-blue via-brand-gold to-brand-blue" />
        </div>
        <p className="text-xs text-white/60">Preparing your ResKonnect path...</p>
      </div>
    </div>
  );
};

export default Preloader;
