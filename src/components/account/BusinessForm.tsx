"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { usePricing } from "@/components/providers/PriceProvider";
import { submitBusiness } from "@/app/[locale]/account/actions";
import type { AccountProfile } from "./types";

export function BusinessForm({ profile }: { profile: AccountProfile }) {
  const t = useTranslations("account.business");
  const te = useTranslations("account.errors");
  const { refresh } = usePricing();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    company_name: profile.company_name ?? "",
    reg_no: profile.reg_no ?? "",
    vat_no: profile.vat_no ?? "",
    legal_address: profile.legal_address ?? "",
    phone: profile.phone ?? "",
  });
  const isPending = profile.b2b_status === "pending";

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await submitBusiness(form);
      if (res.ok) {
        toast.success(isPending ? t("updated") : t("submitted"), { description: isPending ? undefined : t("submittedText") });
        refresh();
      } else toast.error(te(res.error));
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="b_company" className="label">
          {t("companyName")}
        </label>
        <input
          id="b_company"
          className="input"
          autoComplete="organization"
          required
          minLength={2}
          maxLength={160}
          value={form.company_name}
          onChange={set("company_name")}
        />
      </div>
      <div>
        <label htmlFor="b_reg" className="label">
          {t("regNo")}
        </label>
        <input id="b_reg" className="input" required minLength={3} maxLength={40} value={form.reg_no} onChange={set("reg_no")} />
      </div>
      <div>
        <label htmlFor="b_vat" className="label">
          {t("vatNo")} <span className="font-medium text-muted">({t("optional")})</span>
        </label>
        <input id="b_vat" className="input" maxLength={40} placeholder="LV40000000000" value={form.vat_no} onChange={set("vat_no")} />
        <p className="mt-1.5 text-xs text-muted">{t("vatHint")}</p>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="b_address" className="label">
          {t("legalAddress")}
        </label>
        <input
          id="b_address"
          className="input"
          autoComplete="street-address"
          required
          minLength={3}
          maxLength={300}
          value={form.legal_address}
          onChange={set("legal_address")}
        />
      </div>
      <div>
        <label htmlFor="b_phone" className="label">
          {t("phone")}
        </label>
        <input id="b_phone" type="tel" className="input" autoComplete="tel" maxLength={40} value={form.phone} onChange={set("phone")} />
      </div>
      <div className="flex flex-col justify-end gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted">{t("consentNote")}</p>
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {pending ? t("submitting") : isPending ? t("update") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
