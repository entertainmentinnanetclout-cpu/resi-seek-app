import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Search, Eye, Phone, MessageSquare, Download, Loader2, Package, CheckCircle, Truck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/utils";
import { formatPhoneNumber } from "@/lib/exportHelpers";

interface DiscountOrder {
  id: string;
  user_id: string;
  discount_id: string;
  quantity: number;
  total_price: number;
  status: string;
  delivery_address: string | null;
  phone: string | null;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  discount?: { name: string; provider: string };
  profile?: { full_name: string; email: string; phone: string | null };
}

const orderStatuses = [
  { value: "pending", label: "Pending", color: "secondary", icon: Clock },
  { value: "confirmed", label: "Confirmed", color: "default", icon: CheckCircle },
  { value: "processing", label: "Processing", color: "default", icon: Package },
  { value: "ready", label: "Ready", color: "default", icon: Package },
  { value: "delivered", label: "Delivered", color: "success", icon: Truck },
  { value: "cancelled", label: "Cancelled", color: "destructive", icon: Clock },
];

const AdminDiscountOrders = () => {
  const [orders, setOrders] = useState<DiscountOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<DiscountOrder | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("discount_orders")
        .select(`
          *,
          discount:student_discounts!fk_discount_orders_discount(name, provider)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const ordersWithProfiles = await Promise.all(
        (data || []).map(async (order) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, phone")
            .eq("id", order.user_id)
            .maybeSingle();
          return { ...order, profile } as DiscountOrder;
        })
      );

      setOrders(ordersWithProfiles);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("discount-orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "discount_orders" }, fetchOrders)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("discount_orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;
      toast.success(`Order status updated to ${newStatus}`);
      fetchOrders();
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order");
    }
  };

  const saveAdminNotes = async () => {
    if (!selectedOrder) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("discount_orders")
        .update({ admin_notes: adminNotes })
        .eq("id", selectedOrder.id);

      if (error) throw error;
      toast.success("Notes saved");
      fetchOrders();
      setSelectedOrder(null);
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsApp = (phone: string, name: string) => {
    const formattedPhone = formatPhoneNumber(phone);
    const message = encodeURIComponent(
      `Hi ${name}, this is ResKonnect regarding your discount order. We have an update for you!`
    );
    window.open(`https://wa.me/${formattedPhone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
  };

  const getStatusBadge = (status: string) => {
    const config = orderStatuses.find(s => s.value === status);
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      confirmed: "default",
      processing: "default",
      ready: "default",
      delivered: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{config?.label || status}</Badge>;
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.discount?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: orders.filter(o => o.status === "pending").length,
    processing: orders.filter(o => ["confirmed", "processing", "ready"].includes(o.status)).length,
    delivered: orders.filter(o => o.status === "delivered").length,
    total: orders.reduce((sum, o) => sum + (o.total_price || 0), 0),
  };

  return (
    <AdminLayout>
      <SEO title="Discount Orders | Admin" description="Manage student discount orders" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-8 h-8 text-primary" />
              Discount Orders
            </h1>
            <p className="text-muted-foreground">Manage and track student discount orders</p>
          </div>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Orders
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warning">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.processing}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Truck className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">{stats.delivered}</p>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <ShoppingCart className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">R{stats.total.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer or product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {orderStatuses.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No orders found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.profile?.full_name || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground">{order.phone || order.profile?.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.discount?.name}</p>
                            <p className="text-xs text-muted-foreground">{order.discount?.provider}</p>
                          </div>
                        </TableCell>
                        <TableCell>{order.quantity}</TableCell>
                        <TableCell>R{order.total_price?.toLocaleString()}</TableCell>
                        <TableCell>{safeFormatDate(order.created_at)}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {(order.phone || order.profile?.phone) && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => window.open(`tel:${formatPhoneNumber(order.phone || order.profile?.phone || '')}`, '_self')}
                                >
                                  <Phone className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-green-600"
                                  onClick={() => handleWhatsApp(order.phone || order.profile?.phone || '', order.profile?.full_name || 'Customer')}
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => {
                              setSelectedOrder(order);
                              setAdminNotes(order.admin_notes || "");
                            }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>View and manage this order</DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedOrder.profile?.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedOrder.phone || selectedOrder.profile?.phone || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="font-medium">{selectedOrder.discount?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-medium">R{selectedOrder.total_price?.toLocaleString()}</p>
                </div>
              </div>

              {selectedOrder.delivery_address && (
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Address</p>
                  <p className="font-medium">{selectedOrder.delivery_address}</p>
                </div>
              )}

              {selectedOrder.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Customer Notes</p>
                  <p className="text-sm bg-muted p-2 rounded">{selectedOrder.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Update Status</p>
                <Select value={selectedOrder.status} onValueChange={(value) => updateOrderStatus(selectedOrder.id, value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {orderStatuses.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Admin Notes</p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedOrder(null)} className="flex-1">
                  Close
                </Button>
                <Button onClick={saveAdminNotes} className="flex-1" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Save Notes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const AdminDiscountOrders = () => (
  <AdminLayout><AdminDiscountOrdersContent /></AdminLayout>
);

export default AdminDiscountOrders;
