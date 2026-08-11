import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { FaqItem } from "@/lib/seo/jsonLd";

interface Props {
  items: FaqItem[];
  heading?: string;
}

/** Renders the FAQs visibly. FAQPage schema is emitted from the same array by the caller. */
const SeoFaqSection = ({ items, heading = "Frequently asked questions" }: Props) => {
  if (!items.length) return null;
  return (
    <section aria-labelledby="faq-heading" className="mt-14">
      <h2 id="faq-heading" className="text-2xl font-bold tracking-tight md:text-3xl">{heading}</h2>
      <Accordion type="single" collapsible className="mt-6">
        {items.map((f, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-left text-base font-semibold">{f.question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">{f.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};

export default SeoFaqSection;