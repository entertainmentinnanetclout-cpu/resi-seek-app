import { BRAND } from "@/constants/brand";

// Click-to-WhatsApp only. No API, no webhooks, no secrets, no automated sends.
const BASE = `https://wa.me/${BRAND.contact.whatsapp}`;

export function whatsappLink(message: string): string {
  return `${BASE}?text=${encodeURIComponent(message)}`;
}

export const whatsappSupport = () =>
  whatsappLink("Hi ResKonnect, I need help with my ResKonnect profile.");

export const whatsappAboutResidence = (residenceName: string) =>
  whatsappLink(`Hi ResKonnect, I would like to ask about ${residenceName}.`);

export const whatsappRequestViewing = (residenceName: string) =>
  whatsappLink(`Hi ResKonnect, I would like to request a viewing for ${residenceName}.`);

export const whatsappMissingDocuments = (residenceName?: string) =>
  whatsappLink(
    residenceName
      ? `Hi ResKonnect, I need help submitting my missing documents for my application to ${residenceName}.`
      : "Hi ResKonnect, I need help submitting my missing documents."
  );

export const whatsappPrivateRentalRequest = (area?: string, budget?: number) =>
  whatsappLink(
    `Hi ResKonnect, I am looking for a private rental${area ? ` in ${area}` : ""}${
      budget ? ` with a budget of about R${budget}` : ""
    }. Please assist.`
  );
