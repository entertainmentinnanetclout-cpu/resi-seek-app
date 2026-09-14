import { Link } from "react-router-dom";
import { ACCOUNT_PORTALS } from "@/lib/accountRouting";

export default function AccountPortals() {
  return <nav aria-label="Account portals" className="my-5 space-y-3">
    <h2 className="text-center text-sm font-semibold">Choose your account portal</h2>
    <div className="grid grid-cols-2 gap-2">{ACCOUNT_PORTALS.map(portal =>
      <Link key={portal.label} to={portal.login} className="rounded-lg border bg-card px-3 py-3 text-center text-sm hover:bg-muted">{portal.label}</Link>
    )}</div>
    <p className="text-center text-xs text-muted-foreground">One secure account. Portal access depends on your approved permissions.</p>
  </nav>;
}
