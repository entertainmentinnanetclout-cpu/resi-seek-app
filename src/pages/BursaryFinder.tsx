import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Calendar, GraduationCap, ExternalLink, Filter, Clock, Banknote, Loader2, Share2 } from "lucide-react";

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
}

const BursaryFinder = () => {
  const [bursaries, setBursaries] = useState<Bursary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fieldFilter, setFieldFilter] = useState("all");

  useEffect(() => {
    fetchBursaries();
    
    // Realtime subscription
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

  const filteredBursaries = bursaries.filter(bursary => {
    const matchesSearch = 
      bursary.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bursary.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bursary.fields_of_study?.some(f => f.toLowerCase().includes(searchQuery.toLowerCase())) ?? false);
    
    const matchesType = typeFilter === "all" || bursary.type === typeFilter;
    const matchesField = fieldFilter === "all" || (bursary.fields_of_study?.some(f => f.toLowerCase().includes(fieldFilter.toLowerCase())) ?? false);
    
    return matchesSearch && matchesType && matchesField;
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

  const getDaysUntilDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleShareWhatsApp = (bursary: Bursary) => {
    const baseUrl = window.location.origin;
    const bursaryUrl = `${baseUrl}/bursaries`;
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
      `👉 Find this & more bursaries on ResKonnect:\n${bursaryUrl}`
    );
    
    window.open(`https://wa.me/?text=${message}`, '_blank');
    toast.success('Opening WhatsApp to share...');
  };

  return (
    <DashboardLayout>
      <SEO
        title="Bursary Finder | South African Student Bursaries & Funding"
        description="Find bursaries and funding opportunities for South African students. Government, private, and university bursaries available."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display flex items-center justify-center sm:justify-start gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              Bursary Finder
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Discover funding opportunities to support your education journey.
            </p>
          </div>

          {/* Filters - Stacked on mobile */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search bursaries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <Filter className="w-4 h-4 mr-2 shrink-0" />
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="government">Government</SelectItem>
                      <SelectItem value="private">Private/Corporate</SelectItem>
                      <SelectItem value="university">University</SelectItem>
                      <SelectItem value="ngo">NGO</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={fieldFilter} onValueChange={setFieldFilter}>
                    <SelectTrigger>
                      <GraduationCap className="w-4 h-4 mr-2 shrink-0" />
                      <SelectValue placeholder="Field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fields</SelectItem>
                      {fields.map(field => (
                        <SelectItem key={field} value={field.toLowerCase()}>{field}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

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
              {/* Bursary Cards - Better mobile layout */}
              <div className="grid gap-4">
                {filteredBursaries.map(bursary => {
                  const daysUntil = getDaysUntilDeadline(bursary.deadline);
                  const isUrgent = daysUntil !== null && daysUntil <= 30 && daysUntil > 0;
                  const isPast = daysUntil !== null && daysUntil < 0;

                  return (
                    <Card key={bursary.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2 sm:pb-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0 flex-1">
                              <CardTitle className="text-lg sm:text-xl leading-tight">{bursary.name}</CardTitle>
                              <CardDescription className="text-sm sm:text-base">{bursary.provider}</CardDescription>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                                onClick={() => handleShareWhatsApp(bursary)}
                                title="Share on WhatsApp"
                              >
                                <Share2 className="w-4 h-4" />
                              </Button>
                              <Badge className={`${getTypeColor(bursary.type)} capitalize text-xs`}>
                                {bursary.type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {bursary.description && (
                          <p className="text-muted-foreground text-sm line-clamp-2">{bursary.description}</p>
                        )}
                        
                        {/* Amount & Deadline - Side by side on mobile */}
                        <div className="flex flex-wrap gap-4">
                          {bursary.amount && (
                            <div className="flex items-center gap-2">
                              <Banknote className="w-4 h-4 text-success shrink-0" />
                              <span className="text-sm font-medium">{bursary.amount}</span>
                            </div>
                          )}
                          {bursary.deadline && (
                            <div className="flex items-center gap-2">
                              <Clock className={`w-4 h-4 shrink-0 ${isUrgent ? 'text-warning' : isPast ? 'text-destructive' : 'text-muted-foreground'}`} />
                              <span className={`text-sm ${isUrgent ? 'text-warning font-medium' : isPast ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {new Date(bursary.deadline).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {isUrgent && ` (${daysUntil}d left)`}
                                {isPast && ' (Closed)'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Fields of Study - Horizontal scroll on mobile */}
                        {bursary.fields_of_study && bursary.fields_of_study.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                            {bursary.fields_of_study.slice(0, 4).map(field => (
                              <Badge key={field} variant="outline" className="text-xs shrink-0">
                                {field}
                              </Badge>
                            ))}
                            {bursary.fields_of_study.length > 4 && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                +{bursary.fields_of_study.length - 4} more
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Requirements - Collapsible on mobile would be better, show first 2 */}
                        {bursary.requirements && bursary.requirements.length > 0 && (
                          <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Requirements:</p>
                            <ul className="space-y-0.5">
                              {bursary.requirements.slice(0, 3).map((req, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-primary">•</span>
                                  <span className="line-clamp-1">{req}</span>
                                </li>
                              ))}
                              {bursary.requirements.length > 3 && (
                                <li className="text-xs text-muted-foreground">+{bursary.requirements.length - 3} more requirements</li>
                              )}
                            </ul>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          {bursary.link && (
                            <Button asChild className="flex-1" disabled={isPast} size="sm">
                              <a href={bursary.link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                {isPast ? 'Closed' : 'Apply Now'}
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => handleShareWhatsApp(bursary)}
                          >
                            <Share2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Share</span>
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
                    <p className="text-muted-foreground">Try adjusting your search filters</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BursaryFinder;
