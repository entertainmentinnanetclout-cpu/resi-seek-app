import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Search, Percent, ExternalLink, Filter, Tag, ShoppingBag, Utensils, Bus, Gamepad2, Laptop, Heart } from "lucide-react";
import { RESKONNECT_WHATSAPP_FORMATTED } from "@/lib/constants";

interface Discount {
  id: string;
  name: string;
  provider: string;
  discount: string;
  category: "food" | "transport" | "entertainment" | "tech" | "health" | "shopping";
  description: string;
  howToClaim: string;
  link: string;
  validUntil?: string;
}

const discounts: Discount[] = [
  {
    id: "1",
    name: "Spotify Student",
    provider: "Spotify",
    discount: "50% off Premium",
    category: "entertainment",
    description: "Get Spotify Premium at half price with a valid student email.",
    howToClaim: "Sign up with your student email address and verify through SheerID.",
    link: "https://www.spotify.com/student"
  },
  {
    id: "2",
    name: "Apple Music Student",
    provider: "Apple",
    discount: "50% off subscription",
    category: "entertainment",
    description: "Stream unlimited music with Apple Music at student rates.",
    howToClaim: "Verify student status through UNiDAYS when subscribing.",
    link: "https://www.apple.com/za/shop/browse/campaigns/students"
  },
  {
    id: "3",
    name: "Microsoft 365 Education",
    provider: "Microsoft",
    discount: "Free for students",
    category: "tech",
    description: "Get Word, Excel, PowerPoint, and more completely free.",
    howToClaim: "Sign up with your university email address (.ac.za domain).",
    link: "https://www.microsoft.com/en-za/education"
  },
  {
    id: "4",
    name: "GitHub Student Developer Pack",
    provider: "GitHub",
    discount: "Free tools worth $200k+",
    category: "tech",
    description: "Access professional developer tools including GitHub Pro, cloud credits, and more.",
    howToClaim: "Apply with your student email and proof of enrollment.",
    link: "https://education.github.com/pack"
  },
  {
    id: "5",
    name: "Steers Student Meals",
    provider: "Steers",
    discount: "Up to 20% off",
    category: "food",
    description: "Show your student card for discounts on selected meals.",
    howToClaim: "Present your valid student card when ordering.",
    link: "https://www.steers.co.za"
  },
  {
    id: "6",
    name: "McDonald's Student Discount",
    provider: "McDonald's SA",
    discount: "10-15% off",
    category: "food",
    description: "Student discounts at participating locations.",
    howToClaim: "Show your student card at checkout.",
    link: "https://www.mcdonalds.co.za"
  },
  {
    id: "7",
    name: "Gautrain Student Discount",
    provider: "Gautrain",
    discount: "25% off fares",
    category: "transport",
    description: "Reduced fares for students traveling on Gautrain.",
    howToClaim: "Apply for a Gautrain student Gold Card with proof of registration.",
    link: "https://www.gautrain.co.za"
  },
  {
    id: "8",
    name: "Ster-Kinekor Student",
    provider: "Ster-Kinekor",
    discount: "Up to 30% off tickets",
    category: "entertainment",
    description: "Discounted movie tickets on select days and screenings.",
    howToClaim: "Show student card when purchasing tickets or book online with student promo.",
    link: "https://www.sterkinekor.com"
  },
  {
    id: "9",
    name: "Adobe Creative Cloud",
    provider: "Adobe",
    discount: "60% off first year",
    category: "tech",
    description: "Access Photoshop, Illustrator, Premiere Pro and more.",
    howToClaim: "Verify student status and sign up for the student plan.",
    link: "https://www.adobe.com/africa/creativecloud/buy/students.html"
  },
  {
    id: "10",
    name: "Virgin Active Student",
    provider: "Virgin Active",
    discount: "Reduced membership",
    category: "health",
    description: "Discounted gym membership for full-time students.",
    howToClaim: "Visit your nearest branch with student card and proof of registration.",
    link: "https://www.virginactive.co.za"
  },
  {
    id: "11",
    name: "Planet Fitness Student",
    provider: "Planet Fitness",
    discount: "Special student rates",
    category: "health",
    description: "Affordable gym membership with student discount.",
    howToClaim: "Sign up in-branch with valid student ID.",
    link: "https://www.planetfitness.co.za"
  },
  {
    id: "12",
    name: "Takealot Student",
    provider: "Takealot",
    discount: "Various deals",
    category: "shopping",
    description: "Special student deals and promotions throughout the year.",
    howToClaim: "Look for student specials during back-to-school seasons.",
    link: "https://www.takealot.com"
  }
];

const categoryIcons = {
  food: Utensils,
  transport: Bus,
  entertainment: Gamepad2,
  tech: Laptop,
  health: Heart,
  shopping: ShoppingBag
};

const categoryColors = {
  food: "bg-warning/20 text-warning border-warning/30",
  transport: "bg-success/20 text-success border-success/30",
  entertainment: "bg-primary/20 text-primary border-primary/30",
  tech: "bg-accent/20 text-accent border-accent/30",
  health: "bg-destructive/20 text-destructive border-destructive/30",
  shopping: "bg-secondary/20 text-secondary-foreground border-secondary/30"
};

const StudentDiscounts = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredDiscounts = discounts.filter(discount => {
    const matchesSearch =
      discount.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      discount.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      discount.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === "all" || discount.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const handlePartnerSubmit = () => {
    const message = encodeURIComponent(
      "Hi! I'd like to list my business on ResKonnect Student Discounts. Please share more information about partnership opportunities."
    );
    window.open(`https://wa.me/${RESKONNECT_WHATSAPP_FORMATTED}?text=${message}`, '_blank');
  };

  return (
    <DashboardLayout>
      <SEO
        title="Student Discounts | Save Money with Student Deals"
        description="Find the best student discounts in South Africa. Save on food, transport, entertainment, tech, and more."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold font-display flex items-center gap-3">
                <Percent className="w-8 h-8 text-primary" />
                Student Discounts
              </h1>
              <p className="text-muted-foreground mt-1">
                Exclusive deals and discounts for South African students.
              </p>
            </div>
            <Button variant="outline" onClick={handlePartnerSubmit}>
              <Tag className="w-4 h-4 mr-2" />
              List Your Business
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search discounts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="food">Food & Dining</SelectItem>
                    <SelectItem value="transport">Transport</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="tech">Tech & Software</SelectItem>
                    <SelectItem value="health">Health & Fitness</SelectItem>
                    <SelectItem value="shopping">Shopping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Category Quick Filters */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryIcons).map(([category, Icon]) => (
              <Button
                key={category}
                variant={categoryFilter === category ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(categoryFilter === category ? "all" : category)}
                className="capitalize"
              >
                <Icon className="w-4 h-4 mr-1" />
                {category}
              </Button>
            ))}
          </div>

          {/* Results Count */}
          <p className="text-sm text-muted-foreground">
            Found {filteredDiscounts.length} discounts
          </p>

          {/* Discount Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredDiscounts.map(discount => {
              const Icon = categoryIcons[discount.category];
              return (
                <Card key={discount.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-lg">{discount.name}</CardTitle>
                        <CardDescription>{discount.provider}</CardDescription>
                      </div>
                      <Badge className={`${categoryColors[discount.category]} capitalize shrink-0`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {discount.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 flex-1 flex flex-col">
                    <div className="bg-primary/10 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{discount.discount}</p>
                    </div>

                    <p className="text-sm text-muted-foreground flex-1">{discount.description}</p>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">How to Claim:</p>
                      <p className="text-sm text-muted-foreground">{discount.howToClaim}</p>
                    </div>

                    <Button asChild className="w-full mt-auto">
                      <a href={discount.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Get Discount
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredDiscounts.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Percent className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No discounts found</h3>
                <p className="text-muted-foreground">Try adjusting your search filters</p>
              </CardContent>
            </Card>
          )}

          {/* Partner CTA */}
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="py-8 text-center">
              <h3 className="text-xl font-semibold mb-2">Are you a business owner?</h3>
              <p className="text-muted-foreground mb-4">
                Partner with ResKonnect to reach thousands of students across South Africa.
              </p>
              <Button onClick={handlePartnerSubmit}>
                Become a Partner
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDiscounts;
