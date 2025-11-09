import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Briefcase, AlertCircle, Info } from "lucide-react";

const Updates = () => {
  const updates = [
    {
      id: 1,
      type: "news",
      title: "New Residence Added: Brooklyn Heights",
      content: "We've just added a new premium residence in Brooklyn. Check it out in Find My Res!",
      date: "2025-10-10",
      icon: Info
    },
    {
      id: 2,
      type: "job",
      title: "Part-Time Campus Job Available",
      content: "Student assistant position open at the library. 15 hours/week, flexible schedule.",
      date: "2025-10-09",
      icon: Briefcase
    },
    {
      id: 3,
      type: "alert",
      title: "Application Deadline Approaching",
      content: "Reminder: Applications for first semester 2026 close on October 31st.",
      date: "2025-10-08",
      icon: AlertCircle
    },
    {
      id: 4,
      type: "news",
      title: "Campus Safety Workshop",
      content: "Join us for a campus safety and security workshop on October 15th at 14:00.",
      date: "2025-10-07",
      icon: Info
    }
  ];

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "news":
        return <Badge variant="secondary">News</Badge>;
      case "job":
        return <Badge className="bg-success/10 text-success border-success/20">Job</Badge>;
      case "alert":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Alert</Badge>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Updates & Notifications</h1>
            <p className="text-muted-foreground">
              Stay informed about campus news, job opportunities, and important alerts
            </p>
          </div>

          {/* Updates List */}
          <div className="space-y-4">
            {updates.map((update) => {
              const Icon = update.icon;
              return (
                <Card key={update.id} className="shadow-card hover:shadow-hover transition-smooth">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg">{update.title}</CardTitle>
                            {getTypeBadge(update.type)}
                          </div>
                          <CardDescription>
                            {new Date(update.date).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{update.content}</p>
                  </CardContent>
                </Card>
                );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Updates;
