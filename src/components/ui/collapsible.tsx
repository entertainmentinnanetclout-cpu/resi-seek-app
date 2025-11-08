import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

/**
 * An interactive component which expands/collapses a content section.
 *
 * @component
 * @see https://www.radix-ui.com/primitives/docs/components/collapsible
 */
const Collapsible = CollapsiblePrimitive.Root;

/**
 * A button that toggles the open state of a collapsible section.
 *
 * @component
 */
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

/**
 * The content of a collapsible section.
 *
 * @component
 */
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
