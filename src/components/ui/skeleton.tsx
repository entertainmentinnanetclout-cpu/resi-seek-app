import { cn } from "@/lib/utils";

/**
 * A placeholder for content that is loading.
 *
 * @component
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
