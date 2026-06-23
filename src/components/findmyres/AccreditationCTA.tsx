import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Award, ArrowRight } from "lucide-react";

export function AccreditationCTA() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6 sm:p-10 text-primary-foreground">
        <div className="absolute -right-10 -bottom-10 opacity-10">
          <Award className="w-56 h-56" />
        </div>
        <div className="relative max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full backdrop-blur">
            <Award className="w-3.5 h-3.5" /> Landlords & Property Owners
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold leading-tight">
            Become TUT Accredited 2026 – 2031
          </h3>
          <p className="text-sm sm:text-base opacity-90">
            List your property on ResKonnect, reach thousands of verified TUT students, and unlock NSFAS-backed bookings.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild size="lg" variant="secondary">
              <Link to="/?accreditation=true#landlord">Start Accreditation <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-transparent border-white/30 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
              <Link to="/?learn=accreditation#landlord">Learn More</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
