import { supabase } from "@/integrations/supabase/client";

export interface CareerEducationProvider {
  id: string;
  slug: string;
  name: string;
  role_label: string;
  bio: string | null;
  profile_image_url: string | null;
  profile_page_path: string;
  social_handle: string | null;
  social_url: string | null;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
}

export interface PartnerVideo {
  id: string;
  provider_slug: string;
  title: string;
  platform: "tiktok" | "youtube" | "instagram" | "other";
  video_url: string | null;
  thumbnail_url: string | null;
  transcript: string | null;
  transcript_points: string[];
  tags: string[];
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
  published_at: string | null;
}

const client = supabase as any;

const normaliseVideo = (row: any): PartnerVideo => ({
  ...row,
  transcript_points: Array.isArray(row?.transcript_points) ? row.transcript_points : [],
  tags: Array.isArray(row?.tags) ? row.tags : [],
});

export const loadCareerEducationProviders = async (): Promise<CareerEducationProvider[]> => {
  const { data, error } = await client
    .from("career_education_providers")
    .select("id, slug, name, role_label, bio, profile_image_url, profile_page_path, social_handle, social_url, is_featured, is_published, sort_order")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Could not load Career & Education providers", error);
    return [];
  }

  return (data || []) as CareerEducationProvider[];
};

export const loadProviderVideos = async (providerSlug: string): Promise<PartnerVideo[]> => {
  const { data, error } = await client
    .from("partner_videos")
    .select("id, provider_slug, title, platform, video_url, thumbnail_url, transcript, transcript_points, tags, is_featured, is_published, sort_order, published_at")
    .eq("provider_slug", providerSlug)
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error(`Could not load videos for ${providerSlug}`, error);
    return [];
  }

  return (data || []).map(normaliseVideo);
};

export const extractTikTokVideoId = (url?: string | null) => {
  if (!url) return null;
  const match = url.match(/\/video\/(\d+)/i);
  return match?.[1] || null;
};

export const getEmbeddableVideoUrl = (video?: PartnerVideo | null) => {
  if (!video?.video_url) return null;

  if (video.platform === "tiktok") {
    const id = extractTikTokVideoId(video.video_url);
    return id ? `https://www.tiktok.com/player/v1/${id}?autoplay=0&loop=0` : null;
  }

  if (video.platform === "youtube") {
    const watch = video.video_url.match(/[?&]v=([^&]+)/)?.[1];
    const short = video.video_url.match(/youtu\.be\/([^?&/]+)/)?.[1];
    const id = watch || short;
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  return null;
};
