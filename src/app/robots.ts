import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const privatePaths = new Set<string>(["/admin", "/account", "/api/", "/auth/", "/login", "/register", "/forgot-password", "/reset-password"]);
  for (const locale of routing.locales) {
    for (const href of ["/cart", "/checkout", "/account", "/login", "/register"] as const) {
      const path = getPathname({ href, locale });
      privatePaths.add(path);
      // on a domain where the locale is the default, the prefix is omitted
      privatePaths.add(path.replace(new RegExp(`^/${locale}(?=/)`), ""));
    }
  }
  const hosts = [...new Set(routing.locales.map((l) => siteUrl(l)))];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...privatePaths].sort() }],
    sitemap: hosts.map((h) => `${h}/sitemap.xml`),
    host: siteUrl("lv"),
  };
}
