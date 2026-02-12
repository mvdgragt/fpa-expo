import { supabase } from "./supabase";

const signedUrlCache = new Map<string, { url: string; expiresAtMs: number }>();

export const extractUserPhotoObjectPath = (value: string) => {
  const v = (value || "").trim();
  if (!v) return "";

  if (!/^https?:\/\//i.test(v)) {
    return v;
  }

  try {
    const u = new URL(v);
    const parts = u.pathname.split("/").filter(Boolean);
    const bucketIdx = parts.indexOf("user-photos");
    if (bucketIdx === -1) return "";
    return parts.slice(bucketIdx + 1).join("/");
  } catch {
    return "";
  }
};

export const getSignedUserPhotoUrl = async (
  objectPath: string,
  expiresInSeconds = 60 * 60,
) => {
  const path = (objectPath || "").trim();
  if (!path) return "";

  const cached = signedUrlCache.get(path);
  const now = Date.now();
  if (cached && cached.expiresAtMs - now > 30_000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from("user-photos")
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return "";
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAtMs: now + expiresInSeconds * 1000,
  });

  return data.signedUrl;
};
