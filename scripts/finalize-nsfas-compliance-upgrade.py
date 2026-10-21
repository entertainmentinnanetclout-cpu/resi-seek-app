from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Could not patch {label}: anchor missing")
    return text.replace(old, new, 1)


app = Path("src/App.tsx")
text = app.read_text()
text = replace_once(
    text,
    'import GrowthTracker from "@/components/GrowthTracker";\n',
    'import GrowthTracker from "@/components/GrowthTracker";\nimport MetaPixelTracker from "@/components/MetaPixelTracker";\n',
    "App MetaPixelTracker import",
)
text = replace_once(
    text,
    'const PartnersLandlords = lazy(() => import("./pages/public/PartnersLandlords"));\n',
    'const PartnersLandlords = lazy(() => import("./pages/public/PartnersLandlords"));\nconst AccreditationReadiness = lazy(() => import("./pages/public/AccreditationReadiness"));\n',
    "AccreditationReadiness lazy import",
)
text = replace_once(
    text,
    'const ResidenceListingProfile = lazy(() => import("./pages/residence/ResidenceListingProfile"));\n',
    'const ResidenceListingProfile = lazy(() => import("./pages/residence/ResidenceListingProfile"));\nconst ResidenceComplianceReadiness = lazy(() => import("./pages/residence/ResidenceComplianceReadiness"));\n',
    "ResidenceComplianceReadiness lazy import",
)
text = replace_once(
    text,
    "                <GrowthTracker />\n",
    "                <GrowthTracker />\n                <MetaPixelTracker />\n",
    "MetaPixelTracker mount",
)
text = text.replace(
    '<Route path="/student-accommodation/nsfas-accredited" element={<SeoLandingPage pageKey="/student-accommodation/nsfas-accredited" />} />',
    '<Route path="/student-accommodation/nsfas-accredited" element={<NsfAsLanding />} />',
)
text = replace_once(
    text,
    '                    <Route path="/partners/landlords" element={<PartnersLandlords />} />\n',
    '                    <Route path="/partners/landlords" element={<PartnersLandlords />} />\n                    <Route path="/accreditation-readiness" element={<AccreditationReadiness />} />\n                    <Route path="/partners/landlords/accreditation-readiness" element={<AccreditationReadiness />} />\n',
    "public accreditation routes",
)
text = replace_once(
    text,
    '                      <Route path="listing" element={<ResidenceListingProfile />} />\n',
    '                      <Route path="listing" element={<ResidenceListingProfile />} />\n                      <Route path="compliance" element={<ResidenceComplianceReadiness />} />\n',
    "residence compliance route",
)
app.write_text(text)

header = Path("src/components/SiteHeader.tsx")
text = header.read_text()
text = replace_once(
    text,
    '      { label: "Landlords & Property Owners", to: "/partners/landlords" },\n',
    '      { label: "Landlords & Property Owners", to: "/partners/landlords" },\n      { label: "Accreditation Readiness", to: "/accreditation-readiness" },\n',
    "public navigation compliance link",
)
header.write_text(text)

footer = Path("src/components/SiteFooter.tsx")
text = footer.read_text()
text = replace_once(
    text,
    'import { BRAND } from "@/constants/brand";\n',
    'import { BRAND } from "@/constants/brand";\nimport { openMarketingPreferences } from "@/lib/metaPixel";\n',
    "footer marketing import",
)
text = replace_once(
    text,
    '      { label: "List Your Property", to: "/partners/landlords" },\n',
    '      { label: "List Your Property", to: "/partners/landlords" },\n      { label: "Accreditation Readiness", to: "/accreditation-readiness" },\n',
    "footer accreditation link",
)
text = replace_once(
    text,
    '          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>\n',
    '          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>\n          <button type="button" onClick={openMarketingPreferences} className="hover:text-foreground">Marketing preferences</button>\n',
    "footer marketing preferences",
)
footer.write_text(text)

layout = Path("src/pages/residence/ResidenceLayout.tsx")
text = layout.read_text()
text = replace_once(
    text,
    'import { BarChart3, Bell, Boxes, CalendarDays, ExternalLink, Home, Inbox, LogOut, Megaphone, Menu, Palette, Target, Rotate3D } from "lucide-react";\n',
    'import { BarChart3, Bell, Boxes, CalendarDays, ExternalLink, FileCheck2, Home, Inbox, LogOut, Megaphone, Menu, Palette, Target, Rotate3D } from "lucide-react";\n',
    "ResidenceLayout icon import",
)
text = replace_once(
    text,
    '  { icon: Palette, label: "Listing & Brand", path: "/residence/listing", match: (path: string) => path.startsWith("/residence/listing") },\n',
    '  { icon: Palette, label: "Listing & Brand", path: "/residence/listing", match: (path: string) => path.startsWith("/residence/listing") },\n  { icon: FileCheck2, label: "Compliance Readiness", path: "/residence/compliance", match: (path: string) => path.startsWith("/residence/compliance") },\n',
    "ResidenceLayout compliance nav",
)
layout.write_text(text)

prerender = Path("scripts/prerender-seo.mjs")
text = prerender.read_text()
text = replace_once(
    text,
    '  ["/partners/landlords", "List Student Accommodation | ResKonnect for Landlords", "List and manage student accommodation, improve occupancy and connect with student demand through ResKonnect.", "For Student Accommodation Providers"],\n',
    '  ["/partners/landlords", "Student Accommodation Provider Services | ResKonnect", "Recruit students, manage applications and access compliance-readiness support through the ResKonnect landlord operating system.", "Student Accommodation Provider Services"],\n  ["/accreditation-readiness", "NSFAS Accommodation Accreditation Readiness | ResKonnect", "Prepare student accommodation for the NSFAS/DHET accreditation process with document-readiness review, property pre-inspection, remediation tracking and renewal control.", "Student Accommodation Accreditation Readiness"],\n',
    "prerender accreditation page",
)
prerender.write_text(text)

sitemap = Path("api/sitemap.js")
text = sitemap.read_text()
if '"/accreditation-readiness"' not in text:
    text = text.replace(
        '"/partners", "/partners/landlords", "/partners/institutions"',
        '"/partners", "/partners/landlords", "/accreditation-readiness", "/partners/institutions"',
        1,
    )
sitemap.write_text(text)

vercel = Path("vercel.json")
config = json.loads(vercel.read_text())
rewrites = config.get("rewrites", [])
if not any(item.get("source") == "/accreditation-readiness" for item in rewrites):
    idx = next((i for i, item in enumerate(rewrites) if item.get("source") == "/partners/landlords"), len(rewrites) - 1)
    rewrites.insert(idx + 1, {"source": "/accreditation-readiness", "destination": "/_seo/accreditation-readiness"})
config["rewrites"] = rewrites
vercel.write_text(json.dumps(config, indent=2) + "\n")

print("NSFAS compliance, landlord portal, SEO and Meta Pixel wiring completed.")
