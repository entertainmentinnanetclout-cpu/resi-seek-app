import { useCallback } from "react";
import { GraduationCap, School, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type AudienceKey = "university" | "tvet" | "private" | "all";

interface AudienceSelectorProps {
  audience: AudienceKey;
  onChange: (next: AudienceKey) => void;
  institutionTag?: string;
  onInstitutionChange?: (tag?: string) => void;
  compact?: boolean;
}

const OPTIONS: { key: AudienceKey; label: string; sub: string; icon: any; institutions: string[]; accent: string; iconBg: string }[] = [
  {
    key: "university",
    label: "University",
    sub: "TUT, UP, UNISA & more",
    icon: GraduationCap,
    institutions: ["TUT", "UP", "UNISA", "Wits", "UJ"],
    accent: "border-sky bg-sky/10 ring-sky/30",
    iconBg: "bg-sky text-white",
  },
  {
    key: "tvet",
    label: "TVET / College",
    sub: "Tshwane North, Tshwane South, Ekurhuleni",
    icon: School,
    institutions: [
      "Tshwane North College",
      "Tshwane South College",
      "Ekurhuleni West College",
      "Boston City Campus",
      "Damelin",
      "Rosebank College",
    ],
    accent: "border-amber bg-amber/10 ring-amber/30",
    iconBg: "bg-amber text-white",
  },
  {
    key: "private",
    label: "Private",
    sub: "Working professionals & general renters",
    icon: Home,
    institutions: [],
    accent: "border-violet bg-violet/10 ring-violet/30",
    iconBg: "bg-violet text-white",
  },
];

export function AudienceSelector({
  audience,
  onChange,
  institutionTag,
  onInstitutionChange,
  compact,
}: AudienceSelectorProps) {
  const toggle = useCallback(
    (key: AudienceKey) => {
      // Click again = close/deselect
      if (audience === key) {
        onChange("all");
        onInstitutionChange?.(undefined);
      } else {
        onChange(key);
        onInstitutionChange?.(undefined);
      }
    },
    [audience, onChange, onInstitutionChange],
  );

  const active = OPTIONS.find((o) => o.key === audience);

  return (
    <div className="w-full">
      <div
        className={cn(
          "grid gap-3",
          compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3",
        )}
      >
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = audience === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              aria-pressed={isActive}
              aria-expanded={isActive}
              onClick={() => toggle(opt.key)}
              className={cn(
                "group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all",
                "hover:shadow-lg",
                isActive
                  ? cn("shadow-md ring-2", opt.accent)
                  : "border-border bg-card",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive ? opt.iconBg : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-semibold", compact ? "text-sm" : "text-base")}>
                      {opt.label}
                    </span>
                    {isActive && (
                      <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                        Active
                      </Badge>
                    )}
                  </div>
                  {!compact && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {opt.sub}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {isActive ? "Press to close" : "Press to open"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Institution chip row (collapses via conditional render) */}
      {active && active.institutions.length > 0 && (
        <div className="mt-4 rounded-xl border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Filter by {active.label} institution
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onInstitutionChange?.(undefined)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                !institutionTag
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              All {active.label}
            </button>
            {active.institutions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  onInstitutionChange?.(institutionTag === tag ? undefined : tag)
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  institutionTag === tag
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}