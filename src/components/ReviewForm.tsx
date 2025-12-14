import { useState } from "react";
import { Star, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ReviewFormProps {
  residenceId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ReviewForm = ({ residenceId, onSuccess, onCancel }: ReviewFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [newPro, setNewPro] = useState("");
  const [newCon, setNewCon] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to submit a review",
        variant: "destructive",
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a star rating",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please add a title for your review",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("reviews").insert({
        user_id: user.id,
        residence_id: residenceId,
        rating,
        title: title.trim(),
        content: content.trim() || null,
        pros: pros.length > 0 ? pros : null,
        cons: cons.length > 0 ? cons : null,
      });

      if (error) throw error;

      toast({
        title: "Review submitted",
        description: "Thank you for your feedback!",
      });
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not submit review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPro = () => {
    if (newPro.trim() && pros.length < 5) {
      setPros([...pros, newPro.trim()]);
      setNewPro("");
    }
  };

  const addCon = () => {
    if (newCon.trim() && cons.length < 5) {
      setCons([...cons, newCon.trim()]);
      setNewCon("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Star Rating */}
      <div>
        <Label className="mb-2 block">Your Rating *</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "w-8 h-8 transition-colors",
                  star <= (hoverRating || rating)
                    ? "fill-warning text-warning"
                    : "text-muted-foreground/30"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <Label htmlFor="title">Review Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience"
          maxLength={100}
        />
      </div>

      {/* Content */}
      <div>
        <Label htmlFor="content">Your Review</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share more details about your stay..."
          rows={4}
        />
      </div>

      {/* Pros */}
      <div>
        <Label>Pros (optional)</Label>
        <div className="flex gap-2 mb-2">
          <Input
            value={newPro}
            onChange={(e) => setNewPro(e.target.value)}
            placeholder="What did you like?"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPro())}
          />
          <Button type="button" size="icon" variant="outline" onClick={addPro}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {pros.map((pro, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success text-xs rounded-full"
            >
              {pro}
              <button type="button" onClick={() => setPros(pros.filter((_, j) => j !== i))}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Cons */}
      <div>
        <Label>Cons (optional)</Label>
        <div className="flex gap-2 mb-2">
          <Input
            value={newCon}
            onChange={(e) => setNewCon(e.target.value)}
            placeholder="What could be improved?"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCon())}
          />
          <Button type="button" size="icon" variant="outline" onClick={addCon}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {cons.map((con, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 bg-destructive/10 text-destructive text-xs rounded-full"
            >
              {con}
              <button type="button" onClick={() => setCons(cons.filter((_, j) => j !== i))}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </Button>
      </div>
    </form>
  );
};

export default ReviewForm;
