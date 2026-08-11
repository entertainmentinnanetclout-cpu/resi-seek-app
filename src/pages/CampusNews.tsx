import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import HeroCarousel from "@/components/HeroCarousel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Newspaper, Briefcase, Filter, TrendingUp, PenTool, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Fallback images for when no database images exist
import artsFestival from "@/assets/arts-festival.jpg";
import heitaMagazine from "@/assets/heita-magazine.jpg";
import emergencyServices from "@/assets/emergency-services.png";
import studentPortalPromo from "@/assets/student-portal-promo.jpg";

interface HeroSlide {
  id: string;
  image_url: string;
  title: string;
  description: string | null;
  cta_text: string | null;
  cta_link: string | null;
  display_order: number;
}

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  image_url: string | null;
  category: string;
  author: string | null;
  published_at: string | null;
  created_at: string;
  is_published: boolean;
}

const CampusNews = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Realtime subscriptions
    const slidesChannel = supabase
      .channel('hero-slides-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hero_slides' }, () => fetchHeroSlides())
      .subscribe();

    const newsChannel = supabase
      .channel('campus-news-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campus_news' }, () => fetchNewsArticles())
      .subscribe();

    return () => {
      supabase.removeChannel(slidesChannel);
      supabase.removeChannel(newsChannel);
    };
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchHeroSlides(), fetchNewsArticles()]);
    setIsLoading(false);
  };

  const fetchHeroSlides = async () => {
    const { data, error } = await supabase
      .from("hero_slides")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!error && data) {
      setHeroSlides(data);
    }
  };

  const fetchNewsArticles = async () => {
    const { data, error } = await supabase
      .from("campus_news")
      .select("*")
      .eq("is_published", true)
      .order("published_at", { ascending: false });

    if (!error && data) {
      setNewsArticles(data);
    }
  };

  // Convert database slides to carousel format
  const carouselSlides = heroSlides.length > 0 
    ? heroSlides.map(slide => ({
        image: slide.image_url,
        title: slide.title,
        description: slide.description || "",
        cta: slide.cta_text ? {
          text: slide.cta_text,
          action: () => {
            if (slide.cta_link) {
              if (slide.cta_link.startsWith('http')) {
                window.open(slide.cta_link, '_blank');
              } else if (slide.cta_link.startsWith('#')) {
                document.getElementById(slide.cta_link.substring(1))?.scrollIntoView({ behavior: 'smooth' });
              } else {
                navigate(slide.cta_link);
              }
            }
          }
        } : undefined
      }))
    : [
        // Fallback slides if no database content
        {
          image: artsFestival,
          title: "TUT Arts & Culture Festival",
          description: "Celebrating creativity and diversity through vibrant campus arts programs",
          cta: {
            text: "Learn More",
            action: () => document.getElementById('news-feed')?.scrollIntoView({ behavior: 'smooth' })
          }
        },
        {
          image: heitaMagazine,
          title: "HEITA! Student Magazine",
          description: "Legacy & Learning - Reflecting on heritage and progress at TUT",
          cta: {
            text: "Read Magazine",
            action: () => document.getElementById('news-feed')?.scrollIntoView({ behavior: 'smooth' })
          }
        }
      ];

  // Fallback news if database is empty
  const fallbackNews: NewsArticle[] = [
    {
      id: '1',
      category: "campus-life",
      title: "Emergency Medical Services Now Available on Campus",
      author: "Campus Safety Team",
      published_at: "2025-11-05",
      created_at: "2025-11-05",
      image_url: emergencyServices,
      excerpt: "ER24 emergency medical services are now stationed at TUT campuses.",
      content: "ER24 emergency medical services are now stationed at TUT campuses. In case of medical emergency, call ER24 at 010 205 3087.",
      is_published: true
    },
    {
      id: '2',
      category: "culture",
      title: "TUT Arts Festival Celebrates Cultural Diversity",
      author: "Arts & Culture Committee",
      published_at: "2025-11-04",
      created_at: "2025-11-04",
      image_url: artsFestival,
      excerpt: "Experience vibrant student creativity through our annual arts festival.",
      content: "Experience vibrant student creativity through our annual arts festival featuring music, dance, visual arts, and cultural performances.",
      is_published: true
    },
    {
      id: '3',
      category: "campus-life",
      title: "New Student Portal Launched - myTUT",
      author: "IT Services",
      published_at: "2025-11-03",
      created_at: "2025-11-03",
      image_url: studentPortalPromo,
      excerpt: "Access the new myTUT Student Portal for all your academic needs.",
      content: "Access the new myTUT Student Portal at https://mytut.tut.ac.za. Features include e-Learning, e-Admin, and more.",
      is_published: true
    }
  ];

  const displayArticles = newsArticles.length > 0 ? newsArticles : fallbackNews;

  // Student Jobs (static for now, can be moved to database later)
  const studentJobs = [
    {
      id: 1,
      title: "Campus Library Assistant",
      employer: "University Library",
      type: "Part-Time",
      deadline: "2025-10-20",
      description: "15 hours/week, flexible schedule, help students with research and book management"
    },
    {
      id: 2,
      title: "Tutoring Positions Available",
      employer: "Academic Support Centre",
      type: "Flexible",
      deadline: "2025-10-25",
      description: "Mathematics, Science, and English tutors needed. Great pay and flexible hours."
    },
    {
      id: 3,
      title: "Student Journalist - ResKonnect",
      employer: "ResKonnect Media",
      type: "Part-Time",
      deadline: "2025-11-01",
      description: "Write campus stories, conduct interviews, and build your journalism portfolio."
    },
    {
      id: 4,
      title: "IT Support Intern",
      employer: "Campus IT Department",
      type: "Internship",
      deadline: "2025-10-30",
      description: "6-month paid internship. Gain hands-on experience in enterprise IT systems."
    }
  ];

  const categories = [
    { id: "all", name: "All News" },
    { id: "campus-life", name: "Campus Life" },
    { id: "research", name: "Research" },
    { id: "culture", name: "Culture" },
    { id: "general", name: "General" },
  ];

  const filteredArticles = selectedCategory === "all" 
    ? displayArticles 
    : displayArticles.filter(article => article.category === selectedCategory);

  const trendingArticles = displayArticles.slice(0, 3); // First 3 as trending

  const handleJournalistSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success("Application received! We'll review your portfolio and get back to you soon.");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading campus news...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO
        title="Campus News & Events | ResKonnect"
        description="Stay informed about the latest news, events, and opportunities..."
      />
      <div className="min-h-screen">
        {/* Hero Carousel */}
        <div className="px-6 md:px-8 pt-6">
          <HeroCarousel slides={carouselSlides} useDatabase={true} location="news" />
        </div>

        {/* Main Content */}
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-12">
          
          {/* Recruit Student Journalists */}
          <Card className="bg-gradient-accent text-white shadow-premium border-0">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-3xl mb-2 flex items-center gap-2">
                    <PenTool className="w-8 h-8" />
                    Become a Campus Journalist
                  </CardTitle>
                  <CardDescription className="text-white/90 text-lg">
                    Share your voice, tell student stories, and build your portfolio
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="lg" className="bg-white text-primary hover:bg-white/90">
                      Apply Now
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-2xl">Join Our Journalism Team</DialogTitle>
                      <DialogDescription>
                        Fill out the form below to apply. We review applications on a rolling basis.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleJournalistSubmit} className="space-y-4 mt-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Full Name</label>
                        <Input required placeholder="Lawrence Dube" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Email</label>
                        <Input type="email" required placeholder="reskonnect@gmail.com" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Campus</label>
                        <Input required placeholder="e.g., Pretoria Main Campus" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Why do you want to write for us?</label>
                        <Textarea required rows={4} placeholder="Tell us about your passion for storytelling..." />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          Portfolio / Writing Samples (Optional)
                        </label>
                        <Input type="file" accept=".pdf,.doc,.docx" />
                      </div>
                      <Button type="submit" variant="premium" className="w-full" size="lg">
                        Submit Application
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
          </Card>

          {/* News Feed */}
          <div id="news-feed" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2">Campus News & Stories</h2>
                <p className="text-muted-foreground">Stay updated with the latest from campus life</p>
              </div>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>

            {/* Category Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>

            {/* Trending Section */}
            {trendingArticles.length > 0 && (
              <Card className="bg-gradient-card shadow-card border-l-4 border-l-accent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-accent" />
                    Trending Now
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {trendingArticles.map(article => (
                      <div key={article.id} className="flex gap-4 pb-4 border-b last:border-0">
                        {article.image_url && (
                          <img 
                            src={article.image_url} 
                            alt={article.title}
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold mb-1 hover:text-primary cursor-pointer transition-colors">
                            {article.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            By {article.author || 'ResKonnect'} • {new Date(article.published_at || article.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Articles Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map(article => (
                <Card key={article.id} className="shadow-card hover:shadow-hover transition-smooth group cursor-pointer overflow-hidden">
                  <div className="relative h-48 overflow-hidden">
                    {article.image_url ? (
                      <img 
                        src={article.image_url} 
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Newspaper className="w-12 h-12 text-primary/30" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <Badge className="capitalize bg-primary/90 backdrop-blur-sm">
                        {article.category.replace('-', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {article.title}
                    </CardTitle>
                    <CardDescription>
                      By {article.author || 'ResKonnect'} • {new Date(article.published_at || article.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm line-clamp-2">
                      {article.excerpt || article.content.substring(0, 150)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredArticles.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Newspaper className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No articles found</h3>
                  <p className="text-muted-foreground">Check back later for more news</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Student Jobs Section */}
          <div id="jobs-section" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
                  <Briefcase className="w-8 h-8 text-primary" />
                  Student Jobs & Opportunities
                </h2>
                <p className="text-muted-foreground">Part-time positions, internships, and bursaries</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {studentJobs.map(job => (
                <Card key={job.id} className="shadow-card hover:shadow-hover transition-smooth">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{job.title}</CardTitle>
                        <CardDescription className="text-base">{job.employer}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">{job.type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">{job.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Deadline: {new Date(job.deadline).toLocaleDateString()}
                      </span>
                      <Button variant="default">Apply Now</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CampusNews;