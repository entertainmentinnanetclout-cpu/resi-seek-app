import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ArrowLeft, Calendar, Banknote, GraduationCap, ExternalLink, Share2, Clock, CheckCircle2, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  image_url?: string | null;
}

const BursaryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bursary, setBursary] = useState<Bursary | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedBursaries, setRelatedBursaries] = useState<Bursary[]>([]);

  useEffect(() => {
    const fetchBursary = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from("bursaries")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching bursary:", error);
        toast.error("Bursary not found");
        navigate("/bursaries");
        return;
      }

      setBursary(data);

      // Fetch related bursaries
      const { data: related } = await supabase
        .from("bursaries")
        .select("*")
        .eq("is_active", true)
        .eq("type", data.type)
        .neq("id", id)
        .limit(3);

      setRelatedBursaries(related || []);
      setLoading(false);
    };

    fetchBursary();
  }, [id, navigate]);

  const getDaysUntilDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleShareWhatsApp = () => {
    if (!bursary) return;

    const baseUrl = window.location.origin;
    const bursaryUrl = `${baseUrl}/bursary/${bursary.id}`;
    const deadlineText = bursary.deadline
      ? `\n📅 Deadline: ${new Date(bursary.deadline).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}`
      : "";
    const amountText = bursary.amount ? `\n💰 ${bursary.amount}` : "";

    const message = encodeURIComponent(
      `🎓 *${bursary.name}* - Bursary Opportunity!\n\n` +
        `📚 Provider: ${bursary.provider}` +
        amountText +
        deadlineText +
        `\n\n${bursary.description || "Apply now for this amazing opportunity!"}\n\n` +
        `👉 View details on ResKonnect:\n${bursaryUrl}`
    );

    window.open(`https://wa.me/?text=${message}`, "_blank");
    toast.success("Opening WhatsApp to share...");
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "government":
        return "bg-success/20 text-success border-success/30";
      case "private":
        return "bg-primary/20 text-primary border-primary/30";
      case "university":
        return "bg-secondary/20 text-secondary border-secondary/30";
      case "ngo":
        return "bg-warning/20 text-warning border-warning/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getDefaultImage = (provider: string) => {
    // Try to get logo from clearbit
    const domain = provider.toLowerCase().replace(/\s+/g, "");
    return `https://logo.clearbit.com/${domain}.co.za`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!bursary) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Bursary Not Found</h2>
          <p className="text-muted-foreground mb-4">The bursary you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/bursaries")}>View All Bursaries</Button>
        </div>
      </DashboardLayout>
    );
  }

  const daysUntil = getDaysUntilDeadline(bursary.deadline);
  const isUrgent = daysUntil !== null && daysUntil <= 30 && daysUntil > 0;
  const isPast = daysUntil !== null && daysUntil < 0;

  return (
    <DashboardLayout>
      <SEO
        title={`${bursary.name} | South African Bursaries`}
        description={bursary.description || `Apply for ${bursary.name} bursary from ${bursary.provider}`}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/bursaries">Bursaries</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink>{bursary.name}</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Back Button */}
          <Button variant="ghost" onClick={() => navigate("/bursaries")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Bursaries
          </Button>

          {/* Hero Section */}
          <Card className="overflow-hidden">
            <div className="relative h-48 sm:h-64 bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center">
              <img
                src={bursary.image_url || getDefaultImage(bursary.provider)}
                alt={bursary.provider}
                className="max-h-32 sm:max-h-40 max-w-[200px] object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute top-4 right-4">
                <Badge className={`${getTypeColor(bursary.type)} capitalize`}>{bursary.type}</Badge>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">{bursary.name}</h1>
                  <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span>{bursary.provider}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-green-600 border-green-200 hover:bg-green-50"
                    onClick={handleShareWhatsApp}
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </Button>
                </div>
              </div>

              {/* Key Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
                {bursary.amount && (
                  <div className="p-4 rounded-lg bg-success/10">
                    <div className="flex items-center gap-2 text-success mb-1">
                      <Banknote className="w-5 h-5" />
                      <span className="text-sm font-medium">Funding</span>
                    </div>
                    <p className="text-lg font-semibold">{bursary.amount}</p>
                  </div>
                )}
                {bursary.deadline && (
                  <div className={`p-4 rounded-lg ${isUrgent ? "bg-warning/10" : isPast ? "bg-destructive/10" : "bg-muted"}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isUrgent ? "text-warning" : isPast ? "text-destructive" : "text-muted-foreground"}`}>
                      <Calendar className="w-5 h-5" />
                      <span className="text-sm font-medium">Deadline</span>
                    </div>
                    <p className="text-lg font-semibold">
                      {new Date(bursary.deadline).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    {isUrgent && <p className="text-sm text-warning">{daysUntil} days left!</p>}
                    {isPast && <p className="text-sm text-destructive">Applications closed</p>}
                  </div>
                )}
                <div className="p-4 rounded-lg bg-primary/10">
                  <div className="flex items-center gap-2 text-primary mb-1">
                    <Clock className="w-5 h-5" />
                    <span className="text-sm font-medium">Status</span>
                  </div>
                  <p className="text-lg font-semibold">{isPast ? "Closed" : "Open"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          {bursary.description && (
            <Card>
              <CardHeader>
                <CardTitle>About This Bursary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line">{bursary.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Fields of Study */}
          {bursary.fields_of_study && bursary.fields_of_study.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Eligible Fields of Study
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {bursary.fields_of_study.map((field) => (
                    <Badge key={field} variant="secondary" className="text-sm py-1 px-3">
                      {field}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Requirements */}
          {bursary.requirements && bursary.requirements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {bursary.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-primary">{i + 1}</span>
                      </div>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Apply Button */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">Ready to Apply?</h3>
                  <p className="text-muted-foreground">Visit the official website to submit your application.</p>
                </div>
                {bursary.link && (
                  <Button asChild size="lg" disabled={isPast}>
                    <a href={bursary.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {isPast ? "Applications Closed" : "Apply Now"}
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Related Bursaries */}
          {relatedBursaries.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Related Bursaries</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {relatedBursaries.map((related) => (
                  <Card key={related.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/bursary/${related.id}`)}>
                    <CardContent className="p-4">
                      <div className="h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center mb-3">
                        <img
                          src={related.image_url || getDefaultImage(related.provider)}
                          alt={related.provider}
                          className="max-h-10 max-w-[80px] object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                      <h3 className="font-medium line-clamp-1">{related.name}</h3>
                      <p className="text-sm text-muted-foreground">{related.provider}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BursaryDetail;
