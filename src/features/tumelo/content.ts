import { supabase } from "@/integrations/supabase/client";

export type TumeloCareerContent = {
  slug: string;
  partner_name: string;
  section_title: string;
  subtitle: string;
  social_platform: string;
  social_handle: string;
  social_url: string;
  preview_text: string;
  summary: string;
  bullet_points: string[];
  tags: string[];
  cta_label: string;
  cta_url: string;
};

export const fallbackTumeloCareerContent: TumeloCareerContent = {
  slug: "tumelo-career-education",
  partner_name: "Tumelo",
  section_title: "Career & Education with Tumelo",
  subtitle:
    "Trusted guidance on qualifications, applications and education choices — connected directly to your ResKonnect journey.",
  social_platform: "TikTok",
  social_handle: "@tumelosithole10",
  social_url: "https://www.tiktok.com/@tumelosithole10",
  preview_text: "Before you apply for any qualification, do your research.",
  summary:
    "Tumelo shares practical advice for students to make informed decisions before applying for any qualification.",
  bullet_points: [
    "Before applying for any qualification, do proper research.",
    "Understand what the qualification covers and what career path it leads to.",
    "Check entry requirements and whether you meet them.",
    "Compare institutions or colleges offering the programme.",
    "Look at application opening and closing dates early.",
    "Prepare the required documents before applications open.",
    "Make sure the qualification aligns with your goals, strengths and interests.",
    "Avoid applying blindly simply because a programme sounds popular.",
  ],
  tags: [
    "TVET guidance",
    "Qualification advice",
    "Application dates",
    "Career research",
    "Documents needed",
  ],
  cta_label: "Continue on ResKonnect",
  cta_url: "/get-started",
};

const normalizeContent = (row: Record<string, unknown>): TumeloCareerContent => ({
  ...fallbackTumeloCareerContent,
  ...row,
  bullet_points: Array.isArray(row.bullet_points)
    ? row.bullet_points.filter((item): item is string => typeof item === "string")
    : fallbackTumeloCareerContent.bullet_points,
  tags: Array.isArray(row.tags)
    ? row.tags.filter((item): item is string => typeof item === "string")
    : fallbackTumeloCareerContent.tags,
}) as TumeloCareerContent;

export async function loadTumeloCareerContent(): Promise<TumeloCareerContent> {
  try {
    const { data, error } = await (supabase as any)
      .from("partner_content")
      .select(
        "slug,partner_name,section_title,subtitle,social_platform,social_handle,social_url,preview_text,summary,bullet_points,tags,cta_label,cta_url"
      )
      .eq("slug", "tumelo-career-education")
      .eq("is_published", true)
      .maybeSingle();

    if (error || !data) return fallbackTumeloCareerContent;
    return normalizeContent(data as Record<string, unknown>);
  } catch {
    return fallbackTumeloCareerContent;
  }
}
