import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, CheckCircle2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: Save to backend
    toast.success("Profile updated successfully!");
    setIsEditing(false);
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Profile</h1>
              <p className="text-muted-foreground">
                Manage your personal information and documents
              </p>
            </div>
            {!isEditing && (
              <Button variant="default" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>

          {/* Profile Picture */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>Update your profile photo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    <UserIcon className="w-12 h-12" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    JPG, PNG or GIF. Max size 2MB
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your student details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Full Name
                    </label>
                    <Input 
                      defaultValue="John Doe" 
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Student Number
                    </label>
                    <Input 
                      defaultValue="u12345678" 
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Email Address
                    </label>
                    <Input 
                      type="email"
                      defaultValue="john@student.ac.za" 
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Phone Number
                    </label>
                    <Input 
                      type="tel"
                      defaultValue="+27 12 345 6789" 
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Campus
                    </label>
                    <Select disabled={!isEditing} defaultValue="hatfield">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hatfield">Hatfield Campus</SelectItem>
                        <SelectItem value="mamelodi">Mamelodi Campus</SelectItem>
                        <SelectItem value="sunnyside">Sunnyside Campus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Course
                    </label>
                    <Input 
                      defaultValue="Computer Science" 
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Year of Study
                    </label>
                    <Select disabled={!isEditing} defaultValue="2">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex gap-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      variant="accent"
                      className="flex-1"
                    >
                      Save Changes
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Uploaded Documents</CardTitle>
              <CardDescription>Your verified documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <div>
                    <p className="font-medium">ID Copy</p>
                    <p className="text-sm text-muted-foreground">Uploaded on Oct 1, 2025</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Replace
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <div>
                    <p className="font-medium">Proof of Registration</p>
                    <p className="text-sm text-muted-foreground">Uploaded on Oct 1, 2025</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Replace
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <div>
                    <p className="font-medium">Proof of Funding</p>
                    <p className="text-sm text-muted-foreground">Uploaded on Oct 1, 2025</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Replace
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
