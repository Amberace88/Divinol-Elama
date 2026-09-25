import { Inbox } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { INQUIRY_STATUS, INQUIRY_TYPE } from "@/lib/admin/labels";
import { PAGE_SIZE, sp, spEnum, spInt, withParams, type SP } from "@/lib/admin/params";
import { errorMessage, sanitizeSearch } from "@/lib/admin/server";
import { FilterBar } from "@/components/admin/FilterBar";
import { InquiryList, type Inquiry } from "@/components/admin/inquiries/InquiryList";
import { EmptyState, ErrorNote, PageHeader, Pagination } from "@/components/admin/ui";

export const metadata = { title: "Pieprasījumi" };

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const type = spEnum(params, "type", Object.keys(INQUIRY_TYPE), null);
  // Default view hides spam.
  const status = spEnum(params, "status", [...Object.keys(INQUIRY_STATUS), "all"], null);
  const q = sanitizeSearch(sp(params, "q"));
  const page = spInt(params, "page", 1);
  const { supabase } = await requireAdmin();

  let query = supabase.from("inquiries").select("id, type, name, email, phone, company, message, payload, locale, status, created_at", { count: "exact" });
  if (type) query = query.eq("type", type);
  if (status && status !== "all") query = query.eq("status", status);
  else if (!status) query = query.neq("status", "spam");
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%,message.ilike.%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as Inquiry[];
  const total = count ?? 0;
  const hasFilters = Boolean(type || status || q);

  return (
    <>
      <PageHeader title="Pieprasījumi" description="Kontaktformas, B2B pieteikumi, cenu pieprasījumi un eļļas izvēles jautājumi." />
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <FilterBar
          values={{ q, type: type ?? "", status: status ?? "" }}
          fields={[
            { type: "search", name: "q", placeholder: "Vārds, e-pasts, uzņēmums, teksts…" },
            { type: "select", name: "type", label: "Visi veidi", options: Object.entries(INQUIRY_TYPE).map(([value, v]) => ({ value, label: v.label })) },
            {
              type: "select",
              name: "status",
              label: "Statuss: visi, izņemot surogātpastu",
              options: [...Object.entries(INQUIRY_STATUS).map(([value, v]) => ({ value, label: v.label })), { value: "all", label: "Pilnīgi visi" }],
            },
          ]}
        />
        {error ? (
          <div className="p-5">
            <ErrorNote message={errorMessage(error)} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Inbox} title={hasFilters ? "Nekas netika atrasts" : "Pieprasījumu vēl nav"} description={hasFilters ? "Mēģiniet mainīt filtrus." : "Kad klienti aizpildīs formas veikalā, tās parādīsies šeit."} />
        ) : (
          <>
            <InquiryList rows={rows} />
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} href={(p) => `/admin/inquiries${withParams(params, { page: p === 1 ? null : p })}`} />
          </>
        )}
      </div>
    </>
  );
}
