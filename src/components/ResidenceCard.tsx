import { MapPin, ShieldCheck, GraduationCap, ArrowRight, Eye, Bookmark, Share2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const ResidenceCard = ({ residence, onViewMore, onApply }) => {
  if (!residence) {
    return (
      <Card className="shadow-card overflow-hidden border border-slate-200">
        <Skeleton className="w-full h-52" />
        <CardHeader className="p-5">
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Skeleton className="h-8 w-1/3" />
          </div>
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const allImages = [residence.image_url, ...(residence.images || [])].filter(Boolean);
  const priceFormatted = typeof residence.price === "number"
    ? `R${residence.price.toLocaleString()}`
    : residence.price;

  return (
    <Card className="group flex flex-col h-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      {/* Visual Header / Carousel Container */}
      <div className="relative overflow-hidden aspect-[16/10] shrink-0 bg-slate-100">
        <Carousel className="w-full h-full">
          <CarouselContent className="h-full m-0">
            {allImages.map((image, index) => (
              <CarouselItem key={index} className="h-full p-0">
                <img
                  src={image}
                  alt={residence.name || residence.title}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {allImages.length > 1 && (
            <>
              <CarouselPrevious className="left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 border-none h-8 w-8 text-[#071326]" />
              <CarouselNext className="right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 border-none h-8 w-8 text-[#071326]" />
            </>
          )}
        </Carousel>

        {/* Highlight Badges on Image */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {residence.is_trusted && (
            <Badge className="bg-[#12A870] text-white font-bold text-[10px] tracking-wider py-1 px-2.5 shadow-sm uppercase flex items-center gap-1.5 border-none">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              Verified ✓
            </Badge>
          )}
          {residence.accepts_tvet && (
            <Badge className="bg-[#F5B32F] text-[#071326] font-extrabold text-[10px] tracking-wider py-1 px-2.5 shadow-sm uppercase flex items-center gap-1 border-none">
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              TVET Approved
            </Badge>
          )}
        </div>

        {/* Distance Badge */}
        {residence.distance_from_campus !== undefined && (
          <div className="absolute bottom-3 right-3 z-10 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold tracking-wider px-2 py-1 rounded-md uppercase">
            {residence.distance_from_campus}km from campus
          </div>
        )}
      </div>

      {/* Main Card Content */}
      <div className="flex-1 flex flex-col p-5">
        <div className="flex-1 space-y-3.5">
          {/* Card Title & Location */}
          <div className="space-y-1">
            <h3 className="font-bold text-lg text-[#071326] line-clamp-1 group-hover:text-[#2563EB] transition-colors">
              {residence.name || residence.title}
            </h3>
            <div className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-[#2563EB]" />
              <span className="text-xs font-semibold line-clamp-1">{residence.address || residence.location}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
            {residence.description || "Premium accommodation offering single and sharing configurations close to institutional transport routes."}
          </p>

          {/* Amenities Button Grid */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(residence.amenities || []).slice(0, 3).map((amenity) => (
              <span
                key={amenity}
                className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-150 rounded-full px-2.5 py-1 uppercase tracking-wider"
              >
                {amenity}
              </span>
            ))}
            {(residence.amenities || []).length > 3 && (
              <span className="text-[10px] font-bold text-[#2563EB] bg-blue-50 border border-blue-100 rounded-full px-2 py-1 uppercase tracking-wider">
                +{(residence.amenities || []).length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Rent & Action Section */}
        <div className="pt-4 mt-4 border-t border-slate-100 space-y-3 shrink-0">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Rent</span>
            <span className="text-lg font-black text-[#2563EB]">
              {priceFormatted}
              <span className="text-xs font-semibold text-slate-400">/mo</span>
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs h-9"
              onClick={() => onViewMore(residence)}
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" /> View Details
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 bg-[#2563EB] hover:bg-[#2F6EDB] text-white font-bold text-xs h-9"
              onClick={() => onApply(residence)}
            >
              Apply Now <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ResidenceCard;
