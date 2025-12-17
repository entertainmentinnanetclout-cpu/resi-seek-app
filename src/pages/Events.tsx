import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Calendar, MapPin, Clock, Users, Filter, Plus, Heart, ExternalLink } from "lucide-react";
import { RESKONNECT_WHATSAPP_FORMATTED } from "@/lib/constants";
import { format } from "date-fns";

interface Event {
  id: string;
  title: string;
  description: string | null;
  category: string;
  campus: string | null;
  event_date: string;
  location: string | null;
  image_url: string | null;
  interested_count: number;
  created_by: string | null;
}

const categories = ["Academic", "Social", "Sports", "Career", "Cultural", "Workshop"];
const campuses = [
  "TUT Pretoria Campus",
  "TUT Soshanguve Campus",
  "TUT Ga-Rankuwa Campus",
  "TUT eMalahleni Campus",
  "TUT Polokwane Campus",
  "TUT Mbombela Campus",
  "Online",
  "Other"
];

const categoryColors: Record<string, string> = {
  Academic: "bg-primary/20 text-primary border-primary/30",
  Social: "bg-success/20 text-success border-success/30",
  Sports: "bg-warning/20 text-warning border-warning/30",
  Career: "bg-secondary/20 text-secondary-foreground border-secondary/30",
  Cultural: "bg-accent/20 text-accent border-accent/30",
  Workshop: "bg-destructive/20 text-destructive border-destructive/30"
};

const Events = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [campusFilter, setCampusFilter] = useState("all");
  const [interestedEvents, setInterestedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchEvents();
    loadInterestedEvents();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true });

    if (error) {
      toast.error("Failed to load events");
    } else {
      setEvents(data || []);
    }
    setIsLoading(false);
  };

  const loadInterestedEvents = () => {
    const saved = localStorage.getItem("interested_events");
    if (saved) {
      setInterestedEvents(new Set(JSON.parse(saved)));
    }
  };

  const toggleInterested = async (eventId: string) => {
    const newInterested = new Set(interestedEvents);
    const isCurrentlyInterested = newInterested.has(eventId);
    
    if (isCurrentlyInterested) {
      newInterested.delete(eventId);
    } else {
      newInterested.add(eventId);
    }
    
    setInterestedEvents(newInterested);
    localStorage.setItem("interested_events", JSON.stringify([...newInterested]));

    // Update count in database
    const event = events.find(e => e.id === eventId);
    if (event) {
      const newCount = isCurrentlyInterested 
        ? Math.max(0, event.interested_count - 1)
        : event.interested_count + 1;

      await supabase
        .from("events")
        .update({ interested_count: newCount })
        .eq("id", eventId);

      setEvents(prev => prev.map(e => 
        e.id === eventId ? { ...e, interested_count: newCount } : e
      ));
    }

    toast.success(isCurrentlyInterested ? "Removed from interested" : "Added to interested!");
  };

  const handleSubmitEvent = () => {
    const message = encodeURIComponent(
      "Hi! I'd like to submit an event to be listed on ResKonnect Events. Here are the details:\n\n" +
      "Event Name: \n" +
      "Date & Time: \n" +
      "Location: \n" +
      "Campus: \n" +
      "Category: \n" +
      "Description: "
    );
    window.open(`https://wa.me/${RESKONNECT_WHATSAPP_FORMATTED}?text=${message}`, '_blank');
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (event.location?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesCategory = categoryFilter === "all" || event.category === categoryFilter;
    const matchesCampus = campusFilter === "all" || event.campus === campusFilter;

    return matchesSearch && matchesCategory && matchesCampus;
  });

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      day: format(date, "d"),
      month: format(date, "MMM"),
      time: format(date, "h:mm a"),
      full: format(date, "EEEE, MMMM d, yyyy")
    };
  };

  return (
    <DashboardLayout>
      <SEO
        title="Campus Events | Student Events & Activities"
        description="Discover campus events, study groups, social gatherings, and career opportunities. Stay connected with your student community."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold font-display flex items-center gap-3">
                <Calendar className="w-8 h-8 text-primary" />
                Campus Events
              </h1>
              <p className="text-muted-foreground mt-1">
                Discover events, study groups, and activities happening on campus.
              </p>
            </div>
            <Button onClick={handleSubmitEvent}>
              <Plus className="w-4 h-4 mr-2" />
              Submit Event
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={campusFilter} onValueChange={setCampusFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <MapPin className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Campus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campuses</SelectItem>
                    {campuses.map(campus => (
                      <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Category Quick Filters */}
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <Button
                key={category}
                variant={categoryFilter === category ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(categoryFilter === category ? "all" : category)}
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Results Count */}
          <p className="text-sm text-muted-foreground">
            Found {filteredEvents.length} upcoming events
          </p>

          {/* Event Cards */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading events...</p>
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="grid gap-4 sm:gap-6">
              {filteredEvents.map(event => {
                const dateInfo = formatEventDate(event.event_date);
                const isInterested = interestedEvents.has(event.id);

                return (
                  <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="flex flex-col sm:flex-row">
                      {/* Date Box */}
                      <div className="bg-primary/10 p-4 sm:p-6 flex sm:flex-col items-center justify-center gap-2 sm:gap-1 sm:min-w-[100px]">
                        <span className="text-3xl sm:text-4xl font-bold text-primary">{dateInfo.day}</span>
                        <span className="text-sm font-medium text-primary uppercase">{dateInfo.month}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-start gap-2 flex-wrap">
                              <CardTitle className="text-xl">{event.title}</CardTitle>
                              <Badge className={categoryColors[event.category] || "bg-muted"}>
                                {event.category}
                              </Badge>
                            </div>
                            
                            {event.description && (
                              <CardDescription className="line-clamp-2">
                                {event.description}
                              </CardDescription>
                            )}

                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {dateInfo.time}
                              </span>
                              {event.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {event.location}
                                </span>
                              )}
                              {event.campus && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {event.campus}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                            <Button
                              variant={isInterested ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleInterested(event.id)}
                              className="gap-1"
                            >
                              <Heart className={`w-4 h-4 ${isInterested ? "fill-current" : ""}`} />
                              {isInterested ? "Interested" : "I'm Interested"}
                            </Button>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {event.interested_count} interested
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No upcoming events</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || categoryFilter !== "all" || campusFilter !== "all"
                    ? "Try adjusting your search filters"
                    : "Be the first to submit an event!"}
                </p>
                <Button onClick={handleSubmitEvent}>
                  <Plus className="w-4 h-4 mr-2" />
                  Submit an Event
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Submit Event CTA */}
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="py-8 text-center">
              <h3 className="text-xl font-semibold mb-2">Have an event to share?</h3>
              <p className="text-muted-foreground mb-4">
                Submit your campus event, study group, or activity to reach thousands of students.
              </p>
              <Button onClick={handleSubmitEvent}>
                <Plus className="w-4 h-4 mr-2" />
                Submit Your Event
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Events;
