import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Briefcase, AlertCircle, Info, Users, FileText, CheckCheck, Loader2 } from "lucide-react";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { formatDistanceToNow } from "date-fns";

const Updates = () => {
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useRealtimeNotifications();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "application_status":
        return FileText;
      case "new_roommate":
      case "roommate_match":
        return Users;
      case "job":
        return Briefcase;
      case "alert":
        return AlertCircle;
      default:
        return Info;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "application_status":
        return <Badge variant="default">Application</Badge>;
      case "new_roommate":
        return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">Roommate</Badge>;
      case "roommate_match":
        return <Badge className="bg-success/10 text-success border-success/20">Match</Badge>;
      case "job":
        return <Badge className="bg-success/10 text-success border-success/20">Job</Badge>;
      case "alert":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Alert</Badge>;
      case "system":
        return <Badge variant="secondary">System</Badge>;
      default:
        return <Badge variant="secondary">News</Badge>;
    }
  };

  // Fallback mock data when no notifications exist
  const mockUpdates = [
    {
      id: "mock-1",
      type: "news",
      title: "Welcome to ResKonnect!",
      message: "Start your accommodation search by visiting Find My Res. Complete your profile to get started with applications.",
      created_at: new Date().toISOString(),
      is_read: true,
      user_id: "",
      metadata: {},
    },
    {
      id: "mock-2",
      type: "alert",
      title: "Complete Your Profile",
      message: "Upload your documents and fill in your details to start applying for residences.",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      is_read: true,
      user_id: "",
      metadata: {},
    },
  ];

  const displayNotifications = notifications.length > 0 ? notifications : mockUpdates;

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Updates & Notifications</h1>
              <p className="text-muted-foreground">
                Stay informed about your applications, roommate matches, and more
              </p>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all read ({unreadCount})
              </Button>
            )}
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            /* Updates List */
            <div className="space-y-4">
              {displayNotifications.map((notification) => {
                const Icon = getTypeIcon(notification.type);
                return (
                  <Card 
                    key={notification.id} 
                    className={`shadow-card hover:shadow-hover transition-smooth cursor-pointer ${
                      !notification.is_read ? 'border-primary/50 bg-primary/5' : ''
                    }`}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            !notification.is_read ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                          }`}>
                            <Icon className={`w-6 h-6 ${notification.is_read ? 'text-primary' : ''}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <CardTitle className="text-lg">{notification.title}</CardTitle>
                              {getTypeBadge(notification.type)}
                              {!notification.is_read && (
                                <Badge variant="default" className="text-xs">New</Badge>
                              )}
                            </div>
                            <CardDescription>
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{notification.message}</p>
                    </CardContent>
                  </Card>
                );
              })}

              {displayNotifications.length === 0 && (
                <Card className="py-12">
                  <CardContent className="text-center">
                    <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No notifications yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You'll receive updates about your applications and matches here
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Updates;