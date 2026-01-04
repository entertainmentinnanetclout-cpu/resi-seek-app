import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface ProfilePictureUploadProps {
  currentPictureUrl: string | null;
  fullName: string;
  onPictureUpdated: (newUrl: string | null) => void;
}

const ProfilePictureUpload = ({
  currentPictureUrl,
  fullName,
  onPictureUpdated,
}: ProfilePictureUploadProps) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      // Delete old picture if exists
      if (currentPictureUrl) {
        const oldPath = currentPictureUrl.split("/profile-pictures/")[1];
        if (oldPath) {
          await supabase.storage.from("profile-pictures").remove([oldPath]);
        }
      }

      // Upload new picture
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_picture_url: urlData.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      onPictureUpdated(urlData.publicUrl);
      toast.success("Profile picture updated!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload picture");
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePicture = async () => {
    if (!user || !currentPictureUrl) return;

    setIsDeleting(true);

    try {
      // Delete from storage
      const path = currentPictureUrl.split("/profile-pictures/")[1];
      if (path) {
        await supabase.storage.from("profile-pictures").remove([path]);
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({ profile_picture_url: null })
        .eq("id", user.id);

      if (error) throw error;

      onPictureUpdated(null);
      toast.success("Profile picture removed");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Failed to remove picture");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className="w-24 h-24">
          <AvatarImage src={currentPictureUrl || undefined} />
          <AvatarFallback className="text-2xl bg-primary/10 text-primary">
            {fullName?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isDeleting}
        >
          <Camera className="w-4 h-4 mr-2" />
          {currentPictureUrl ? "Change" : "Upload"}
        </Button>

        {currentPictureUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemovePicture}
            disabled={isUploading || isDeleting}
            className="text-destructive hover:text-destructive"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProfilePictureUpload;
