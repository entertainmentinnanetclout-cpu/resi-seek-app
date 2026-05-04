import { useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Users, Package } from "lucide-react";
import { ResKonnectStoreManager } from "@/components/admin/ResKonnectStoreManager";
import { StudentListingsModeration } from "@/components/admin/StudentListingsModeration";
import AdminProductsModeration from "@/components/admin/AdminProductsModeration";

export const AdminMarketplaceContent = () => {
  const [activeTab, setActiveTab] = useState("store");

  return (
    <>
      <SEO title="Marketplace | Admin" description="Manage products and moderate student listings" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground">Manage the ResKonnect Store and moderate student listings</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="store" className="gap-1.5">
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">ResKonnect Store</span>
            </TabsTrigger>
            <TabsTrigger value="listings" className="gap-1.5">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Student Listings</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">All Products</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="store">
            <ResKonnectStoreManager />
          </TabsContent>
          <TabsContent value="listings">
            <StudentListingsModeration />
          </TabsContent>
          <TabsContent value="products">
            <AdminProductsModeration />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

const AdminMarketplace = () => (
  <AdminLayout>
    <AdminMarketplaceContent />
  </AdminLayout>
);

export default AdminMarketplace;
