import { RESKONNECT_BRAND } from "@/constants/brand";

const Preloader = () => {
  return (
    <div className="fixed inset-0 bg-[#071326] flex flex-col items-center justify-center z-[9999] overflow-hidden">
      {/* Background soft radial glow */}
      <div className="absolute w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] animate-pulse pointer-events-none" />

      <div className="relative flex flex-col items-center gap-6 z-10">
        {/* Glow effect box */}
        <div className="relative p-6 rounded-full bg-white/5 border border-white/10 shadow-[0_0_50px_rgba(245,179,47,0.1)] animate-premium-pulse">
          <img
            src={RESKONNECT_BRAND.iconOnly}
            alt="ResKonnect"
            className="h-24 w-24 object-contain animate-premium-scale"
          />
        </div>

        {/* Wording under preloader logo */}
        <div className="text-center space-y-1 select-none animate-fade-in-up">
          <h2 className="text-white font-bold tracking-[0.25em] text-lg">
            {RESKONNECT_BRAND.name.toUpperCase()}
          </h2>
          <p className="text-[#F5B32F] text-[10px] font-semibold tracking-[0.15em]">
            {RESKONNECT_BRAND.descriptor}
          </p>
        </div>
      </div>

      {/* Embedded Tailwind CSS styles for the premium loader animations */}
      <style>{`
        @keyframes premiumPulse {
          0%, 100% {
            box-shadow: 0 0 40px rgba(245, 179, 47, 0.05), 0 0 80px rgba(37, 99, 235, 0.05);
            border-color: rgba(255, 255, 255, 0.05);
          }
          50% {
            box-shadow: 0 0 60px rgba(245, 179, 47, 0.15), 0 0 100px rgba(37, 99, 235, 0.15);
            border-color: rgba(245, 179, 47, 0.2);
          }
        }
        @keyframes premiumScale {
          0%, 100% {
            transform: scale(0.96);
            opacity: 0.9;
          }
          50% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-premium-pulse {
          animation: premiumPulse 3s infinite ease-in-out;
        }
        .animate-premium-scale {
          animation: premiumScale 3s infinite ease-in-out;
        }
        .animate-fade-in-up {
          animation: fadeInUp 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Preloader;
