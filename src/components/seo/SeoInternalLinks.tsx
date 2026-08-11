import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export interface SeoLink {
  label: string;
  to: string;
  description?: string;
}

interface Props {
  heading?: string;
  links: SeoLink[];
}

const SeoInternalLinks = ({ heading = "Keep exploring", links }: Props) => {
  if (!links.length) return null;
  return (
    <section aria-labelledby="related-heading" className="mt-14">
      <h2 id="related-heading" className="text-2xl font-bold tracking-tight md:text-3xl">{heading}</h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <li key={l.to + l.label}>
            <Link
              to={l.to}
              className="group flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60"
            >
              <span className="flex items-center gap-2 font-semibold text-foreground">
                {l.label}
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
              {l.description && (
                <span className="mt-1 text-sm text-muted-foreground">{l.description}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default SeoInternalLinks;