import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { FilterSidebar } from "./FilterSidebar";
import type { ResidenceFilters } from "@/hooks/useResidenceFilters";
import type { ResidenceSection } from "@/hooks/useResidenceSections";

interface FilterBottomSheetProps {
  filters: ResidenceFilters;
  updateFilter: <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  sections: ResidenceSection[];
  resultCount: number;
}

export function FilterBottomSheet({
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  sections,
  resultCount,
}: FilterBottomSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="lg:hidden fixed bottom-20 right-4 z-40 rounded-full shadow-lg gap-2 h-14 px-5"
        >
          <SlidersHorizontal className="w-5 h-5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl pt-4">
        <SheetHeader className="pb-2">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Refine your search to find the perfect residence</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto h-[calc(100%-120px)]">
          <FilterSidebar
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            activeFilterCount={activeFilterCount}
            sections={sections}
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button className="w-full h-12 text-base">
            Show {resultCount} Results
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
