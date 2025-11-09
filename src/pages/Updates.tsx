import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

const Updates = () => {
  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Updates & Announcements</h1>
            <p className="text-muted-foreground">
              Stay updated with the latest news and announcements
            </p>
          </div>

          <Card className="shadow-card">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Newspaper className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Updates Yet</h3>
              <p className="text-muted-foreground">
                Check back later for important updates and announcements
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Updates;
