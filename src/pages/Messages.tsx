import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const Messages = () => {
  return (
    <DashboardLayout>
      <SEO
        title="Your Messages | ResKonnect"
        description="Communicate with residence administrators and get updates on your applications."
      />
      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Messages</h1>
            <p className="text-muted-foreground">
              Communicate with residence administrators
            </p>
          </div>

          {/* Empty State */}
          <Card className="shadow-card">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Messages Yet</h3>
              <p className="text-muted-foreground mb-6">
                You don\'t have any messages at the moment. Once you apply for a residence, 
                you\'ll be able to communicate with administrators here.
              </p>
              <Button variant="default">Find Residences</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
