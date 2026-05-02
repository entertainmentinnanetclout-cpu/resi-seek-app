import { useState, useEffect } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Store, ShieldCheck, ShieldX, Eye, Trash2, Star, Ban, CheckCircle2, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";

interface StoreData {
  id: string;
  store_name: string;
  store_description: string | null;
  store_logo_url: string | null;
  campus: string | null;
  is_active: boolean;
  verified: boolean;
  total_sales: number;
  rating: number;
  created_at: string;
  user_id: string;
  is_suspended?: boolean;
  founding_seller?: boolean;
  owner?: {
    full_name: string;
    email: string;
  } | null;
  listings_count?: number;
}

export const AdminStoresContent = () => {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch owner info and listing counts
      const storesWithData = await Promise.all(
        (data || []).map(async (store) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", store.user_id)
            .maybeSingle();

          const { count } = await supabase
            .from("marketplace_listings")
            .select("*", { count: "exact", head: true })
            .eq("store_id", store.id);

          return { ...store, owner: profile, listings_count: count || 0 };
        })
      );

      setStores(storesWithData);
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast.error("Failed to load stores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const updateStore = async (id: string, updates: Partial<StoreData>) => {
    try {
      const { error } = await supabase
        .from("stores")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      toast.success("Store updated");
      fetchStores();
    } catch (error) {
      toast.error("Failed to update store");
    }
  };

  const handleDeleteStore = async () => {
    if (!deleteStoreId) return;

    try {
      const { error } = await supabase
        .from("stores")
        .delete()
        .eq("id", deleteStoreId);

      if (error) throw error;
      toast.success("Store deleted");
      fetchStores();
    } catch (error: any) {
      toast.error("Failed to delete store");
    } finally {
      setDeleteStoreId(null);
    }
  };

  const filteredStores = stores.filter((store) => {
    const matchesSearch =
      store.store_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.owner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.owner?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "verified" && store.verified) ||
      (statusFilter === "unverified" && !store.verified) ||
      (statusFilter === "active" && store.is_active) ||
      (statusFilter === "inactive" && !store.is_active);
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: stores.length,
    verified: stores.filter((s) => s.verified).length,
    active: stores.filter((s) => s.is_active).length,
    totalListings: stores.reduce((sum, s) => sum + (s.listings_count || 0), 0),
  };

  return (
    <>
      <SEO title="Store Management | Admin" description="Manage marketplace stores" />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Store Management</h1>
          <p className="text-muted-foreground">Manage and verify marketplace stores</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Stores</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{stats.verified}</p>
              <p className="text-sm text-muted-foreground">Verified</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.active}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{stats.totalListings}</p>
              <p className="text-sm text-muted-foreground">Total Listings</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by store name or owner..."
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
                  <SelectItem value="all">All Stores</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : filteredStores.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No stores found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Campus</TableHead>
                      <TableHead>Listings</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStores.map((store) => (
                      <TableRow key={store.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {store.store_logo_url ? (
                              <img
                                src={store.store_logo_url}
                                alt={store.store_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Store className="w-5 h-5 text-primary" />
                              </div>
                            )}
                            <span className="font-medium">{store.store_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{store.owner?.full_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{store.owner?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{store.campus || "-"}</TableCell>
                        <TableCell>{store.listings_count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            {store.rating?.toFixed(1) || "0.0"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={store.is_active ? "default" : "secondary"}>
                              {store.is_active ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant={store.verified ? "default" : "destructive"}>
                              {store.verified ? "Verified" : "Unverified"}
                            </Badge>
                            {store.is_suspended && (
                              <Badge variant="destructive">Suspended</Badge>
                            )}
                            {store.founding_seller && (
                              <Badge className="bg-amber-500"><Award className="w-3 h-3 mr-1" />Founding</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(store.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateStore(store.id, { verified: !store.verified })
                              }
                              title={store.verified ? "Unverify" : "Verify"}
                            >
                              {store.verified ? (
                                <ShieldX className="w-4 h-4 text-orange-500" />
                              ) : (
                                <ShieldCheck className="w-4 h-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStore(store.id, { is_suspended: !store.is_suspended } as any)}
                              title={store.is_suspended ? "Unsuspend" : "Suspend"}
                            >
                              {store.is_suspended ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <Ban className="w-4 h-4 text-destructive" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStore(store.id, { founding_seller: !store.founding_seller } as any)}
                              title={store.founding_seller ? "Remove founding badge" : "Mark as founding seller"}
                            >
                              <Award className={`w-4 h-4 ${store.founding_seller ? "text-amber-500" : "text-muted-foreground"}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(`/store/${store.id}`, "_blank")}
                              title="View Store"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteStoreId(store.id)}
                              title="Delete Store"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteStoreId} onOpenChange={() => setDeleteStoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Store?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this store and all its listings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStore}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const AdminStores = () => (
  <AdminLayout><AdminStoresContent /></AdminLayout>
);

export default AdminStores;
