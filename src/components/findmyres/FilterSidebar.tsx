import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCampusOptions } from "@/constants/institutionOptions";
import type { ResidenceFilters } from "@/hooks/useResidenceFilters";
import type { ResidenceSection } from "@/hooks/useResidenceSections";

const ROOM_TYPES = ["Single", "Sharing", "Bachelor", "Studio"];
const AMENITIES = ["WiFi", "Parking", "Security", "Study Room", "Laundry", "Gym", "Pool", "Kitchen"];

interface FilterSidebarProps {
  filters: ResidenceFilters;
  updateFilter: <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  sections: ResidenceSection[];
}

export function FilterSidebar({ filters, updateFilter, resetFilters, activeFilterCount, sections }: FilterSidebarProps) {
  // Campus options always follow the selected audience/institution type.
  const campusOptions = getCampusOptions(
    filters.institutionType ??
      (filters.audience === "tvet"
        ? "tvet"
        : filters.audience === "university"
          ? "university"
          : filters.audience === "private"
            ? "other"
            : undefined),
  );

  const toggleArrayItem = (key: "roomTypes" | "amenities", item: string) => {
    const current = filters[key];
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    updateFilter(key, updated);
  };

  return (
    <div className="w-full lg:w-72 flex-shrink-0">
      <div className="sticky top-20 bg-card border rounded-xl p-4 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Filters</h3>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs h-7 gap-1">
              <X className="w-3 h-3" /> Clear all ({activeFilterCount})
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[calc(100vh-180px)]">
          <div className="space-y-5 pr-2">
            {/* Campus */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                {filters.audience === "private" ? "Area" : "Campus"}
              </Label>
              <div className="space-y-1.5">
                {campusOptions.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={filters.campus === c.value}
                      onCheckedChange={(checked) =>
                        updateFilter("campus", checked ? c.value : "all")
                      }
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Distance */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Distance: up to {filters.distanceMax}km
              </Label>
              <Slider
                min={0}
                max={20}
                step={1}
                value={[filters.distanceMax]}
                onValueChange={([val]) => updateFilter("distanceMax", val)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0km</span>
                <span>20km</span>
              </div>
            </div>

            <Separator />

            {/* Price Range */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Price: R{filters.priceMin.toLocaleString()} – R{filters.priceMax.toLocaleString()}
              </Label>
              <Slider
                min={0}
                max={10000}
                step={250}
                value={[filters.priceMax]}
                onValueChange={([val]) => updateFilter("priceMax", val)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>R0</span>
                <span>R10,000</span>
              </div>
            </div>

            <Separator />

            {/* Section Category */}
            {sections.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Category</Label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={filters.sectionCategory === "all"}
                        onCheckedChange={() => updateFilter("sectionCategory", "all")}
                      />
                      All
                    </label>
                    {sections.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={filters.sectionCategory === s.slug}
                          onCheckedChange={(checked) =>
                            updateFilter("sectionCategory", checked ? s.slug : "all")
                          }
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Room Type */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Room Type</Label>
              <div className="space-y-1.5">
                {ROOM_TYPES.map((rt) => (
                  <label key={rt} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={filters.roomTypes.includes(rt.toLowerCase())}
                      onCheckedChange={() => toggleArrayItem("roomTypes", rt.toLowerCase())}
                    />
                    {rt}
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Availability */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Availability</Label>
              <RadioGroup
                value={filters.availability}
                onValueChange={(v) => updateFilter("availability", v as ResidenceFilters["availability"])}
                className="space-y-1.5"
              >
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="all" /> All
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="available" /> Available Only
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="few_spots" /> Few Spots Left
                </label>
              </RadioGroup>
            </div>

            <Separator />

            {/* Amenities */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Amenities</Label>
              <div className="space-y-1.5">
                {AMENITIES.map((a) => (
                  <label key={a} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={filters.amenities.includes(a)}
                      onCheckedChange={() => toggleArrayItem("amenities", a)}
                    />
                    {a}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
