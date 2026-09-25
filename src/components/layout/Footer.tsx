import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getStoreSettings } from "@/lib/settings";
import { Logo } from "@/components/ui/Logo";
import { FacebookIcon, InstagramIcon } from "@/components/ui/SocialIcons";
import { NewsletterForm } from "./NewsletterForm";
import { telHref, type HeaderCategory } from "./nav";

const SOCIAL = [
  { href: "https://www.facebook.com/ELDivinol", label: "Facebook", Icon: FacebookIcon },
  { href: "https://www.instagram.com/divinol.lv/", label: "Instagram", Icon: InstagramIcon },
];

function FooterHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-400">{children}</h2>;
}

const linkCls = "text-[14px] text-white/65 transition hover:text-white";

export async function Footer({ categories }: { categories: HeaderCategory[] }) {
  const [t, nav, meta, settings] = await Promise.all([
    getTranslations("footer"),
    getTranslations("nav"),
    getTranslations("meta"),
    getStoreSettings(),
  ]);
  const c = settings.company;
  const year = new Date().getFullYear();

  const companyLinks = [
    { href: "/about" as const, label: nav("about") },
    { href: "/business" as const, label: nav("business") },
    { href: "/contact" as const, label: nav("contact") },
    { href: "/downloads" as const, label: nav("downloads") },
  ];
  const helpLinks = [
    { href: "/delivery" as const, label: nav("delivery") },
    { href: "/oil-finder" as const, label: nav("oilFinder") },
    { href: "/calculators" as const, label: nav("calculators") },
    { href: "/terms" as const, label: t("terms") },
    { href: "/privacy" as const, label: t("privacy") },
  ];
  const payments = ["Visa", "Mastercard", t("paymentTransfer"), t("paymentInvoice")];

  return (
    <footer className="relative mt-auto overflow-hidden bg-navy-950 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[8%] h-72 w-40 -skew-x-[20deg] bg-brand-400/10 blur-3xl"
      />
      <div aria-hidden className="h-1 w-full bg-gradient-to-r from-brand-400 via-brand-300 to-brand-500" />

      <div className="container-x relative">
        {/* newsletter band */}
        <div className="grid items-center gap-6 border-b border-white/10 py-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{t("newsletterTitle")}</p>
            <p className="mt-1.5 text-[14px] text-white/60">{t("newsletterText")}</p>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <NewsletterForm />
          </div>
        </div>

        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-12">
          <div className="sm:col-span-2 lg:col-span-4">
            <Link href="/" aria-label={nav("home")} className="inline-block">
              <Logo />
            </Link>
            <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-white/60">{t("about")}</p>
            <div className="mt-6 flex items-center gap-2">
              <span className="mr-1 text-[12px] font-semibold text-white/45">{t("follow")}</span>
              {SOCIAL.map(({ href, label, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid size-10 place-items-center rounded-xl bg-white/[0.07] text-white/75 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-brand-400 hover:text-navy-900"
                >
                  <Icon className="size-[18px]" />
                </a>
              ))}
            </div>
            <p className="mt-8 inline-flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-white/50">
              <span aria-hidden className="flex h-3 overflow-hidden rounded-[2px]">
                <span className="w-1.5 bg-black" />
                <span className="w-1.5 bg-[#dd0000]" />
                <span className="w-1.5 bg-[#ffce00]" />
              </span>
              {t("madeIn")}
            </p>
          </div>

          <nav aria-label={t("categories")} className="lg:col-span-3">
            <FooterHeading>{t("categories")}</FooterHeading>
            <ul className="grid gap-2.5">
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <Link href={{ pathname: "/catalog/[category]", params: { category: cat.slug } }} className={linkCls}>
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="grid grid-cols-2 gap-8 sm:col-span-2 lg:col-span-2 lg:grid-cols-1">
            <nav aria-label={t("company")}>
              <FooterHeading>{t("company")}</FooterHeading>
              <ul className="grid gap-2.5">
                {companyLinks.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkCls}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label={t("help")}>
              <FooterHeading>{t("help")}</FooterHeading>
              <ul className="grid gap-2.5">
                {helpLinks.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkCls}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <FooterHeading>{t("contacts")}</FooterHeading>
            <ul className="grid gap-3 text-[14px]">
              <li>
                <a href={telHref(c.phone)} className="group flex items-center gap-3 font-semibold text-white/85 hover:text-white">
                  <span className="grid size-9 place-items-center rounded-lg bg-white/[0.07] text-brand-400 transition group-hover:bg-brand-400 group-hover:text-navy-900">
                    <Phone className="size-4" aria-hidden />
                  </span>
                  {c.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${c.email}`} className="group flex items-center gap-3 font-semibold text-white/85 hover:text-white">
                  <span className="grid size-9 place-items-center rounded-lg bg-white/[0.07] text-brand-400 transition group-hover:bg-brand-400 group-hover:text-navy-900">
                    <Mail className="size-4" aria-hidden />
                  </span>
                  {c.email}
                </a>
              </li>
              <li>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.warehouse)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 text-white/70 hover:text-white"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-brand-400 transition group-hover:bg-brand-400 group-hover:text-navy-900">
                    <MapPin className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-white/40">{t("warehouse")}</span>
                    {c.warehouse}
                    {c.hours && <span className="block text-[13px] text-white/50">{c.hours}</span>}
                  </span>
                  <ArrowUpRight className="mt-1 size-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" aria-hidden />
                </a>
              </li>
            </ul>
            <div className="mt-6 rounded-xl bg-white/[0.04] p-4 text-[12.5px] leading-relaxed text-white/55 ring-1 ring-white/10">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">{t("requisites")}</p>
              <p className="font-semibold text-white/80">{c.name}</p>
              <p>
                {t("regNo")} {c.reg_no} · {t("vatNo")} {c.vat_no}
              </p>
              <p>
                {t("legalAddress")}: {c.address}
              </p>
              {c.iban && (
                <p>
                  {c.bank_name ? `${c.bank_name} · ` : ""}
                  {c.iban}
                  {c.swift ? ` · ${c.swift}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 py-6 text-[12.5px] text-white/45 md:flex-row md:items-center">
          <p>
            © {year} {c.name.replace(/"/g, "")} · {meta("siteName")}. {t("rights")}
          </p>
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            <span className="sr-only">{t("payments")}</span>
            {payments.map((p) => (
              <span
                key={p}
                className="rounded-md border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/70"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
