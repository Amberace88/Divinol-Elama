"use client";

import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
export const MAX_IMAGE_MB = 8;
export const MAX_DOC_MB = 25;

/** Uploads a file to a public Storage bucket and returns its public URL. RLS: admin-only writes. */
export async function uploadToBucket(bucket: "product-images" | "documents", folder: string, file: File) {
  const dot = file.name.lastIndexOf(".");
  const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = slugify(dot > 0 ? file.name.slice(0, dot) : file.name).slice(0, 60) || "fails";
  const path = `${folder.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${base}${ext ? `.${ext}` : ""}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message.includes("row-level security") ? "Nav tiesību augšupielādēt failus" : error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Best-effort removal of a file previously uploaded to a bucket (by its public URL). */
export async function removeFromBucket(bucket: "product-images" | "documents", publicUrl: string) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = publicUrl.indexOf(marker);
  if (i < 0) return;
  const path = decodeURIComponent(publicUrl.slice(i + marker.length));
  try {
    await createClient().storage.from(bucket).remove([path]);
  } catch {
    /* ignore */
  }
}
