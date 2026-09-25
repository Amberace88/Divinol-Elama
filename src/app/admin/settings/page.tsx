import { requireAdmin } from "@/lib/admin/auth";
import { fmtDateTime } from "@/lib/admin/format";
import { errorMessage } from "@/lib/admin/server";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { SettingsForms, type SettingsInit } from "@/components/admin/settings/SettingsForms";
import { ErrorNote, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Iestatījumi" };

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("settings").select("key, value, updated_at").in("key", ["company", "vat", "shipping", "invoice"]);
  const rows = (data ?? []) as { key: string; value: Record<string, unknown>; updated_at: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r]));

  const company = { bank_name: "", iban: "", swift: "", hours: "", ...DEFAULT_SETTINGS.company, ...(map.company?.value ?? {}) } as SettingsInit["company"];
  const initial: SettingsInit = {
    company,
    vat: { ...DEFAULT_SETTINGS.vat, ...(map.vat?.value ?? {}) } as SettingsInit["vat"],
    shipping: (map.shipping?.value ?? DEFAULT_SETTINGS.shipping) as unknown as SettingsInit["shipping"],
    invoice: { due_days_default: 7, notes: "", ...(map.invoice?.value ?? {}) } as SettingsInit["invoice"],
    updated: Object.fromEntries(rows.map((r) => [r.key, fmtDateTime(r.updated_at)])),
  };

  return (
    <>
      <PageHeader title="Iestatījumi" description="Uzņēmuma rekvizīti, PVN, piegāde un rēķini. Izmaiņas veikalā parādās uzreiz." />
      {error && (
        <div className="mb-6">
          <ErrorNote message={`${errorMessage(error)} Tiek rādītas noklusējuma vērtības.`} />
        </div>
      )}
      <SettingsForms initial={initial} />
    </>
  );
}
