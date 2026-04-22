import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, Store, Percent, ShoppingCart, Gift, Truck, DollarSign, LayoutGrid } from "lucide-react";
import { AdminMarketplaceContent } from "./AdminMarketplace";
import { AdminStoresContent } from "./AdminStores";
import { AdminDiscountsContent } from "./AdminDiscounts";
import { AdminDiscountOrdersContent } from "./AdminDiscountOrders";
import { AdminHamperItemsContent } from "./AdminHamperItems";
import { AdminHamperBundlesContent } from "./AdminHamperBundles";
import { AdminShopOrdersContent } from "./AdminShopOrders";
import { AdminSellerEarningsContent } from "./AdminSellerEarnings";
import { AdminCategoriesContent } from "./AdminCategories";

const tabs = [
  { value: "marketplace", label: "Marketplace", icon: ShoppingBag },
  { value: "stores", label: "Stores", icon: Store },
  { value: "shop-orders", label: "Shop Orders", icon: Truck },
  { value: "categories", label: "Categories", icon: LayoutGrid },
  { value: "discounts", label: "Discounts", icon: Percent },
  { value: "discount-orders", label: "Discount Orders", icon: ShoppingCart },
  { value: "hamper-bundles", label: "Hamper Bundles", icon: Gift },
  { value: "hamper-items", label: "Hamper Catalog", icon: Gift },
  { value: "earnings", label: "Earnings", icon: DollarSign },
];

const AdminCommerceHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "marketplace";

  return (
    <AdminLayout>
      <SEO title="Commerce Hub | Admin" description="Manage marketplace, stores, discounts and hampers" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Commerce Hub</h1>
          <p className="text-muted-foreground">Marketplace, stores, discounts & hampers</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                <t.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="marketplace"><AdminMarketplaceContent /></TabsContent>
          <TabsContent value="stores"><AdminStoresContent /></TabsContent>
          <TabsContent value="shop-orders"><AdminShopOrdersContent /></TabsContent>
          <TabsContent value="categories"><AdminCategoriesContent /></TabsContent>
          <TabsContent value="discounts"><AdminDiscountsContent /></TabsContent>
          <TabsContent value="discount-orders"><AdminDiscountOrdersContent /></TabsContent>
          <TabsContent value="hamper-bundles"><AdminHamperBundlesContent /></TabsContent>
          <TabsContent value="hamper-items"><AdminHamperItemsContent /></TabsContent>
          <TabsContent value="earnings"><AdminSellerEarningsContent /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminCommerceHub;
