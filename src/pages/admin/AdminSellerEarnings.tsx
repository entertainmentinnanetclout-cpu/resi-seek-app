import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Store, Percent, Save } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const StoreFeeRow = ({ store, defaultFee, onSave }: { store: any; defaultFee: string; onSave: (id: string, fee: string) => void }) => {
  const [localFee, setLocalFee] = useState(
    store.custom_fee_percentage != null ? String(store.custom_fee_percentage) : ""
  );
  return (
    <TableRow>
      <TableCell className="font-medium">{store.store_name}</TableCell>
      <TableCell>
        {store.verified ? <Badge variant="default">Verified</Badge> : <Badge variant="secondary">Unverified</Badge>}
      </TableCell>
      <TableCell>
        <Input type="number" min="0" max="100" step="0.5" placeholder={defaultFee} value={localFee} onChange={(e) => setLocalFee(e.target.value)} className="w-24" />
      </TableCell>
      <TableCell>
        <Button size="sm" variant="outline" onClick={() => onSave(store.id, localFee)}>Set</Button>
      </TableCell>
    </TableRow>
  );
};

  const { user } = useAuth();
  const [earnings, setEarnings] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultFee, setDefaultFee] = useState("10");
  const [isSavingFee, setIsSavingFee] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);

    const [earningsRes, storesRes, settingsRes] = await Promise.all([
      supabase
        .from("seller_earnings" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("stores")
        .select("id, store_name, custom_fee_percentage, user_id, is_active, verified")
        .order("store_name"),
      supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "default_fee_percentage")
        .maybeSingle(),
    ]);

    setEarnings((earningsRes.data as any[]) || []);
    setStores(storesRes.data || []);
    if (settingsRes.data?.value) {
      setDefaultFee(String(settingsRes.data.value));
    }
    setIsLoading(false);
  };

  const handleSaveDefaultFee = async () => {
    setIsSavingFee(true);
    try {
      const { error } = await supabase
        .from("platform_settings")
        .upsert({
          key: "default_fee_percentage",
          value: Number(defaultFee) as any,
          description: "Default platform commission percentage",
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });

      if (error) throw error;
      toast.success("Default fee updated");
    } catch (err: any) {
      const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
      toast.error(`Failed: ${msg}`);
    } finally {
      setIsSavingFee(false);
    }
  };

  const handleUpdateStoreFee = async (storeId: string, fee: string) => {
    try {
      const { error } = await supabase
        .from("stores")
        .update({ custom_fee_percentage: fee ? Number(fee) : null } as any)
        .eq("id", storeId);

      if (error) throw error;
      toast.success("Store fee updated");
      fetchData();
    } catch (err: any) {
      const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
      toast.error(`Failed: ${msg}`);
    }
  };

  const totalPlatformRevenue = earnings.reduce((sum, e) => sum + Number(e.platform_fee || 0), 0);
  const totalGross = earnings.reduce((sum, e) => sum + Number(e.gross_amount || 0), 0);
  const totalSellerNet = earnings.reduce((sum, e) => sum + Number(e.net_amount || 0), 0);

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">R{totalGross.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Gross Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold">R{totalPlatformRevenue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Platform Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Store className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">R{totalSellerNet.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total Seller Earnings</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Default Fee Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5" />
            Platform Fee Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Default Fee (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={defaultFee}
                onChange={(e) => setDefaultFee(e.target.value)}
                className="w-32"
              />
            </div>
            <Button onClick={handleSaveDefaultFee} disabled={isSavingFee} size="sm">
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Applied to all stores without a custom fee override.
          </p>
        </CardContent>
      </Card>

      {/* Per-Store Fee Overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Store Fee Overrides</CardTitle>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No stores yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Custom Fee (%)</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <StoreFeeRow
                    key={store.id}
                    store={store}
                    defaultFee={defaultFee}
                    onSave={handleUpdateStoreFee}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Earnings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No earnings recorded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Fee %</TableHead>
                  <TableHead>Platform Fee</TableHead>
                  <TableHead>Seller Net</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.order_id?.substring(0, 8)}…</TableCell>
                    <TableCell>R{Number(e.gross_amount).toFixed(2)}</TableCell>
                    <TableCell>{Number(e.fee_percentage).toFixed(1)}%</TableCell>
                    <TableCell className="text-green-600 font-medium">R{Number(e.platform_fee).toFixed(2)}</TableCell>
                    <TableCell>R{Number(e.net_amount).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const AdminSellerEarnings = () => {
  return <AdminSellerEarningsContent />;
};

export default AdminSellerEarnings;
