import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ResidenceFilters } from "@/hooks/useResidenceFilters";

interface ActiveFilterChipsProps {
  filters: ResidenceFilters;
  updateFilter: <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
}

export function ActiveFilterChips({ filters, updateFilter, resetFilters, hasActiveFilters }: ActiveFilterChipsProps) {
  if (!hasActiveFilters) return null;

  const chips: { label: string; onRemove: () => void }[] = [];

  if (filters.campus !== "all") {
    chips.push({ label: `Campus: ${filters.campus}`, onRemove: () => updateFilter("campus", "all") });
  }
  if (filters.priceMax < 10000) {
    chips.push({ label: `Max R${filters.priceMax.toLocaleString()}`, onRemove: () => updateFilter("priceMax", 10000) });
  }
  if (filters.distanceMax < 20) {
    chips.push({ label: `Within ${filters.distanceMax}km`, onRemove: () => updateFilter("distanceMax", 20) });
  }
  if (filters.sectionCategory !== "all") {
    chips.push({ label: `${filters.sectionCategory}`, onRemove: () => updateFilter("sectionCategory", "all") });
  }
  filters.roomTypes.forEach((rt) => {
    chips.push({
      label: `${rt}`,
      onRemove: () => updateFilter("roomTypes", filters.roomTypes.filter((r) => r !== rt)),
    });
  });
  if (filters.nsfasOnly) {
    chips.push({ label: "NSFAS Accredited", onRemove: () => updateFilter("nsfasOnly", false) });
  }
  if (filters.availability !== "all") {
    chips.push({
      label: filters.availability === "available" ? "Available Only" : "Few Spots",
      onRemove: () => updateFilter("availability", "all"),
    });
  }
  filters.amenities.forEach((a) => {
    chips.push({
      label: a,
      onRemove: () => updateFilter("amenities", filters.amenities.filter((x) => x !== a)),
    });
  });

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {chips.map((chip, i) => (
        <Badge key={i} variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1 cursor-pointer hover:bg-destructive/10" onClick={chip.onRemove}>
          {chip.label}
          <X className="w-3 h-3" />
        </Badge>
      ))}
      <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground underline">
        Clear all
      </button>
    </div>
  );
}
