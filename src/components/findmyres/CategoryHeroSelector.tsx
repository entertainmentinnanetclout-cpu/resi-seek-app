import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Building2, Users, GraduationCap, Home } from "lucide-react";

const CATEGORIES = [
  { key: "flats", label: "Flats", desc: "Studios, bachelors & apartments", icon: Building2, color: "from-blue-500/20 to-blue-500/5" },
  { key: "communes", label: "Communes", desc: "Shared houses with vibe", icon: Users, color: "from-purple-500/20 to-purple-500/5" },
  { key: "student_residences", label: "Student Residences", desc: "NSFAS & TUT accredited", icon: GraduationCap, color: "from-green-500/20 to-green-500/5" },
  { key: "private_rentals", label: "Private Rentals", desc: "Family & professional homes", icon: Home, color: "from-amber-500/20 to-amber-500/5" },
];

export function CategoryHeroSelector() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Find Your Next Home</h2>
        <p className="text-muted-foreground">Pick a category and we'll show you everything available.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {CATEGORIES.map(({ key, label, desc, icon: Icon, color }) => (
          <Link key={key} to={`/find?category=${key}`} className="group">
            <Card className={`relative overflow-hidden h-32 sm:h-40 bg-gradient-to-br ${color} border-border/50 hover:border-primary/40 hover:shadow-lg transition-all`}>
              <div className="absolute inset-0 p-4 flex flex-col justify-between">
                <Icon className="w-7 h-7 sm:w-9 sm:h-9 text-primary" />
                <div>
                  <div className="font-bold text-base sm:text-lg group-hover:text-primary transition-colors">{label}</div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2">{desc}</div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
