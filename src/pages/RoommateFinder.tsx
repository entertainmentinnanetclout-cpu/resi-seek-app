import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Users, MessageCircle, Filter, Moon, Sun, Book, Sparkles, User, MapPin } from "lucide-react";
import { RESKONNECT_WHATSAPP_FORMATTED } from "@/lib/constants";

interface RoommateProfile {
  id: string;
  full_name: string;
  campus: string | null;
  course: string | null;
  year_of_study: string | null;
  profile_picture_url: string | null;
  lifestyle_preferences: {
    sleepSchedule?: "early_bird" | "night_owl" | "flexible";
    studyHabits?: "quiet" | "background_music" | "flexible";
    cleanliness?: "very_clean" | "moderate" | "relaxed";
    socialLevel?: "introvert" | "extrovert" | "ambivert";
    smoking?: boolean;
    pets?: boolean;
    budgetRange?: string;
  } | null;
  looking_for_roommate: boolean;
}

const lifestyleLabels = {
  sleepSchedule: {
    early_bird: { label: "Early Bird", icon: Sun },
    night_owl: { label: "Night Owl", icon: Moon },
    flexible: { label: "Flexible", icon: Sparkles }
  },
  studyHabits: {
    quiet: { label: "Quiet Study", icon: Book },
    background_music: { label: "Background Music", icon: Sparkles },
    flexible: { label: "Flexible", icon: Sparkles }
  },
  cleanliness: {
    very_clean: "Very Clean",
    moderate: "Moderately Clean",
    relaxed: "Relaxed"
  },
  socialLevel: {
    introvert: "Introvert",
    extrovert: "Extrovert",
    ambivert: "Ambivert"
  }
};

const campuses = [
  "TUT Pretoria Campus",
  "TUT Soshanguve Campus",
  "TUT Ga-Rankuwa Campus",
  "TUT eMalahleni Campus",
  "TUT Polokwane Campus",
  "TUT Mbombela Campus",
  "Other"
];

const RoommateFinder = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<RoommateProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [campusFilter, setCampusFilter] = useState("all");
  const [myProfile, setMyProfile] = useState<RoommateProfile | null>(null);
  const [isLookingForRoommate, setIsLookingForRoommate] = useState(false);

  useEffect(() => {
    fetchProfiles();
    if (user) fetchMyProfile();
  }, [user]);

  const fetchMyProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data) {
      setMyProfile(data as RoommateProfile);
      setIsLookingForRoommate(data.looking_for_roommate || false);
    }
  };

  const fetchProfiles = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, campus, course, year_of_study, profile_picture_url, lifestyle_preferences, looking_for_roommate")
      .eq("looking_for_roommate", true)
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("Failed to load profiles");
    } else {
      // Filter out current user
      const filtered = (data || []).filter(p => p.id !== user?.id);
      setProfiles(filtered as RoommateProfile[]);
    }
    setIsLoading(false);
  };

  const toggleLookingForRoommate = async () => {
    if (!user) return;
    
    const newValue = !isLookingForRoommate;
    setIsLookingForRoommate(newValue);

    const { error } = await supabase
      .from("profiles")
      .update({ looking_for_roommate: newValue })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update preference");
      setIsLookingForRoommate(!newValue);
    } else {
      toast.success(newValue ? "You're now visible to potential roommates!" : "Profile hidden from roommate search");
      fetchProfiles();
    }
  };

  const handleContact = (profile: RoommateProfile) => {
    const message = encodeURIComponent(
      `Hi ${profile.full_name}! I found your profile on ResKonnect Roommate Finder. I'm also looking for a roommate${profile.campus ? ` near ${profile.campus}` : ''}. Would you like to connect?`
    );
    window.open(`https://wa.me/${RESKONNECT_WHATSAPP_FORMATTED}?text=${message}`, '_blank');
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch =
      profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.campus?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (profile.course?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesCampus = campusFilter === "all" || profile.campus === campusFilter;

    return matchesSearch && matchesCampus;
  });

  const getCompatibilityScore = (profile: RoommateProfile): number => {
    if (!myProfile?.lifestyle_preferences || !profile.lifestyle_preferences) return 0;
    
    const myPrefs = myProfile.lifestyle_preferences;
    const theirPrefs = profile.lifestyle_preferences;
    let matches = 0;
    let total = 0;

    if (myPrefs.sleepSchedule && theirPrefs.sleepSchedule) {
      total++;
      if (myPrefs.sleepSchedule === theirPrefs.sleepSchedule || 
          myPrefs.sleepSchedule === "flexible" || 
          theirPrefs.sleepSchedule === "flexible") matches++;
    }
    if (myPrefs.studyHabits && theirPrefs.studyHabits) {
      total++;
      if (myPrefs.studyHabits === theirPrefs.studyHabits ||
          myPrefs.studyHabits === "flexible" ||
          theirPrefs.studyHabits === "flexible") matches++;
    }
    if (myPrefs.cleanliness && theirPrefs.cleanliness) {
      total++;
      if (myPrefs.cleanliness === theirPrefs.cleanliness) matches++;
    }
    if (myPrefs.socialLevel && theirPrefs.socialLevel) {
      total++;
      if (myPrefs.socialLevel === theirPrefs.socialLevel ||
          myPrefs.socialLevel === "ambivert" ||
          theirPrefs.socialLevel === "ambivert") matches++;
    }
    if (typeof myPrefs.smoking === "boolean" && typeof theirPrefs.smoking === "boolean") {
      total++;
      if (myPrefs.smoking === theirPrefs.smoking) matches++;
    }

    return total > 0 ? Math.round((matches / total) * 100) : 0;
  };

  return (
    <DashboardLayout>
      <SEO
        title="Roommate Finder | Find Compatible Roommates"
        description="Find compatible roommates based on lifestyle, study habits, and preferences. Connect with fellow students looking for shared accommodation."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold font-display flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                Roommate Finder
              </h1>
              <p className="text-muted-foreground mt-1">
                Find your perfect roommate based on lifestyle compatibility.
              </p>
            </div>
          </div>

          {/* My Status Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-semibold">Your Roommate Status</h3>
                  <p className="text-sm text-muted-foreground">
                    {isLookingForRoommate 
                      ? "Your profile is visible to others looking for roommates"
                      : "Enable to let others find you as a potential roommate"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="looking-toggle" className="text-sm">
                    I'm looking for a roommate
                  </Label>
                  <Switch
                    id="looking-toggle"
                    checked={isLookingForRoommate}
                    onCheckedChange={toggleLookingForRoommate}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                💡 Tip: Update your lifestyle preferences in your <a href="/profile" className="text-primary underline">Profile</a> to improve matching accuracy.
              </p>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, campus, or course..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
                <Select value={campusFilter} onValueChange={setCampusFilter}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by Campus" />
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

          {/* Results Count */}
          <p className="text-sm text-muted-foreground">
            Found {filteredProfiles.length} potential roommates
          </p>

          {/* Profile Cards */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Finding potential roommates...</p>
            </div>
          ) : filteredProfiles.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredProfiles.map(profile => {
                const compatibility = getCompatibilityScore(profile);
                const prefs = profile.lifestyle_preferences;

                return (
                  <Card key={profile.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-4">
                        <Avatar className="w-16 h-16">
                          <AvatarImage src={profile.profile_picture_url || undefined} />
                          <AvatarFallback>
                            <User className="w-8 h-8" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{profile.full_name}</CardTitle>
                          {profile.campus && (
                            <CardDescription className="flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              {profile.campus}
                            </CardDescription>
                          )}
                          {profile.course && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {profile.course} {profile.year_of_study && `• Year ${profile.year_of_study}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Compatibility Score */}
                      {compatibility > 0 && (
                        <div className="bg-success/10 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-success">{compatibility}%</p>
                          <p className="text-xs text-muted-foreground">Compatibility</p>
                        </div>
                      )}

                      {/* Lifestyle Badges */}
                      {prefs && (
                        <div className="flex flex-wrap gap-2">
                          {prefs.sleepSchedule && (
                            <Badge variant="outline" className="text-xs">
                              {prefs.sleepSchedule === "early_bird" ? "🌅 Early Bird" : 
                               prefs.sleepSchedule === "night_owl" ? "🦉 Night Owl" : "⏰ Flexible"}
                            </Badge>
                          )}
                          {prefs.studyHabits && (
                            <Badge variant="outline" className="text-xs">
                              {prefs.studyHabits === "quiet" ? "🤫 Quiet Study" : 
                               prefs.studyHabits === "background_music" ? "🎵 Music OK" : "📚 Flexible"}
                            </Badge>
                          )}
                          {prefs.socialLevel && (
                            <Badge variant="outline" className="text-xs">
                              {prefs.socialLevel === "introvert" ? "🏠 Introvert" : 
                               prefs.socialLevel === "extrovert" ? "🎉 Extrovert" : "😊 Ambivert"}
                            </Badge>
                          )}
                          {prefs.smoking === false && (
                            <Badge variant="outline" className="text-xs">🚭 Non-smoker</Badge>
                          )}
                        </div>
                      )}

                      <Button onClick={() => handleContact(profile)} className="w-full">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Connect via WhatsApp
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No roommates found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || campusFilter !== "all" 
                    ? "Try adjusting your search filters"
                    : "Be the first to enable roommate search!"}
                </p>
                {!isLookingForRoommate && (
                  <Button onClick={toggleLookingForRoommate}>
                    Enable Roommate Search
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default RoommateFinder;
