import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// Messages are split per namespace file so different areas of the app can be edited independently.
const namespaces = ["common", "shop", "pages", "account", "checkout"] as const;

export async function loadMessages(locale: string) {
  const parts = await Promise.all(
    namespaces.map((ns) =>
      import(`../messages/${locale}/${ns}.json`).then((m) => m.default).catch(() => ({})),
    ),
  );
  return Object.assign({}, ...parts);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "Europe/Riga",
  };
});
