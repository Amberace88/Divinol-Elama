import "server-only";

/**
 * Reads a file shipped in /public at runtime — works on Node (Netlify, `next dev`) through the filesystem and on
 * Cloudflare Workers (no filesystem) through the static-assets binding.
 * `publicPath` is relative to /public, e.g. "fonts/manrope/Manrope_400Regular.ttf".
 */
export async function readPublicFile(publicPath: string): Promise<Uint8Array | null> {
  const rel = publicPath.replace(/^\/+/, "");
  try {
    const [{ readFile }, { join }] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    const buf = await readFile(join(/*turbopackIgnore: true*/ process.cwd(), "public", rel));
    return new Uint8Array(buf);
  } catch {
    /* no filesystem (Workers) or file missing → try the assets binding */
  }
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const assets = (env as unknown as { ASSETS?: { fetch: (r: Request) => Promise<Response> } }).ASSETS;
    if (!assets) return null;
    const res = await assets.fetch(new Request(`https://assets.local/${rel}`));
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
