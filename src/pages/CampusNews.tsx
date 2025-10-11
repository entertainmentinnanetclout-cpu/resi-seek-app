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

const CampusNews = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Hero Carousel Slides
  const heroSlides = [
    {
      image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1920&q=80",
      title: "Your Campus, Your Stories",
      description: "Stay connected with the latest news, events, and opportunities across campus",
      cta: {
        text: "Explore Stories",
        action: () => document.getElementById('news-feed')?.scrollIntoView({ behavior: 'smooth' })
      }
    },
    {
      image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1920&q=80",
      title: "Student Life & Culture",
      description: "Discover what's happening in clubs, societies, and campus events",
    },
    {
      image: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=1920&q=80",
      title: "Career Opportunities",
      description: "Find part-time jobs, internships, and bursaries tailored for students",
      cta: {
        text: "Browse Jobs",
        action: () => document.getElementById('jobs-section')?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  ];

  // News Articles
  const newsArticles = [
    {
      id: 1,
      category: "campus-life",
      title: "New Student Hub Opens at Main Campus",
      author: "Sarah Mthembu",
      date: "2025-10-10",
      image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80",
      description: "The new 3-story student hub features study spaces, cafes, and collaboration zones designed by students, for students.",
      trending: true
    },
    {
      id: 2,
      category: "research",
      title: "Engineering Students Win National Innovation Award",
      author: "Thabo Ndlovu",
      date: "2025-10-09",
      image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80",
      description: "A team of final-year engineering students developed a solar-powered water purification system for rural communities.",
      trending: true
    },
    {
      id: 3,
      category: "culture",
      title: "Annual Cultural Festival Returns This Month",
      author: "Lerato Sithole",
      date: "2025-10-08",
      image: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
      description: "Experience diverse cultures through food, music, and performances at the biggest campus event of the year.",
    },
    {
      id: 4,
      category: "campus-life",
      title: "New Library Hours Extended for Exam Period",
      author: "Admin Team",
      date: "2025-10-07",
      image: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80",
      description: "The main library will now operate 24/7 during the exam period to support students' study needs.",
    },
    {
      id: 5,
      category: "research",
      title: "Medical Students Launch Mental Health Initiative",
      author: "Zanele Dlamini",
      date: "2025-10-06",
      image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80",
      description: "Peer-to-peer support program aims to break stigma and provide accessible mental health resources.",
      trending: true
    },
    {
      id: 6,
      category: "culture",
      title: "Student Band Performs at National Music Awards",
      author: "Sipho Maleka",
      date: "2025-10-05",
      image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80",
      description: "Campus-formed band 'The Scholars' gains national recognition with their debut album.",
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
                  {newsArticles.filter(article => article.trending).map(article => (
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
