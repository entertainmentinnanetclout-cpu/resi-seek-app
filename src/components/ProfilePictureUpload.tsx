import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image file (JPG, PNG, WebP, or GIF)");
      resetInput();
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      resetInput();
      return;
    }

    // If there's an existing picture, show confirmation dialog
    if (currentPictureUrl) {
      setPendingFile(file);
      setReplaceDialogOpen(true);
    } else {
      // Direct upload
      await uploadPicture(file);
    }
  };

  const resetInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadPicture = async (file: File, isReplacement = false) => {
    if (!user) return;

    setIsUploading(true);
    setUploadProgress(10);

    const toastId = toast.loading(
      isReplacement ? "Replacing profile picture..." : "Uploading profile picture...",
      { description: file.name }
    );

    try {
      // If replacing, delete old file first
      if (isReplacement && currentPictureUrl) {
        const oldPath = currentPictureUrl.split("/profile-pictures/")[1];
        if (oldPath) {
          await supabase.storage.from("profile-pictures").remove([oldPath]);
        }
      }

      setUploadProgress(30);

      // Upload new file
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setUploadProgress(70);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(filePath);

      // Update profile in database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_picture_url: urlData.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setUploadProgress(100);

      onPictureUpdated(urlData.publicUrl);
      toast.success(
        isReplacement ? "Profile picture replaced!" : "Profile picture uploaded!",
        { id: toastId, description: "Your avatar has been updated" }
      );
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Upload failed", {
        id: toastId,
        description: error.message || "Please try again",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      resetInput();
    }
  };

  const handleConfirmReplace = async () => {
    if (pendingFile) {
      await uploadPicture(pendingFile, true);
    }
    setReplaceDialogOpen(false);
    setPendingFile(null);
  };

  const handleCancelReplace = () => {
    setReplaceDialogOpen(false);
    setPendingFile(null);
    resetInput();
  };

  const handleRemovePicture = async () => {
    if (!user || !currentPictureUrl) return;

    setIsDeleting(true);
    const toastId = toast.loading("Removing profile picture...");

    try {
      // Delete from storage
      const path = currentPictureUrl.split("/profile-pictures/")[1];
      if (path) {
        await supabase.storage.from("profile-pictures").remove([path]);
      }

      // Update profile in database
      const { error } = await supabase
        .from("profiles")
        .update({ profile_picture_url: null })
        .eq("id", user.id);

      if (error) throw error;

      onPictureUpdated(null);
      toast.success("Profile picture removed", { id: toastId });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Failed to remove picture", {
        id: toastId,
        description: error.message || "Please try again",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className="w-24 h-24 border-2 border-primary/20">
          <AvatarImage src={currentPictureUrl || undefined} alt="Profile picture" />
          <AvatarFallback className="text-2xl bg-primary/10 text-primary">
            {fullName?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Progress bar during upload */}
      {isUploading && (
        <div className="w-full max-w-[200px]">
          <Progress value={uploadProgress} className="h-1" />
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading || isDeleting}
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isDeleting}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Camera className="w-4 h-4 mr-2" />
          )}
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

      {/* Replace Confirmation Dialog */}
      <AlertDialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Profile Picture?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a profile picture. Replacing it will permanently delete 
              the existing image. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReplace}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace}>
              Replace Picture
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfilePictureUpload;