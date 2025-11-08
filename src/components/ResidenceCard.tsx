import { MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * ResidenceCard component - Displays a single residence listing with its details and actions.
 *
 * @component
 * @param {Object} props - Component props.
 * @param {Object} props.residence - The residence object to display.
 * @param {() => void} props.onViewMore - Function to handle the "View More" action.
 * @param {() => void} props.onApply - Function to handle the "Apply Now" action.
 * @returns {JSX.Element} The rendered residence card or a skeleton loader if no residence is provided.
 */
const ResidenceCard = ({ residence, onViewMore, onApply }) => {
  if (!residence) {
    return (
      <Card className="shadow-card">
        <Skeleton className="w-full h-48" />
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="flex items-center justify-between pt-4 border-t">
            <Skeleton className="h-8 w-1/3" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card key={residence.id} className="shadow-card hover:shadow-hover transition-smooth">
      <Carousel>
        <CarouselContent>
          {residence.images.map((image, index) => (
            <CarouselItem key={index}>
              <img src={image} alt={residence.title} className="w-full h-48 object-cover" />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      <CardHeader>
        <CardTitle>{residence.title}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {residence.location}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{residence.description}</p>

        <div className="flex flex-wrap gap-2">
          {residence.amenities.map((amenity) => (
            <Button
              key={amenity}
              variant="outline"
              className="text-xs px-3 py-1 bg-transparent border-yellow-500/50 text-yellow-500 rounded-full hover:bg-yellow-500/10 hover:shadow-glow"
            >
              {amenity}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            <p className="text-2xl font-bold text-primary">{residence.price}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onViewMore(residence)}
          >
            View More
          </Button>
          <Button
            variant="accent"
            className="flex-1"
            onClick={() => onApply(residence)}
          >
            Apply Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResidenceCard;
