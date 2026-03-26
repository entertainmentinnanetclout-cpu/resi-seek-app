import { useState, useMemo, useCallback } from "react";

export interface ResidenceFilters {
  searchQuery: string;
  campus: string;
  priceMin: number;
  priceMax: number;
  distanceMax: number;
  roomTypes: string[];
  sectionCategory: string;
  nsfasOnly: boolean;
  availability: "all" | "available" | "few_spots";
  amenities: string[];
  sortBy: string;
}

const DEFAULT_FILTERS: ResidenceFilters = {
  searchQuery: "",
  campus: "all",
  priceMin: 0,
  priceMax: 10000,
  distanceMax: 20,
  roomTypes: [],
  sectionCategory: "all",
  nsfasOnly: false,
  availability: "all",
  amenities: [],
  sortBy: "match",
};

export function calculateMatchScore(
  residence: any,
  filters: ResidenceFilters
): number {
  let score = 0;
  let maxScore = 0;

  // Campus match: +30
  if (filters.campus !== "all") {
    maxScore += 30;
    if (residence.campus === filters.campus) score += 30;
  }

  // Price within budget: +25
  if (filters.priceMax < 10000 || filters.priceMin > 0) {
    maxScore += 25;
    const price = Number(residence.price) || 0;
    if (price >= filters.priceMin && price <= filters.priceMax) score += 25;
    else if (price < filters.priceMin + 500 || price > filters.priceMax - 500)
      score += 10;
  }

  // Room type match: +20
  if (filters.roomTypes.length > 0) {
    maxScore += 20;
    const resRoomTypes = (residence.room_types || [residence.room_type]).filter(
      Boolean
    );
    const hasMatch = filters.roomTypes.some((rt) =>
      resRoomTypes.some(
        (rrt: string) =>
          rrt.toLowerCase().includes(rt.toLowerCase()) ||
          rt.toLowerCase().includes(rrt.toLowerCase())
      )
    );
    if (hasMatch) score += 20;
  }

  // Distance within range: +15
  if (filters.distanceMax < 20) {
    maxScore += 15;
    const dist = Number(residence.distance_from_campus) || 0;
    if (dist <= filters.distanceMax) score += 15;
    else if (dist <= filters.distanceMax + 2) score += 5;
  }

  // Amenities: +10
  if (filters.amenities.length > 0) {
    maxScore += 10;
    const resAmenities = residence.amenities || [];
    const matchCount = filters.amenities.filter((a) =>
      resAmenities.some(
        (ra: string) => ra.toLowerCase() === a.toLowerCase()
      )
    ).length;
    score += Math.round((matchCount / filters.amenities.length) * 10);
  }

  if (maxScore === 0) return 0;
  return Math.round((score / maxScore) * 100);
}

export function useResidenceFilters(residences: any[]) {
  const [filters, setFilters] = useState<ResidenceFilters>(DEFAULT_FILTERS);

  const updateFilter = useCallback(
    <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery) count++;
    if (filters.campus !== "all") count++;
    if (filters.priceMin > 0 || filters.priceMax < 10000) count++;
    if (filters.distanceMax < 20) count++;
    if (filters.roomTypes.length > 0) count++;
    if (filters.sectionCategory !== "all") count++;
    if (filters.nsfasOnly) count++;
    if (filters.availability !== "all") count++;
    if (filters.amenities.length > 0) count++;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  const filteredResidences = useMemo(() => {
    let filtered = [...residences];

    // Search
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.address?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)
      );
    }

    // Campus
    if (filters.campus !== "all") {
      filtered = filtered.filter((r) => r.campus === filters.campus);
    }

    // Price
    filtered = filtered.filter((r) => {
      const price = Number(r.price) || 0;
      return price >= filters.priceMin && price <= filters.priceMax;
    });

    // Distance
    if (filters.distanceMax < 20) {
      filtered = filtered.filter(
        (r) => (Number(r.distance_from_campus) || 0) <= filters.distanceMax
      );
    }

    // Room types
    if (filters.roomTypes.length > 0) {
      filtered = filtered.filter((r) => {
        const resRoomTypes = (r.room_types || [r.room_type]).filter(Boolean);
        return filters.roomTypes.some((rt) =>
          resRoomTypes.some(
            (rrt: string) =>
              rrt.toLowerCase().includes(rt.toLowerCase()) ||
              rt.toLowerCase().includes(rrt.toLowerCase())
          )
        );
      });
    }

    // Section category
    if (filters.sectionCategory !== "all") {
      filtered = filtered.filter(
        (r) =>
          r.section_category === filters.sectionCategory
      );
    }

    // NSFAS
    if (filters.nsfasOnly) {
      filtered = filtered.filter((r) => r.is_trusted === true);
    }

    // Availability
    if (filters.availability === "available") {
      filtered = filtered.filter((r) => (r.available_spots || 0) > 0);
    } else if (filters.availability === "few_spots") {
      filtered = filtered.filter(
        (r) => (r.available_spots || 0) > 0 && (r.available_spots || 0) <= 5
      );
    }

    // Amenities
    if (filters.amenities.length > 0) {
      filtered = filtered.filter((r) =>
        filters.amenities.every((a) =>
          r.amenities?.some(
            (ra: string) => ra.toLowerCase() === a.toLowerCase()
          )
        )
      );
    }

    // Sort
    const withScores = filtered.map((r) => ({
      ...r,
      _matchScore: calculateMatchScore(r, filters),
    }));

    switch (filters.sortBy) {
      case "price-asc":
        withScores.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        break;
      case "price-desc":
        withScores.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
        break;
      case "distance":
        withScores.sort(
          (a, b) =>
            (Number(a.distance_from_campus) || 999) -
            (Number(b.distance_from_campus) || 999)
        );
        break;
      case "availability":
        withScores.sort(
          (a, b) => (b.available_spots || 0) - (a.available_spots || 0)
        );
        break;
      case "match":
      default:
        withScores.sort((a, b) => b._matchScore - a._matchScore);
        break;
    }

    return withScores;
  }, [residences, filters]);

  return {
    filters,
    updateFilter,
    resetFilters,
    filteredResidences,
    activeFilterCount,
    hasActiveFilters,
  };
}
