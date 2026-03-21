import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const AdminSettingsContent = () => {
  const handleSave = () => {
    toast.success("Settings saved successfully");
  };

  return (
    <>
      <SEO title="Platform Settings | Admin" description="Configure platform settings" />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure platform settings and preferences</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic platform configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Platform Name</Label>
                <Input defaultValue="ResKonnect" />
              </div>
              <div className="space-y-2">
                <Label>Support Email</Label>
                <Input defaultValue="Reskonnect@gmail.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Support Phone</Label>
                <Input defaultValue="063 732 3192" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp Number (for integrations)</Label>
                <Input defaultValue="27637323192" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feature Toggles</CardTitle>
              <CardDescription>Enable or disable platform features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Marketplace</Label>
                  <p className="text-sm text-muted-foreground">Allow students to buy/sell items</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Roommate Finder</Label>
                  <p className="text-sm text-muted-foreground">Enable roommate matching feature</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Events Calendar</Label>
                  <p className="text-sm text-muted-foreground">Show campus events</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Bursary Finder</Label>
                  <p className="text-sm text-muted-foreground">Show bursary opportunities</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Student Discounts</Label>
                  <p className="text-sm text-muted-foreground">Show student discount directory</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
              <CardDescription>Search engine optimization configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Meta Title</Label>
                <Input defaultValue="Find Student Accommodation in South Africa | ResKonnect" />
              </div>
              <div className="space-y-2">
                <Label>Default Meta Description</Label>
                <Textarea 
                  defaultValue="ResKonnect helps South African students find verified, affordable student accommodation near universities in Pretoria, Tshwane & Gauteng."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Default Keywords</Label>
                <Input defaultValue="student accommodation, Pretoria, TUT residence, NSFAS approved" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analytics & Tracking</CardTitle>
              <CardDescription>Configure analytics integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Google Analytics ID</Label>
                <Input placeholder="G-XXXXXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label>Facebook Pixel ID</Label>
                <Input placeholder="1234567890" />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      </div>
    </>
  );
};

const AdminSettings = () => (
  <AdminLayout><AdminSettingsContent /></AdminLayout>
);

export default AdminSettings;
