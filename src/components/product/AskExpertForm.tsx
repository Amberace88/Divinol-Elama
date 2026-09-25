"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleCheck, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { usePricing } from "@/components/providers/PriceProvider";

export function AskExpertForm({ slug, productName }: { slug: string; productName: string }) {
  const t = useTranslations("product");
  const ta = useTranslations("actions");
  const te = useTranslations("errors");
  const locale = useLocale();
  const { profile } = usePricing();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error(te("email"));
      return;
    }
    setBusy(true);
    try {
      if (!isSupabaseConfigured) throw new Error("not_configured");
      const car = String(fd.get("car") ?? "").trim();
      const question = String(fd.get("message") ?? "").trim();
      const { error } = await createClient().rpc("submit_inquiry", {
        payload: {
          type: "oil_finder",
          name: String(fd.get("name") ?? "").trim(),
          email,
          phone: String(fd.get("phone") ?? "").trim(),
          message: [car && `${t("expertCar")}: ${car}`, question].filter(Boolean).join("\n\n") || productName,
          locale,
          extra: { product: slug, product_name: productName, car },
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success(t("expertSent"));
    } catch {
      toast.error(te("generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="expert" aria-labelledby="expert-title" className="scroll-mt-28 rounded-3xl bg-navy-700 p-5 text-white shadow-lift sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-400 text-navy-900">
          <MessageCircle className="size-5" aria-hidden />
        </span>
        <h2 id="expert-title" className="text-[17px] font-extrabold tracking-tight">
          {t("askExpert")}
        </h2>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-white/65">{t("askExpertText")}</p>
      {sent ? (
        <p className="mt-5 flex items-center gap-2.5 rounded-2xl bg-white/10 p-4 text-[14px] font-semibold">
          <CircleCheck className="size-5 shrink-0 text-emerald-400" aria-hidden />
          {t("expertSent")}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-2.5 [&_.input]:border-white/15 [&_.input]:bg-white/[0.07] [&_.input]:text-white [&_.input]:placeholder:text-white/40 [&_.input]:focus:border-brand-400 [&_.input]:focus:ring-brand-400/20">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <input name="name" required autoComplete="name" placeholder={t("expertName")} aria-label={t("expertName")} defaultValue={profile?.full_name ?? ""} className="input" />
            <input name="email" type="email" required autoComplete="email" placeholder={t("expertEmail")} aria-label={t("expertEmail")} defaultValue={profile?.email ?? ""} className="input" />
          </div>
          <input name="phone" type="tel" autoComplete="tel" placeholder={t("expertPhone")} aria-label={t("expertPhone")} className="input" />
          <input name="car" placeholder={t("expertCar")} aria-label={t("expertCar")} className="input" />
          <textarea name="message" rows={3} placeholder={t("expertMessage")} aria-label={t("expertMessage")} className="input h-auto min-h-24 py-2.5" />
          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-400 text-[14px] font-extrabold text-navy-900 transition hover:bg-brand-300 disabled:opacity-70"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            {busy ? ta("sending") : ta("send")}
          </button>
        </form>
      )}
    </section>
  );
}
