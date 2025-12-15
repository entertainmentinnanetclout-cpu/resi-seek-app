import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MapPin, DollarSign, Phone, Mail, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { RESKONNECT_WHATSAPP_FORMATTED } from '@/lib/constants';

const amenitiesList = [
  'WiFi', 'Security', 'Study Room', 'Laundry', 'Parking', 'CCTV', 
  'Kitchen', 'Furnished', 'Water Included', 'Electricity Included'
];

const campuses = [
  'TUT Pretoria Campus', 'TUT Soshanguve Campus', 'TUT Ga-Rankuwa Campus',
  'TUT Arcadia Campus', 'TUT Polokwane Campus', 'UP Main Campus',
  'UP Hatfield Campus', 'UNISA', 'Other'
];

const LandlordListingForm = () => {
  const [formData, setFormData] = useState({
    propertyName: '',
    address: '',
    nearestCampus: '',
    distanceFromCampus: '',
    roomType: '',
    price: '',
    capacity: '',
    description: '',
    amenities: [] as string[],
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleAmenityToggle = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Build WhatsApp message
    const message = `
🏠 *New Property Listing Request*

*Property Details:*
📍 Name: ${formData.propertyName}
📍 Address: ${formData.address}
🎓 Nearest Campus: ${formData.nearestCampus}
📏 Distance: ${formData.distanceFromCampus}km
🛏️ Room Type: ${formData.roomType}
💰 Price: R${formData.price}/month
👥 Capacity: ${formData.capacity} students

*Description:*
${formData.description}

*Amenities:*
${formData.amenities.join(', ')}

*Contact Information:*
👤 Name: ${formData.contactName}
📞 Phone: ${formData.contactPhone}
📧 Email: ${formData.contactEmail}
    `.trim();

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${RESKONNECT_WHATSAPP_FORMATTED}?text=${encodedMessage}`;

    // Open WhatsApp
    window.open(whatsappUrl, '_blank');

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      toast.success('Redirecting to WhatsApp to complete your submission!');
    }, 1000);
  };

  if (isSubmitted) {
    return (
      <Card className="max-w-2xl mx-auto card-3d">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">Submission Started!</h3>
          <p className="text-muted-foreground mb-4">
            Complete your listing submission via WhatsApp. Our team will review your property and get back to you within 24-48 hours.
          </p>
          <Button onClick={() => setIsSubmitted(false)} variant="outline">
            Submit Another Property
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto card-3d overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" />
          List Your Property
        </CardTitle>
        <CardDescription>
          Fill out the form below to list your student accommodation on ResKonnect
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Property Details */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2 text-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              Property Details
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="propertyName">Property Name *</Label>
                <Input
                  id="propertyName"
                  required
                  placeholder="e.g., Sunrise Student Res"
                  value={formData.propertyName}
                  onChange={e => setFormData(prev => ({ ...prev, propertyName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nearestCampus">Nearest Campus *</Label>
                <Select
                  value={formData.nearestCampus}
                  onValueChange={value => setFormData(prev => ({ ...prev, nearestCampus: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select campus" />
                  </SelectTrigger>
                  <SelectContent>
                    {campuses.map(campus => (
                      <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Full Address *</Label>
              <Input
                id="address"
                required
                placeholder="Street address, suburb, city"
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="distanceFromCampus">Distance (km)</Label>
                <Input
                  id="distanceFromCampus"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 1.5"
                  value={formData.distanceFromCampus}
                  onChange={e => setFormData(prev => ({ ...prev, distanceFromCampus: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roomType">Room Type *</Label>
                <Select
                  value={formData.roomType}
                  onValueChange={value => setFormData(prev => ({ ...prev, roomType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Room</SelectItem>
                    <SelectItem value="sharing">Sharing Room</SelectItem>
                    <SelectItem value="bachelor">Bachelor Flat</SelectItem>
                    <SelectItem value="1bed">1 Bedroom</SelectItem>
                    <SelectItem value="2bed">2 Bedroom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input
                  id="capacity"
                  type="number"
                  required
                  placeholder="Total students"
                  value={formData.capacity}
                  onChange={e => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2 text-foreground">
              <DollarSign className="w-4 h-4 text-primary" />
              Pricing
            </h4>
            <div className="space-y-2">
              <Label htmlFor="price">Monthly Rent (ZAR) *</Label>
              <Input
                id="price"
                type="number"
                required
                placeholder="e.g., 3500"
                value={formData.price}
                onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Property Description</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Describe your property, nearby facilities, rules, etc."
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Amenities */}
          <div className="space-y-4">
            <Label>Amenities</Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {amenitiesList.map(amenity => (
                <div key={amenity} className="flex items-center space-x-2">
                  <Checkbox
                    id={amenity}
                    checked={formData.amenities.includes(amenity)}
                    onCheckedChange={() => handleAmenityToggle(amenity)}
                  />
                  <Label htmlFor={amenity} className="text-sm cursor-pointer">
                    {amenity}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2 text-foreground">
              <Phone className="w-4 h-4 text-primary" />
              Contact Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Your Name *</Label>
                <Input
                  id="contactName"
                  required
                  placeholder="Full name"
                  value={formData.contactName}
                  onChange={e => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone Number *</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  required
                  placeholder="e.g., 0712345678"
                  value={formData.contactPhone}
                  onChange={e => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={formData.contactEmail}
                  onChange={e => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
            {isSubmitting ? (
              <>Preparing Submission...</>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit via WhatsApp
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By submitting, you agree to our terms. Our team will review and verify your property before listing.
          </p>
        </form>
      </CardContent>
    </Card>
  );
};

export default LandlordListingForm;
