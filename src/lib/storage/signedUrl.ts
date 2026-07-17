// Memoized signed-URL helper for private Supabase Storage buckets.
// Prevents repeated createSignedUrl() calls on re-render / re-click,
// which was burning cached egress quota on External Supabase.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Entry = {
  url: string;
  expiresAt: number; // epoch ms
};

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string>>();
const REFRESH_BUFFER_MS = 60_000;

const keyOf = (bucket: string, path: string) => `${bucket}::${path}`;

export async function getSignedUrl(
  bucket: string,
  path: string,
  ttlSeconds = 900,
): Promise<string> {
  if (!path) throw new Error("getSignedUrl: path required");
  const key = keyOf(bucket, path);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt - now > REFRESH_BUFFER_MS) return hit.url;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, ttlSeconds);
    if (error || !data?.signedUrl) {
      throw error ?? new Error("Failed to sign URL");
    }
    cache.set(key, {
      url: data.signedUrl,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[signed-url] mint ${bucket}/${path}`);
    }
    return data.signedUrl;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export function invalidateSignedUrl(bucket: string, path: string) {
  cache.delete(keyOf(bucket, path));
}

export function useSignedUrl(bucket: string, path: string | null | undefined, ttlSeconds = 900) {
  return useQuery({
    queryKey: ["signed-url", bucket, path],
    queryFn: () => getSignedUrl(bucket, path as string, ttlSeconds),
    enabled: !!path,
    staleTime: Math.max(0, (ttlSeconds - 60) * 1000),
    gcTime: ttlSeconds * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}