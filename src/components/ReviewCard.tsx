import { Star, ThumbsUp, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    title: string;
    content?: string;
    pros?: string[];
    cons?: string[];
    verified_stay?: boolean;
    helpful_count?: number;
    created_at: string;
    user?: {
      full_name?: string;
    };
  };
  onHelpful?: (reviewId: string) => void;
}

const ReviewCard = ({ review, onHelpful }: ReviewCardProps) => {
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "w-4 h-4",
              star <= rating
                ? "fill-warning text-warning"
                : "text-muted-foreground/30"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card/50">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {renderStars(review.rating)}
            {review.verified_stay && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <CheckCircle className="w-3 h-3" />
                Verified Stay
              </Badge>
            )}
          </div>
          <h4 className="font-semibold text-sm">{review.title}</h4>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          <p>{review.user?.full_name || "Anonymous"}</p>
          <p>{formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}</p>
        </div>
      </div>

      {review.content && (
        <p className="text-sm text-muted-foreground mb-3">{review.content}</p>
      )}

      {(review.pros?.length || review.cons?.length) && (
        <div className="grid grid-cols-2 gap-4 mb-3">
          {review.pros && review.pros.length > 0 && (
            <div>
              <p className="text-xs font-medium text-success mb-1">Pros</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {review.pros.map((pro, i) => (
                  <li key={i}>+ {pro}</li>
                ))}
              </ul>
            </div>
          )}
          {review.cons && review.cons.length > 0 && (
            <div>
              <p className="text-xs font-medium text-destructive mb-1">Cons</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {review.cons.map((con, i) => (
                  <li key={i}>- {con}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-xs h-8"
          onClick={() => onHelpful?.(review.id)}
        >
          <ThumbsUp className="w-3 h-3" />
          Helpful ({review.helpful_count || 0})
        </Button>
      </div>
    </div>
  );
};

export default ReviewCard;
