import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Search, Eye, Truck, Clock, CheckCircle, XCircle, FileText, ImageIcon, ShieldCheck, ShieldX } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const statusBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  processing: "default",
  in_transit: "default",
  delivered: "default",
  completed: "default",
  cancelled: "destructive",
};

export const AdminShopOrdersContent = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Payment proofs
  const [proofs, setProofs] = useState<any[]>([]);
  const [proofsLoading, setProofsLoading] = useState(true);
  const [proofDetailOpen, setProofDetailOpen] = useState(false);
  const [selectedProof, setSelectedProof] = useState<any>(null);
  const [proofNote, setProofNote] = useState("");

  useEffect(() => {
    fetchOrders();
    fetchProofs();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("shop_orders" as any)
      .select("*, profiles:user_id(full_name, email, phone)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching shop orders:", error);
      toast.error("Failed to load orders");
    }

    const ordersWithItems = await Promise.all(
      (data || []).map(async (order: any) => {
        const { data: items } = await supabase
          .from("shop_order_items" as any)
          .select("*, products(name, images, price, stores(store_name))")
          .eq("order_id", order.id);
        return { ...order, items: items || [] };
      })
    );

    setOrders(ordersWithItems);
    setIsLoading(false);
  };

  const fetchProofs = async () => {
    setProofsLoading(true);
    const { data, error } = await supabase
      .from("payment_proofs" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Error fetching payment proofs:", error);
    setProofs(data || []);
    setProofsLoading(false);
  };

  const openDetail = (order: any) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setStatusNote("");
    setTrackingNumber(order.tracking_number || "");
    setEstimatedDelivery(order.estimated_delivery || "");
    setDetailOpen(true);
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder || !user) return;
    setIsUpdating(true);

    try {
      const updates: any = {};
      if (newStatus !== selectedOrder.status) updates.status = newStatus;
      if (trackingNumber !== (selectedOrder.tracking_number || "")) updates.tracking_number = trackingNumber || null;
      if (estimatedDelivery !== (selectedOrder.estimated_delivery || "")) updates.estimated_delivery = estimatedDelivery || null;

      if (Object.keys(updates).length === 0) {
        toast.info("No changes to save");
        setIsUpdating(false);
        return;
      }

      updates.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("shop_orders" as any)
        .update(updates)
        .eq("id", selectedOrder.id);

      if (updateError) throw updateError;

      if (newStatus !== selectedOrder.status) {
        await supabase.from("order_status_history").insert({
          order_id: selectedOrder.id,
          status: newStatus,
          note: statusNote || null,
          updated_by: user.id,
        });
      }

      toast.success("Order updated successfully");
      setDetailOpen(false);
      fetchOrders();
    } catch (error: any) {
      const msg = error && typeof error === "object" && "message" in error ? error.message : String(error);
      toast.error(`Failed to update order: ${msg}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApproveProof = async (proof: any) => {
    if (!user) return;
    try {
      // Update proof status
      await supabase
        .from("payment_proofs" as any)
        .update({ status: "approved", reviewed_by: user.id, admin_note: proofNote || null } as any)
        .eq("id", proof.id);

      // Confirm the order
      await supabase
        .from("shop_orders" as any)
        .update({ status: "confirmed", payment_status: "paid", updated_at: new Date().toISOString() } as any)
        .eq("id", proof.order_id);

      // Insert status history
      await supabase.from("order_status_history").insert({
        order_id: proof.order_id,
        status: "confirmed",
        note: "Payment confirmed via proof of payment review",
        updated_by: user.id,
      });

      // Insert payment record
      const order = orders.find(o => o.id === proof.order_id);
      if (order) {
        await supabase.from("payments" as any).insert({
          order_id: proof.order_id,
          amount: Number(order.total_amount),
          payment_method: "card",
          payment_gateway: "yoco",
          payment_status: "completed",
          transaction_reference: proof.reference_number || "manual-approval",
        } as any);
      }

      toast.success("Payment approved and order confirmed");
      setProofDetailOpen(false);
      setProofNote("");
      fetchProofs();
      fetchOrders();
    } catch (err: any) {
      const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
      toast.error(`Failed to approve: ${msg}`);
    }
  };

  const handleRejectProof = async (proof: any) => {
    if (!user) return;
    try {
      await supabase
        .from("payment_proofs" as any)
        .update({ status: "rejected", reviewed_by: user.id, admin_note: proofNote || "Rejected" } as any)
        .eq("id", proof.id);

      toast.success("Proof of payment rejected");
      setProofDetailOpen(false);
      setProofNote("");
      fetchProofs();
    } catch (err: any) {
      const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
      toast.error(`Failed to reject: ${msg}`);
    }
  };

  const filtered = orders.filter((o) => {
    const matchesSearch =
      !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.profiles?.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingProofs = proofs.filter(p => p.status === "pending");

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="proofs" className="relative">
            Payment Proofs
            {pendingProofs.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {pendingProofs.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by order number or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Pending", count: orders.filter((o) => o.status === "pending").length, icon: Clock },
              { label: "Processing", count: orders.filter((o) => ["confirmed", "processing"].includes(o.status)).length, icon: Package },
              { label: "In Transit", count: orders.filter((o) => o.status === "in_transit").length, icon: Truck },
              { label: "Completed", count: orders.filter((o) => ["delivered", "completed"].includes(o.status)).length, icon: CheckCircle },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-3 flex items-center gap-3">
                  <stat.icon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stat.count}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Orders table */}
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No orders found</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{order.profiles?.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{order.profiles?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{order.items?.length || 0} items</TableCell>
                        <TableCell className="font-semibold">R{Number(order.total_amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {order.payment_method === "cod" ? "COD" : order.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant[order.status] || "secondary"} className="capitalize">
                            {order.status?.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openDetail(order)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Payment Proofs Tab */}
        <TabsContent value="proofs" className="space-y-4 mt-4">
          {proofsLoading ? (
            <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : proofs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No payment proofs submitted yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proofs.map((proof: any) => (
                      <TableRow key={proof.id}>
                        <TableCell className="font-mono text-xs">{proof.order_id?.substring(0, 8)}…</TableCell>
                        <TableCell className="text-sm">{proof.reference_number || "—"}</TableCell>
                        <TableCell>
                          {proof.image_url ? (
                            <a href={proof.image_url} target="_blank" rel="noopener noreferrer">
                              <ImageIcon className="w-4 h-4 text-primary" />
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={proof.status === "approved" ? "default" : proof.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                            {proof.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(proof.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          {proof.status === "pending" && (
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedProof(proof); setProofNote(""); setProofDetailOpen(true); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Order Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order #{selectedOrder?.order_number}</DialogTitle>
            <DialogDescription>
              Placed {selectedOrder ? formatDistanceToNow(new Date(selectedOrder.created_at), { addSuffix: true }) : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{selectedOrder.profiles?.full_name}</p>
                <p className="text-xs text-muted-foreground">{selectedOrder.profiles?.email}</p>
                {selectedOrder.profiles?.phone && <p className="text-xs text-muted-foreground">{selectedOrder.profiles.phone}</p>}
                {selectedOrder.delivery_address && <p className="text-xs text-muted-foreground mt-1">📍 {selectedOrder.delivery_address}</p>}
                {selectedOrder.delivery_phone && <p className="text-xs text-muted-foreground">📞 {selectedOrder.delivery_phone}</p>}
              </div>

              {/* Proof of Payment Preview */}
              {selectedOrder.pop_url && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase">Proof of Payment</Label>
                  <a href={selectedOrder.pop_url} target="_blank" rel="noopener noreferrer">
                    <img src={selectedOrder.pop_url} alt="Proof of Payment" className="w-full rounded-lg border max-h-48 object-contain" />
                  </a>
                  {selectedOrder.pop_uploaded_at && (
                    <p className="text-xs text-muted-foreground">
                      Uploaded {formatDistanceToNow(new Date(selectedOrder.pop_uploaded_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">Items</Label>
                {selectedOrder.items?.map((item: any) => (
                  <div key={item.id} className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
                      {item.products?.images?.[0] ? (
                        <img src={item.products.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.products?.name}</p>
                      <p className="text-xs text-muted-foreground">{item.products?.stores?.store_name} · Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold">R{Number(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-bold text-primary">R{Number(selectedOrder.total_amount).toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-3 border-t pt-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.filter((s) => s.value !== "all").map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newStatus !== selectedOrder.status && (
                  <div className="space-y-1.5">
                    <Label>Status Note (optional)</Label>
                    <Textarea placeholder="Add a note..." value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={2} />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Tracking Number</Label>
                  <Input placeholder="e.g. RAM-123456789" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>Estimated Delivery</Label>
                  <Input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} />
                </div>

                <Button onClick={handleUpdateOrder} disabled={isUpdating} className="w-full">
                  {isUpdating ? "Updating..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Proof Detail Dialog */}
      <Dialog open={proofDetailOpen} onOpenChange={setProofDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Payment Proof</DialogTitle>
            <DialogDescription>Order: {selectedProof?.order_id?.substring(0, 8)}…</DialogDescription>
          </DialogHeader>

          {selectedProof && (
            <div className="space-y-4">
              {selectedProof.image_url && (
                <div>
                  <Label className="text-xs text-muted-foreground">Payment Screenshot</Label>
                  <a href={selectedProof.image_url} target="_blank" rel="noopener noreferrer">
                    <img src={selectedProof.image_url} alt="Proof" className="w-full rounded-lg border mt-1 max-h-64 object-contain" />
                  </a>
                </div>
              )}

              {selectedProof.reference_number && (
                <div>
                  <Label className="text-xs text-muted-foreground">Reference Number</Label>
                  <p className="font-mono text-sm mt-1">{selectedProof.reference_number}</p>
                </div>
              )}

              <div>
                <Label>Admin Note (optional)</Label>
                <Textarea placeholder="Add a note..." value={proofNote} onChange={(e) => setProofNote(e.target.value)} rows={2} className="mt-1" />
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleApproveProof(selectedProof)}>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleRejectProof(selectedProof)}>
                  <ShieldX className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminShopOrdersContent;
