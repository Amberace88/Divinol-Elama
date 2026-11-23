import { requireAdmin } from "@/lib/admin/auth";
import { isDeveloperEmail } from "@/lib/admin/developer";
import { fmtDateTime } from "@/lib/admin/format";
import { errorMessage } from "@/lib/admin/server";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { SettingsForms, type SettingsInit } from "@/components/admin/settings/SettingsForms";
import { EmailSettingsCard } from "@/components/admin/settings/EmailSettingsCard";
import { emailStatus } from "@/lib/email/send";
import { MontonioSettingsCard } from "@/components/admin/settings/MontonioSettingsCard";
import { isMontonioConfigured, montonioAdminStatus } from "@/lib/payments/montonio";
import { stripeAdminStatus } from "@/lib/payments/stripe";
import { notificationUrl, stripeWebhookUrl } from "@/lib/payments/service";
import { StripeSettingsCard } from "@/components/admin/settings/StripeSettingsCard";
import { ErrorNote, PageHeader } from "@/components/admin/ui";
import { AssistantSettingsCard, type AssistantChatRow } from "@/components/admin/settings/AssistantSettingsCard";
import { anthropicConfigured } from "@/lib/assistant/anthropic";
import { ASSISTANT_MODELS, DEFAULT_MODEL } from "@/lib/assistant/config";
import { isServiceRoleConfigured } from "@/lib/supabase/service";

export const metadata = { title: "Iestatījumi" };

export default async function SettingsPage() {
  const { supabase, profile, user } = await requireAdmin();
  const developer = isDeveloperEmail(user.email);
  const { data, error } = await supabase.from("settings").select("key, value, updated_at").in("key", ["company", "vat", "shipping", "invoice"]);
  const rows = (data ?? []) as { key: string; value: Record<string, unknown>; updated_at: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r]));

  const company = { bank_name: "", iban: "", swift: "", hours: "", ...DEFAULT_SETTINGS.company, ...(map.company?.value ?? {}) } as SettingsInit["company"];
  const initial: SettingsInit = {
    company,
    vat: { ...DEFAULT_SETTINGS.vat, ...(map.vat?.value ?? {}) } as SettingsInit["vat"],
    shipping: (map.shipping?.value ?? DEFAULT_SETTINGS.shipping) as unknown as SettingsInit["shipping"],
    invoice: { due_days_default: 7, notes: "", auto_final_invoice: true, ...(map.invoice?.value ?? {}) } as SettingsInit["invoice"],
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
      <div className="mt-6 grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <div className="hidden lg:block" />
        <EmailSettingsCard status={{ ...(await emailStatus()), adminEmail: profile.email || user.email || null }} developer={developer} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <div className="hidden lg:block" />
        <StripeSettingsCard status={{ ...(await stripeAdminStatus()), webhookUrl: stripeWebhookUrl() }} developer={developer} />
      </div>
      {developer && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <div className="hidden lg:block" />
          <AssistantSettingsCard status={await assistantStatus(supabase)} />
        </div>
      )}
      {/* Montonio stays available as a second provider, shown only once it has keys */}
      {isMontonioConfigured() && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <div className="hidden lg:block" />
          <MontonioSettingsCard status={{ ...(await montonioAdminStatus()), webhookUrl: notificationUrl() }} developer={developer} />
        </div>
      )}
    </>
  );
}

type Sb = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

async function assistantStatus(supabase: Sb) {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [{ data: st }, { data: recent }, { data: week }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "assistant").maybeSingle(),
    supabase
      .from("assistant_chats")
      .select("id, created_at, updated_at, locale, market, turns, tools_used, input_tokens, output_tokens, cache_read_tokens, user_id, messages")
      .order("updated_at", { ascending: false })
      .limit(15),
    supabase.from("assistant_chats").select("turns, input_tokens, output_tokens").gte("updated_at", since),
  ]);
  const v = (st?.value ?? {}) as { public?: boolean; model?: string };
  const rows = (week ?? []) as { turns: number; input_tokens: number; output_tokens: number }[];
  return {
    keyConfigured: anthropicConfigured(),
    serviceRole: isServiceRoleConfigured(),
    settings: { public: Boolean(v.public), model: v.model ?? DEFAULT_MODEL },
    models: ASSISTANT_MODELS,
    stats: {
      chats7d: rows.length,
      turns7d: rows.reduce((s, r) => s + Number(r.turns ?? 0), 0),
      tokens7d: rows.reduce((s, r) => s + Number(r.input_tokens ?? 0) + Number(r.output_tokens ?? 0), 0),
    },
    chats: ((recent ?? []) as (Omit<AssistantChatRow, "signed_in"> & { user_id: string | null })[]).map(({ user_id, ...c }) => ({
      ...c,
      tools_used: c.tools_used ?? [],
      messages: Array.isArray(c.messages) ? c.messages : [],
      signed_in: Boolean(user_id),
    })),
  };
}
