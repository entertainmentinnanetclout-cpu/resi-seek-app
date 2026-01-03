import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Calendar, GraduationCap, ExternalLink, Filter, Clock, Banknote, Loader2, Share2, SlidersHorizontal, X } from "lucide-react";

interface Bursary {
  id: string;
  name: string;
  provider: string;
  amount: string | null;
  deadline: string | null;
  fields_of_study: string[] | null;
  requirements: string[] | null;
  link: string | null;
  type: string;
  description: string | null;
  is_active: boolean;
  image_url: string | null;
}

const BursaryFinder = () => {
  const navigate = useNavigate();
  const [bursaries, setBursaries] = useState<Bursary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fieldFilter, setFieldFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    fetchBursaries();
    
    const channel = supabase
      .channel('bursaries-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bursaries' }, () => fetchBursaries())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBursaries = async () => {
    setIsLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("bursaries")
      .select("*")
      .eq("is_active", true)
      .order("deadline", { ascending: true });

    if (error) {
      console.error("Fetch error:", error);
      setFetchError(error.message);
      toast.error("Failed to load bursaries");
    } else {
      setBursaries(data || []);
    }
    setIsLoading(false);
  };

  const fields = [...new Set(bursaries.flatMap(b => b.fields_of_study || []))].sort();

  const getDaysUntilDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredBursaries = bursaries.filter(bursary => {
    const matchesSearch = 
      bursary.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bursary.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bursary.fields_of_study?.some(f => f.toLowerCase().includes(searchQuery.toLowerCase())) ?? false);
    
    const matchesType = typeFilter === "all" || bursary.type === typeFilter;
    const matchesField = fieldFilter === "all" || (bursary.fields_of_study?.some(f => f.toLowerCase().includes(fieldFilter.toLowerCase())) ?? false);
    
    // Deadline filter
    const daysUntil = getDaysUntilDeadline(bursary.deadline);
    let matchesDeadline = true;
    if (deadlineFilter === "closing-soon") {
      matchesDeadline = daysUntil !== null && daysUntil <= 30 && daysUntil > 0;
    } else if (deadlineFilter === "this-month") {
      matchesDeadline = daysUntil !== null && daysUntil <= 30 && daysUntil > 0;
    } else if (deadlineFilter === "next-3-months") {
      matchesDeadline = daysUntil !== null && daysUntil <= 90 && daysUntil > 0;
    } else if (deadlineFilter === "open") {
      matchesDeadline = daysUntil !== null && daysUntil > 0;
    }
    
    return matchesSearch && matchesType && matchesField && matchesDeadline;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case "government": return "bg-success/20 text-success border-success/30";
      case "private": return "bg-primary/20 text-primary border-primary/30";
      case "university": return "bg-secondary/20 text-secondary border-secondary/30";
      case "ngo": return "bg-warning/20 text-warning border-warning/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getGradientForType = (type: string) => {
    switch (type) {
      case "government": return "from-green-500/20 to-emerald-600/20";
      case "private": return "from-primary/20 to-blue-600/20";
      case "university": return "from-purple-500/20 to-violet-600/20";
      case "ngo": return "from-orange-500/20 to-amber-600/20";
      default: return "from-muted/20 to-muted-foreground/20";
    }
  };

  const handleShareWhatsApp = (e: React.MouseEvent, bursary: Bursary) => {
    e.stopPropagation();
    const baseUrl = window.location.origin;
    const bursaryUrl = `${baseUrl}/bursary/${bursary.id}`;
    const deadlineText = bursary.deadline 
      ? `\n📅 Deadline: ${new Date(bursary.deadline).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`
      : '';
    const amountText = bursary.amount ? `\n💰 ${bursary.amount}` : '';
    
    const message = encodeURIComponent(
      `🎓 *${bursary.name}* - Bursary Opportunity!\n\n` +
      `📚 Provider: ${bursary.provider}` +
      amountText +
      deadlineText +
      `\n\n${bursary.description || 'Apply now for this amazing opportunity!'}\n\n` +
      `👉 View full details:\n${bursaryUrl}`
    );
    
    window.open(`https://wa.me/?text=${message}`, '_blank');
    toast.success('Opening WhatsApp to share...');
  };

  const handleCardClick = (bursaryId: string) => {
    navigate(`/bursary/${bursaryId}`);
  };

  const handleApplyClick = (e: React.MouseEvent, link: string | null) => {
    e.stopPropagation();
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setFieldFilter("all");
    setDeadlineFilter("all");
    setSearchQuery("");
  };

  const activeFiltersCount = [typeFilter, fieldFilter, deadlineFilter].filter(f => f !== "all").length;

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium mb-2 block">Bursary Type</label>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="government">Government</SelectItem>
            <SelectItem value="private">Private/Corporate</SelectItem>
            <SelectItem value="university">University</SelectItem>
            <SelectItem value="ngo">NGO</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Field of Study</label>
        <Select value={fieldFilter} onValueChange={setFieldFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Fields" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fields</SelectItem>
            {fields.map(field => (
              <SelectItem key={field} value={field.toLowerCase()}>{field}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Deadline</label>
        <Select value={deadlineFilter} onValueChange={setDeadlineFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Any Deadline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Deadline</SelectItem>
            <SelectItem value="closing-soon">Closing Soon (30 days)</SelectItem>
            <SelectItem value="next-3-months">Next 3 Months</SelectItem>
            <SelectItem value="open">Still Open</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quick Filter Badges */}
      <div>
        <label className="text-sm font-medium mb-2 block">Quick Filters</label>
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant={typeFilter === "government" ? "default" : "outline"} 
            className="cursor-pointer"
            onClick={() => setTypeFilter(typeFilter === "government" ? "all" : "government")}
          >
            🏛️ Government
          </Badge>
          <Badge 
            variant={typeFilter === "private" ? "default" : "outline"} 
            className="cursor-pointer"
            onClick={() => setTypeFilter(typeFilter === "private" ? "all" : "private")}
          >
            🏢 Corporate
          </Badge>
          <Badge 
            variant={deadlineFilter === "closing-soon" ? "default" : "outline"} 
            className="cursor-pointer"
            onClick={() => setDeadlineFilter(deadlineFilter === "closing-soon" ? "all" : "closing-soon")}
          >
            ⏰ Closing Soon
          </Badge>
        </div>
      </div>

      {activeFiltersCount > 0 && (
        <Button variant="outline" className="w-full" onClick={clearFilters}>
          <X className="w-4 h-4 mr-2" />
          Clear All Filters
        </Button>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <SEO
        title="Bursary Finder | South African Student Bursaries & Funding"
        description="Find bursaries and funding opportunities for South African students. Government, private, and university bursaries available."
      />
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar - Fixed */}
        <aside className="hidden lg:block w-72 shrink-0 border-r bg-card/50 p-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="flex items-center gap-2 mb-6">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Filters</h2>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-auto">{activeFiltersCount}</Badge>
            )}
          </div>
          <FilterContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="text-center lg:text-left">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display flex items-center justify-center lg:justify-start gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
                Bursary Finder
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                Discover funding opportunities to support your education journey.
              </p>
            </div>

            {/* Search and Mobile Filter Button */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search bursaries, providers, fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              
              {/* Mobile Filter Button */}
              <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden h-11 w-11 shrink-0 relative">
                    <Filter className="w-5 h-5" />
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full max-w-xs overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <SlidersHorizontal className="w-5 h-5" />
                      Filters
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterContent />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found <span className="font-semibold text-foreground">{filteredBursaries.length}</span> bursaries
              </p>
              <Badge variant="outline" className="gap-1">
                <Calendar className="w-3 h-3" />
                2026 Applications
              </Badge>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading bursaries...</p>
              </div>
            ) : fetchError ? (
              <Card className="border-destructive">
                <CardContent className="py-8 text-center">
                  <p className="text-destructive mb-4">Failed to load bursaries: {fetchError}</p>
                  <Button onClick={fetchBursaries} variant="outline">
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Bursary Cards Grid */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredBursaries.map(bursary => {
                    const daysUntil = getDaysUntilDeadline(bursary.deadline);
                    const isUrgent = daysUntil !== null && daysUntil <= 30 && daysUntil > 0;
                    const isPast = daysUntil !== null && daysUntil < 0;

                    return (
                      <Card 
                        key={bursary.id} 
                        className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                        onClick={() => handleCardClick(bursary.id)}
                      >
                        {/* Image/Logo Header */}
                        <div className={`relative h-32 bg-gradient-to-br ${getGradientForType(bursary.type)} flex items-center justify-center overflow-hidden`}>
                          {bursary.image_url ? (
                            <img 
                              src={bursary.image_url} 
                              alt={bursary.provider}
                              className="w-20 h-20 object-contain bg-white rounded-lg p-2 shadow-md group-hover:scale-110 transition-transform"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-20 h-20 bg-white/80 rounded-lg flex items-center justify-center">
                              <GraduationCap className="w-10 h-10 text-muted-foreground" />
                            </div>
                          )}
                          <Badge className={`absolute top-2 right-2 ${getTypeColor(bursary.type)} capitalize text-xs`}>
                            {bursary.type}
                          </Badge>
                          {isUrgent && (
                            <Badge variant="destructive" className="absolute top-2 left-2 text-xs animate-pulse">
                              ⏰ {daysUntil}d left
                            </Badge>
                          )}
                        </div>

                        <CardContent className="p-4 space-y-3">
                          <div>
                            <h3 className="font-semibold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                              {bursary.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">{bursary.provider}</p>
                          </div>

                          {bursary.description && (
                            <p className="text-muted-foreground text-xs line-clamp-2">{bursary.description}</p>
                          )}
                          
                          {/* Amount & Deadline */}
                          <div className="flex flex-wrap gap-3 text-xs">
                            {bursary.amount && (
                              <div className="flex items-center gap-1">
                                <Banknote className="w-3.5 h-3.5 text-success shrink-0" />
                                <span className="font-medium">{bursary.amount}</span>
                              </div>
                            )}
                            {bursary.deadline && (
                              <div className="flex items-center gap-1">
                                <Clock className={`w-3.5 h-3.5 shrink-0 ${isUrgent ? 'text-warning' : isPast ? 'text-destructive' : 'text-muted-foreground'}`} />
                                <span className={isPast ? 'text-destructive line-through' : ''}>
                                  {new Date(bursary.deadline).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Fields of Study */}
                          {bursary.fields_of_study && bursary.fields_of_study.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {bursary.fields_of_study.slice(0, 2).map(field => (
                                <Badge key={field} variant="outline" className="text-[10px] px-1.5 py-0">
                                  {field}
                                </Badge>
                              ))}
                              {bursary.fields_of_study.length > 2 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  +{bursary.fields_of_study.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <Button 
                              className="flex-1" 
                              disabled={isPast} 
                              size="sm"
                              onClick={(e) => handleApplyClick(e, bursary.link)}
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                              {isPast ? 'Closed' : 'Apply'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950"
                              onClick={(e) => handleShareWhatsApp(e, bursary)}
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {filteredBursaries.length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <GraduationCap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">No bursaries found</h3>
                      <p className="text-muted-foreground mb-4">Try adjusting your search filters</p>
                      <Button variant="outline" onClick={clearFilters}>
                        Clear All Filters
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
};

export default BursaryFinder;