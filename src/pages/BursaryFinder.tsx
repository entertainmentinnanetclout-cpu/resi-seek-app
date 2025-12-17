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
import { Search, Calendar, GraduationCap, ExternalLink, Filter, Clock, Banknote, Loader2 } from "lucide-react";

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
    const { data, error } = await supabase
      .from("bursaries")
      .select("*")
      .eq("is_active", true)
      .order("deadline", { ascending: true });

    if (error) {
      console.error("Fetch error:", error);
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

  return (
    <DashboardLayout>
      <SEO
        title="Bursary Finder | South African Student Bursaries & Funding"
        description="Find bursaries and funding opportunities for South African students. Government, private, and university bursaries available."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-primary" />
              Bursary Finder
            </h1>
            <p className="text-muted-foreground mt-1">
              Discover funding opportunities to support your education journey.
            </p>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search bursaries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
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
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <GraduationCap className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Field of Study" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fields</SelectItem>
                    {fields.map(field => (
                      <SelectItem key={field} value={field.toLowerCase()}>{field}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Results Count */}
          <p className="text-sm text-muted-foreground">
            Found {filteredBursaries.length} bursaries
          </p>

          {/* Loading State */}
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading bursaries...</p>
            </div>
          ) : (
            <>
              {/* Bursary Cards */}
              <div className="grid gap-4 sm:gap-6">
                {filteredBursaries.map(bursary => {
                  const daysUntil = getDaysUntilDeadline(bursary.deadline);
                  const isUrgent = daysUntil !== null && daysUntil <= 30 && daysUntil > 0;
                  const isPast = daysUntil !== null && daysUntil < 0;

                  return (
                    <Card key={bursary.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <CardTitle className="text-xl">{bursary.name}</CardTitle>
                            <CardDescription className="text-base">{bursary.provider}</CardDescription>
                          </div>
                          <Badge className={`${getTypeColor(bursary.type)} capitalize shrink-0`}>
                            {bursary.type}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {bursary.description && (
                          <p className="text-muted-foreground">{bursary.description}</p>
                        )}
                        
                        <div className="grid sm:grid-cols-2 gap-4">
                          {bursary.amount && (
                            <div className="flex items-start gap-2">
                              <Banknote className="w-5 h-5 text-success mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium">Funding Amount</p>
                                <p className="text-sm text-muted-foreground">{bursary.amount}</p>
                              </div>
                            </div>
                          )}
                          {bursary.deadline && (
                            <div className="flex items-start gap-2">
                              <Clock className={`w-5 h-5 mt-0.5 shrink-0 ${isUrgent ? 'text-warning' : isPast ? 'text-destructive' : 'text-muted-foreground'}`} />
                              <div>
                                <p className="text-sm font-medium">Application Deadline</p>
                                <p className={`text-sm ${isUrgent ? 'text-warning font-medium' : isPast ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {new Date(bursary.deadline).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  {isUrgent && ` (${daysUntil} days left!)`}
                                  {isPast && ' (Closed)'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {bursary.fields_of_study && bursary.fields_of_study.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Fields of Study</p>
                            <div className="flex flex-wrap gap-2">
                              {bursary.fields_of_study.map(field => (
                                <Badge key={field} variant="outline" className="text-xs">
                                  {field}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {bursary.requirements && bursary.requirements.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Requirements</p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {bursary.requirements.map((req, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-primary">•</span>
                                  {req}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {bursary.link && (
                          <Button asChild className="w-full sm:w-auto" disabled={isPast}>
                            <a href={bursary.link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              {isPast ? 'Applications Closed' : 'Apply Now'}
                            </a>
                          </Button>
                        )}
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