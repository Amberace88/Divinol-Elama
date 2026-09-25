"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Building2, Check, Loader2, MapPin, Pencil, Phone, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/app/[locale]/account/actions";
import { EmptyState } from "./ui";
import type { AddressRow } from "./types";

type Country = "LV" | "EE" | "LT";
type Draft = {
  id: string | null;
  label: string;
  name: string;
  company: string;
  phone: string;
  street: string;
  city: string;
  postal_code: string;
  country: Country;
  is_default: boolean;
};

function toDraft(a: AddressRow | null, fallback: { name: string; phone: string; country: Country }): Draft {
  if (!a) {
    return { id: null, label: "", name: fallback.name, company: "", phone: fallback.phone, street: "", city: "", postal_code: "", country: fallback.country, is_default: false };
  }
  return {
    id: a.id,
    label: a.label ?? "",
    name: a.name,
    company: a.company ?? "",
    phone: a.phone ?? "",
    street: a.street,
    city: a.city,
    postal_code: a.postal_code,
    country: (["LV", "EE", "LT"].includes(a.country) ? a.country : "LV") as Country,
    is_default: a.is_default,
  };
}

export function AddressBook({
  addresses,
  defaults,
}: {
  addresses: AddressRow[];
  defaults: { name: string; phone: string; country: Country };
}) {
  const t = useTranslations("account.addresses");
  const te = useTranslations("account.errors");
  const tm = useTranslations("market");
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [, startAction] = useTransition();

  const open = (a: AddressRow | null) => {
    setConfirmId(null);
    setDraft(toDraft(a, defaults));
  };

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    startSave(async () => {
      const res = await saveAddress(draft);
      if (res.ok) {
        toast.success(t("saved"));
        setDraft(null);
      } else toast.error(te(res.error));
    });
  }

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusyId(id);
    startAction(async () => {
      const res = await fn();
      setBusyId(null);
      setConfirmId(null);
      if (res.ok) toast.success(success);
      else toast.error(te(res.error ?? "generic"));
    });
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));

  return (
    <div className="grid gap-5">
      <div className="flex justify-end">
        {!draft && (
          <Button type="button" onClick={() => open(null)}>
            <Plus className="h-4 w-4" />
            {t("add")}
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {draft && (
          <motion.form
            key="address-form"
            onSubmit={onSave}
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="card p-5 sm:p-6"
            aria-labelledby="address-form-title"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 id="address-form-title" className="text-base font-extrabold text-navy-800">
                {draft.id ? t("edit") : t("add")}
              </h2>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
                aria-label={t("cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="a_label" className="label">
                  {t("form.label")} <span className="font-medium text-muted">({t("form.optional")})</span>
                </label>
                <input id="a_label" className="input" maxLength={60} placeholder={t("form.labelPlaceholder")} value={draft.label} onChange={set("label")} />
              </div>
              <div>
                <label htmlFor="a_name" className="label">
                  {t("form.name")}
                </label>
                <input id="a_name" className="input" autoComplete="name" required maxLength={120} value={draft.name} onChange={set("name")} />
              </div>
              <div>
                <label htmlFor="a_phone" className="label">
                  {t("form.phone")}
                </label>
                <input id="a_phone" type="tel" className="input" autoComplete="tel" maxLength={40} value={draft.phone} onChange={set("phone")} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="a_company" className="label">
                  {t("form.company")} <span className="font-medium text-muted">({t("form.optional")})</span>
                </label>
                <input id="a_company" className="input" autoComplete="organization" maxLength={160} value={draft.company} onChange={set("company")} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="a_street" className="label">
                  {t("form.street")}
                </label>
                <input id="a_street" className="input" autoComplete="street-address" required maxLength={200} value={draft.street} onChange={set("street")} />
              </div>
              <div>
                <label htmlFor="a_city" className="label">
                  {t("form.city")}
                </label>
                <input id="a_city" className="input" autoComplete="address-level2" required maxLength={100} value={draft.city} onChange={set("city")} />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
                <div>
                  <label htmlFor="a_postal" className="label">
                    {t("form.postalCode")}
                  </label>
                  <input
                    id="a_postal"
                    className="input"
                    autoComplete="postal-code"
                    required
                    maxLength={20}
                    placeholder={draft.country === "LV" ? "LV-1001" : ""}
                    value={draft.postal_code}
                    onChange={set("postal_code")}
                  />
                </div>
                <div>
                  <label htmlFor="a_country" className="label">
                    {t("form.country")}
                  </label>
                  <select id="a_country" className="input" autoComplete="country" value={draft.country} onChange={set("country")}>
                    {(["LV", "EE", "LT"] as const).map((c) => (
                      <option key={c} value={c}>
                        {tm(c)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink/80 sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-navy-700"
                  checked={draft.is_default}
                  onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })}
                />
                {t("form.isDefault")}
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? t("saving") : t("save")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                {t("cancel")}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {addresses.length === 0 && !draft ? (
        <div className="card">
          <EmptyState icon={<MapPin className="h-6 w-6" />} title={t("empty")} text={t("emptyText")} />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => {
            const busy = busyId === a.id;
            return (
              <motion.li
                key={a.id}
                layout={!reduce}
                className={cn("card relative flex flex-col p-5", a.is_default && "ring-2 ring-navy-700/80")}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-extrabold text-navy-800">{a.label || a.name}</p>
                  {a.is_default && (
                    <span className="skew-tag bg-brand-400 text-[11px] font-extrabold text-navy-900">
                      <span>{t("default")}</span>
                    </span>
                  )}
                </div>
                <address className="mt-2 mb-4 grid gap-0.5 text-sm leading-6 text-ink/80 not-italic">
                  {a.label && <span className="font-semibold text-ink">{a.name}</span>}
                  {a.company && (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted" />
                      {a.company}
                    </span>
                  )}
                  <span>{a.street}</span>
                  <span>
                    {a.postal_code} {a.city}, {["LV", "EE", "LT"].includes(a.country) ? tm(a.country as Country) : a.country}
                  </span>
                  {a.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted" />
                      {a.phone}
                    </span>
                  )}
                </address>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                  {confirmId === a.id ? (
                    <>
                      <span className="mr-auto text-[13px] font-semibold text-danger">{t("deleteConfirm")}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => run(a.id, () => deleteAddress(a.id), t("deleted"))}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        {t("delete")}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                        {t("cancel")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" size="sm" variant="ghost" onClick={() => open(a)}>
                        <Pencil className="h-3.5 w-3.5" />
                        {t("editShort")}
                      </Button>
                      {!a.is_default && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => run(a.id, () => setDefaultAddress(a.id), t("defaultSet"))}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
                          {t("setDefault")}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-danger hover:bg-danger/5"
                        onClick={() => setConfirmId(a.id)}
                        aria-label={`${t("delete")}: ${a.label || a.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
