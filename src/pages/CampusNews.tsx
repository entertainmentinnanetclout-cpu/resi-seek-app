import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import HeroCarousel from "@/components/HeroCarousel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Newspaper, Briefcase, Filter, TrendingUp, PenTool, Upload } from "lucide-react";
import { toast } from "sonner";
import say_no_to_gbv from "@/assets/say_no_to_gbv.jpg";
import heitaMagazine from "@/assets/heita-magazine.jpg";
import oneRepublicMagazine from "@/assets/one-republic-magazine.png";
import emergencyServices from "@/assets/emergency-services.png";
import studentPortalPromo from "@/assets/student-portal-promo.jpg";
import campusDinokeng from "@/assets/campus-dinokeng.jpg";
import studentStudying from "@/assets/student-studying.jpg";

const CampusNews = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Hero Carousel Slides
  const heroSlides = [
    {
      image: say_no_to_gbv,
      title: "Say No to GBV",
      description: "Standing together to protect students and create safer campuses.",
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
    },
    {
      image: oneRepublicMagazine,
      title: "1Republic Campus Magazine",
      description: "Featured stories from Soshanguve Campus - Volume 2, Issue 3",
      cta: {
        text: "View Issue",
        action: () => document.getElementById('jobs-section')?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  ];

  // News Articles
  const newsArticles = [
     {
      id: 1,
  category: "safety",
  title: "TUT Launches GBV Prevention Awareness Campaign",
  author: "Student Support & Wellness",
  date: "2025-11-14",
  image: say_no_to_gbv,
 description: "Last night, students came out in numbers at Pretoria West (Main Campus) to stand united against Gender-Based Violence as part of the ongoing G20 Women’s Shutdown movement. The march saw strong representation from EFF TUT YC leadership, committed ground forces, and West City Students who arrived in large numbers wearing their signature purple residence-branded T-shirts. Their presence demonstrated a shared commitment to making campuses safer for every student. As ResKonnect, we acknowledge, support, and stand firmly with this movement without hesitation or shame. The national Women’s Shutdown is scheduled to take place on the 21st of November, calling for continued solidarity and action.",
 trending: true
    },
    {
      id: 2,
      category: "campus-life",
      title: "Emergency Medical Services Now Available on Campus",
      author: "Campus Safety Team",
      date: "2025-11-05",
      image: emergencyServices,
      description: "ER24 emergency medical services are now stationed at TUT campuses. In case of medical emergency, call ER24 at 010 205 3087 or dial DID 205 3087 from campus phones.",
      trending: true
    },
  
    {
      id: 3,
      category: "campus-life",
      title: "New Student Portal Launched - myTUT",
      author: "IT Services",
      date: "2025-11-03",
      image: studentPortalPromo,
      description: "Access the new myTUT Student Portal at https://mytut.tut.ac.za. Features include e-Learning, e-Admin, MyLife, WiFi access, exam timetables, and results viewing.",
      trending: true
    },
    {
      id: 4,
      category: "research",
      title: "Post-Graduate Study Opportunities Available",
      author: "Admissions Office",
      date: "2025-11-02",
      image: campusDinokeng,
      description: "Are you aspiring to pursue a Post Graduate qualification? TUT offers comprehensive postgraduate programs across all faculties. Contact admissions for detailed information.",
    },
    {
      id: 5,
      category: "campus-life",
      title: "HEITA! Magazine: Legacy & Learning Edition",
      author: "Student Publications",
      date: "2025-11-01",
      image: heitaMagazine,
      description: "The latest edition of HEITA! explores the intersection of heritage and progress at TUT, featuring inspiring student stories and academic achievements.",
    },
    {
      id: 6,
      category: "culture",
      title: "1Republic Magazine Features Campus Stories",
      author: "Soshanguve Campus",
      date: "2025-10-31",
      image: oneRepublicMagazine,
      description: "Volume 2, Issue 3 of 1Republic magazine highlights inspiring student journeys, club activities, and campus achievements from Soshanguve.",
    }
  ];

  // Student Jobs
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
  ];

  const filteredArticles = selectedCategory === "all" 
    ? newsArticles 
    : newsArticles.filter(article => article.category === selectedCategory);

  const handleJournalistSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success("Application received! We'll review your portfolio and get back to you soon.");
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        {/* Hero Carousel */}
        <div className="px-6 md:px-8 pt-6">
          <HeroCarousel slides={heroSlides} />
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
                        <Input required placeholder="John Doe" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Email</label>
                        <Input type="email" required placeholder="john@student.ac.za" />
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
            <Card className="bg-gradient-card shadow-card border-l-4 border-l-accent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" />
                  Trending Now
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {newsArticles
  .filter(article => article.trending)
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .map(article => (
                    <div key={article.id} className="flex gap-4 pb-4 border-b last:border-0">
                      <img 
                        src={article.image} 
                        alt={article.title}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1 hover:text-primary cursor-pointer transition-colors">
                          {article.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">By {article.author} • {new Date(article.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Articles Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map(article => (
                <Card key={article.id} className="shadow-card hover:shadow-hover transition-smooth group cursor-pointer overflow-hidden">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={article.image} 
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
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
                      By {article.author} • {new Date(article.date).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm line-clamp-2">
                      {article.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
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
