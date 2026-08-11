import { BRAND } from "@/constants/brand";

const Preloader = () => {
  return (
    <div className="fixed inset-0 bg-brand-navy flex flex-col items-center justify-center gap-4 z-[9999]">
      <div className="animate-pulse">
        <img src={BRAND.logos.icon} alt={BRAND.name} className="h-28 w-28 object-contain" />
      </div>
      <p className="text-[10px] tracking-[0.35em] text-white/70">{BRAND.descriptor}</p>
    </div>
  );
};

export default Preloader;
