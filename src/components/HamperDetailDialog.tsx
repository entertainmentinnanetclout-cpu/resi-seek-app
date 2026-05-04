import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Package, ShoppingCart, X } from "lucide-react";
import ShareButton from "@/components/ShareButton";

interface BundleItem { id: string; item_name: string; quantity: number }
interface Hamper {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  category?: string | null;
  stock_quantity?: number | null;
  hamper_bundle_items?: BundleItem[];
}

interface Props {
  hamper: Hamper | null;
  open: boolean;
  onClose: () => void;
  onOrder: (h: Hamper) => void;
}

const HamperDetailDialog = ({ hamper, open, onClose, onOrder }: Props) => {
  if (!hamper) return null;
  const items = hamper.hamper_bundle_items || [];
  const outOfStock = (hamper.stock_quantity ?? 0) <= 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            {hamper.name}
          </DialogTitle>
          <DialogDescription>
            {hamper.description || "Student care hamper bundle."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hamper.image_url && (
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
              <img src={hamper.image_url} alt={hamper.name} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary">R{Number(hamper.price).toFixed(2)}</p>
              {hamper.category && (
                <Badge variant="secondary" className="mt-1 capitalize">{hamper.category}</Badge>
              )}
            </div>
            <ShareButton type="hamper" id={hamper.id} title={hamper.name} text={hamper.description || hamper.name} />
          </div>

          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Package className="w-4 h-4" /> What's inside ({items.length} {items.length === 1 ? "item" : "items"})
            </h4>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items listed for this bundle yet.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                    <span>{it.item_name}</span>
                    <Badge variant="outline">×{it.quantity}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              <X className="w-4 h-4 mr-2" /> Close
            </Button>
            <Button onClick={() => onOrder(hamper)} disabled={outOfStock} className="flex-1">
              <ShoppingCart className="w-4 h-4 mr-2" /> {outOfStock ? "Out of Stock" : "Order Now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HamperDetailDialog;