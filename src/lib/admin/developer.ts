import "server-only";

/**
 * Developer accounts (full technical view). Every other admin is a "shop owner" admin:
 * they manage the shop but don't see environment variable names, API docs or developer tools.
 * Override with DEVELOPER_EMAILS="a@x.lv,b@y.lv" in Netlify.
 */
const DEFAULT_DEVELOPERS = ["baropsedijs@gmail.com", "barops.edijs@gmail.com"];

function developerList(): string[] {
  const raw = process.env.DEVELOPER_EMAILS?.trim();
  return (raw ? raw.split(",") : DEFAULT_DEVELOPERS).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isDeveloperEmail(email?: string | null): boolean {
  return !!email && developerList().includes(email.trim().toLowerCase());
}
