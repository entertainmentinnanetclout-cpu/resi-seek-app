import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ResidenceImageSlideshowProps {
  mainImage: string | null;
  images: string[] | null;
  alt: string;
  autoPlay?: boolean;
  interval?: number;
}

const ResidenceImageSlideshow = ({ 
  mainImage, 
  images, 
  alt, 
  autoPlay = true, 
  interval = 4000 
}: ResidenceImageSlideshowProps) => {
  // Combine main image with gallery images
  const allImages = [
    mainImage || '/placeholder.svg',
    ...(images || [])
  ].filter(Boolean);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  
  const hasMultipleImages = allImages.length > 1;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % allImages.length);
  }, [allImages.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  }, [allImages.length]);

  // Auto-play slideshow when hovered
  useEffect(() => {
    if (!autoPlay || !hasMultipleImages || !isHovered) return;
    
    const timer = setInterval(nextSlide, interval);
    return () => clearInterval(timer);
  }, [autoPlay, hasMultipleImages, isHovered, interval, nextSlide]);

  return (
    <div 
      className="relative w-full h-full overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setCurrentIndex(0); // Reset to main image when leaving
      }}
    >
      {/* Images */}
      <div 
        className="flex transition-transform duration-500 ease-out h-full"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {allImages.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt={`${alt} ${idx + 1}`}
            className="w-full h-full object-cover flex-shrink-0"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
        ))}
      </div>

      {/* Navigation arrows (only show on hover when there are multiple images) */}
      {hasMultipleImages && isHovered && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-all opacity-80 hover:opacity-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-all opacity-80 hover:opacity-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {hasMultipleImages && isHovered && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {allImages.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                idx === currentIndex 
                  ? 'bg-white w-3' 
                  : 'bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}

      {/* Image count badge */}
      {hasMultipleImages && !isHovered && (
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
          1/{allImages.length}
        </div>
      )}
    </div>
  );
};

export default ResidenceImageSlideshow;