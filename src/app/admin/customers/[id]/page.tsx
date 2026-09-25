import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MapPin, Phone, ShoppingBag } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber } from "@/lib/admin/format";
import { B2B_STATUS, INVOICE_STATUS, INVOICE_TYPE, labelOf, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/admin/labels";
import { UUID_RE } from "@/lib/admin/server";
import { B2BDecision } from "@/components/admin/customers/B2BDecision";
import { CustomerForm, type CustomerFormValues } from "@/components/admin/customers/CustomerForm";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/admin/ui";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  customer_type: string;
  company_name: string | null;
  reg_no: string | null;
  vat_no: string | null;
  legal_address: string | null;
  b2b_status: string;
  discount_percent: number;
  payment_terms_days: number;
  market: string;
  preferred_locale: string;
  marketing_consent: boolean;
  admin_notes: string | null;
  created_at: string;
};
type Address = { id: string; label: string | null; name: string; phone: string | null; company: string | null; street: string; city: string; postal_code: string; country: string; is_default: boolean };
type Order = { id: string; number: string; created_at: string; status: string; payment_status: string; total_gross: number };
type Invoice = { id: string; number: string; type: string; status: string; issued_at: string; due_at: string | null; total_gross: number };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Klients ${id.slice(0, 8)}` };
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await requireAdmin();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>();
  if (!profile) notFound();

  const [addrRes, ordersRes, invRes] = await Promise.all([
    supabase.from("addresses").select("id, label, name, phone, company, street, city, postal_code, country, is_default").eq("user_id", id).order("is_default", { ascending: false }),
    supabase.from("orders").select("id, number, created_at, status, payment_status, total_gross").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("invoices").select("id, number, type, status, issued_at, due_at, total_gross").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const addresses = (addrRes.data ?? []) as Address[];
  const orders = (ordersRes.data ?? []) as Order[];
  const invoices = (invRes.data ?? []) as Invoice[];
  const valid = orders.filter((o) => o.status !== "cancelled");
  const spent = valid.reduce((s, o) => s + Number(o.total_gross || 0), 0);
  const b2b = labelOf(B2B_STATUS, profile.b2b_status);
  const display = profile.company_name || profile.full_name || profile.email;

  const initial: CustomerFormValues = {
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    customer_type: profile.customer_type === "business" ? "business" : "private",
    company_name: profile.company_name ?? "",
    reg_no: profile.reg_no ?? "",
    vat_no: profile.vat_no ?? "",
    legal_address: profile.legal_address ?? "",
    market: (["LV", "EE", "LT"].includes(profile.market) ? profile.market : "LV") as CustomerFormValues["market"],
    b2b_status: profile.b2b_status as CustomerFormValues["b2b_status"],
    discount_percent: String(Number(profile.discount_percent) || 0),
    payment_terms_days: String(profile.payment_terms_days ?? 0),
    role: profile.role === "admin" ? "admin" : "customer",
    admin_notes: profile.admin_notes ?? "",
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/customers", label: "Klienti" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {display}
            {profile.b2b_status !== "none" && <Pill tone={b2b.tone}>B2B: {b2b.label}</Pill>}
            {profile.role === "admin" && <Pill tone="navy">Administrators</Pill>}
          </span>
        }
        description={`Reģistrēts ${fmtDateTime(profile.created_at)} · valoda ${profile.preferred_locale.toUpperCase()} · ${profile.marketing_consent ? "piekrīt jaunumiem" : "nav piekritis jaunumiem"}`}
      />

      {profile.b2b_status === "pending" && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-brand-300 bg-brand-50 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-bold text-ink">B2B pieteikums gaida apstiprinājumu</p>
            <p className="text-[13px] text-muted">Pārbaudiet uzņēmuma rekvizītus un izlemiet.</p>
          </div>
          <B2BDecision customerId={profile.id} name={display} discount={Number(profile.discount_percent)} terms={profile.payment_terms_days} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <CustomerForm key={JSON.stringify(initial)} id={profile.id} initial={initial} isSelf={profile.id === user.id} />

        <div className="space-y-6">
          <Panel>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-navy-700 text-[16px] font-extrabold text-brand-400">{display[0]?.toUpperCase()}</span>
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{profile.full_name || "—"}</p>
                <a href={`mailto:${profile.email}`} className="flex items-center gap-1.5 truncate text-[13px] text-navy-600 hover:underline">
                  <Mail className="h-3.5 w-3.5" /> {profile.email}
                </a>
                {profile.phone && (
                  <a href={`tel:${profile.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-[13px] text-navy-600 hover:underline">
                    <Phone className="h-3.5 w-3.5" /> {profile.phone}
                  </a>
                )}
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                ["Pasūtījumi", fmtNumber(valid.length)],
                ["Iztērēts", fmtMoney(spent)],
                ["Vidēji", fmtMoney(valid.length ? spent / valid.length : 0)],
              ].map(([k, val]) => (
                <div key={k} className="rounded-xl bg-slate-50 px-2 py-3">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{k}</dt>
                  <dd className="mt-0.5 text-[14px] font-extrabold tabular-nums text-ink">{val}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title={`Pasūtījumi (${orders.length})`} bodyClassName="p-0">
            {orders.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="Pasūtījumu nav" className="py-8" />
            ) : (
              <ul className="max-h-[420px] divide-y divide-line/70 overflow-y-auto">
                {orders.map((o) => {
                  const st = labelOf(ORDER_STATUS, o.status);
                  const pay = labelOf(PAYMENT_STATUS, o.payment_status);
                  return (
                    <li key={o.id}>
                      <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 text-[13px] transition hover:bg-navy-50/40">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-ink">{o.number}</p>
                          <p className="text-[12px] text-muted">
                            {fmtDate(o.created_at)} · {pay.label}
                          </p>
                        </div>
                        <Pill tone={st.tone}>{st.label}</Pill>
                        <span className="w-20 text-right font-semibold tabular-nums">{fmtMoney(o.total_gross)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {invoices.length > 0 && (
            <Panel title="Rēķini" bodyClassName="p-0">
              <ul className="divide-y divide-line/70">
                {invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                    <div className="min-w-0 flex-1">
                      <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="font-bold text-navy-700 hover:underline">
                        {inv.number}
                      </a>
                      <p className="text-[12px] text-muted">
                        {labelOf(INVOICE_TYPE, inv.type).label} · {fmtDate(inv.issued_at)}
                      </p>
                    </div>
                    <Pill tone={labelOf(INVOICE_STATUS, inv.status).tone} dot={false}>
                      {labelOf(INVOICE_STATUS, inv.status).label}
                    </Pill>
                    <span className="font-semibold tabular-nums">{fmtMoney(inv.total_gross)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Adreses">
            {addresses.length === 0 ? (
              <p className="text-[13px] text-muted">Saglabātu adrešu nav.</p>
            ) : (
              <ul className="space-y-3">
                {addresses.map((a) => (
                  <li key={a.id} className="flex gap-3 rounded-xl border border-line p-3 text-[13px]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {a.label || a.name}
                        {a.is_default && <span className="ml-2 text-[11px] font-bold text-emerald-700">noklusētā</span>}
                      </p>
                      <p className="text-muted">
                        {[a.company, a.name, a.street, `${a.postal_code} ${a.city}`, a.country, a.phone].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
