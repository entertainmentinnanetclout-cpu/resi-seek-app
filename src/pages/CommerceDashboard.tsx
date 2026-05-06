import { useSearchParams } from "react-router-dom";
import SEO from "@/components/SEO";
import SpecialistLayout from "@/components/admin/SpecialistLayout";
import { ShoppingBag, Store, Percent, ShoppingCart, Gift, Truck, DollarSign, LayoutGrid, Users, LayoutDashboard } from "lucide-react";
import { AdminMarketplaceContent } from "./admin/AdminMarketplace";
import { AdminStoresContent } from "./admin/AdminStores";
import { AdminDiscountsContent } from "./admin/AdminDiscounts";
import { AdminDiscountOrdersContent } from "./admin/AdminDiscountOrders";
import { AdminHamperItemsContent } from "./admin/AdminHamperItems";
import { AdminHamperBundlesContent } from "./admin/AdminHamperBundles";
import { AdminShopOrdersContent } from "./admin/AdminShopOrders";
import { AdminSellerEarningsContent } from "./admin/AdminSellerEarnings";
import { AdminCategoriesContent } from "./admin/AdminCategories";
import { AdminSellerApprovalsContent } from "./admin/AdminSellerApprovals";
import { AdminDeliveryZonesContent } from "./admin/AdminDeliveryZones";

const navItems = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "marketplace", label: "Marketplace", icon: ShoppingBag },
  { value: "stores", label: "Stores", icon: Store },
  { value: "sellers", label: "Sellers", icon: Users },
  { value: "shop-orders", label: "Shop Orders", icon: Truck },
  { value: "categories", label: "Categories", icon: LayoutGrid },
  { value: "discounts", label: "Discounts", icon: Percent },
  { value: "discount-orders", label: "Discount Orders", icon: ShoppingCart },
  { value: "hamper-bundles", label: "Hamper Bundles", icon: Gift },
  { value: "hamper-items", label: "Hamper Catalog", icon: Gift },
  { value: "delivery-zones", label: "Delivery Zones", icon: Truck },
  { value: "earnings", label: "Earnings", icon: DollarSign },
];

const CommerceDashboard = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  return (
    <SpecialistLayout
      title="Commerce Dashboard"
      roleLabel="Commerce Executive"
      basePath="/commerce"
      navItems={navItems}
      defaultTab="overview"
    >
      <SEO title="Commerce Dashboard | ResKonnect" description="Commerce team workspace" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold capitalize">{tab === "overview" ? "Commerce Overview" : tab.replace("-", " ")}</h1>
          <p className="text-muted-foreground">Marketplace, stores, orders, hampers & deals</p>
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {navItems.filter(n => n.value !== "overview").map((n) => (
              <a key={n.value} href={`/commerce?tab=${n.value}`} className="rounded-xl border bg-card p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <n.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-semibold">{n.label}</p>
                <p className="text-sm text-muted-foreground">Manage {n.label.toLowerCase()}</p>
              </a>
            ))}
          </div>
        )}
        {tab === "marketplace" && <AdminMarketplaceContent />}
        {tab === "stores" && <AdminStoresContent />}
        {tab === "sellers" && <AdminSellerApprovalsContent />}
        {tab === "shop-orders" && <AdminShopOrdersContent />}
        {tab === "categories" && <AdminCategoriesContent />}
        {tab === "discounts" && <AdminDiscountsContent />}
        {tab === "discount-orders" && <AdminDiscountOrdersContent />}
        {tab === "hamper-bundles" && <AdminHamperBundlesContent />}
        {tab === "hamper-items" && <AdminHamperItemsContent />}
        {tab === "delivery-zones" && <AdminDeliveryZonesContent />}
        {tab === "earnings" && <AdminSellerEarningsContent />}
      </div>
    </SpecialistLayout>
  );
};

export default CommerceDashboard;