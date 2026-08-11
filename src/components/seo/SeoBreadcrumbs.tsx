import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { Crumb } from "@/lib/seo/jsonLd";

const SeoBreadcrumbs = ({ crumbs }: { crumbs: Crumb[] }) => (
  <nav aria-label="Breadcrumb" className="mb-6">
    <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <li key={c.path} className="flex items-center gap-1">
            {isLast ? (
              <span aria-current="page" className="font-medium text-foreground">{c.name}</span>
            ) : (
              <Link to={c.path} className="transition-colors hover:text-primary">{c.name}</Link>
            )}
            {!isLast && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  </nav>
);

export default SeoBreadcrumbs;