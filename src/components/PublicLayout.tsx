import { ReactNode } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

interface PublicLayoutProps {
  children: ReactNode;
  /** Optional contextual search rendered inside the shared header */
  headerSearch?: ReactNode;
}

const PublicLayout = ({ children, headerSearch }: PublicLayoutProps) => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <SiteHeader search={headerSearch} />
    <main className="flex-1">{children}</main>
    <SiteFooter />
  </div>
);

export default PublicLayout;
