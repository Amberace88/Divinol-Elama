type Json = Record<string, unknown> | null | undefined;

const COUNTRY: Record<string, string> = { LV: "Latvija", EE: "Igaunija", LT: "Lietuva" };

function str(v: unknown) {
  return typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
}

/** Renders an address / pickup-point jsonb of unknown exact shape. */
export function AddressBlock({ value, empty = "—" }: { value: Json; empty?: string }) {
  if (!value || typeof value !== "object" || Object.keys(value).length === 0) return <p className="text-[13px] text-muted">{empty}</p>;
  const v = value as Record<string, unknown>;
  const name = str(v.name) || str(v.full_name);
  const company = str(v.company) || str(v.company_name);
  const street = str(v.street) || str(v.address) || str(v.address1);
  const cityLine = [str(v.postal_code) || str(v.zip), str(v.city)].filter(Boolean).join(" ");
  const country = COUNTRY[str(v.country)] ?? str(v.country);
  const phone = str(v.phone);
  const lines = [company, name, street, str(v.address2), cityLine, country].filter(Boolean);
  const known = new Set(["name", "full_name", "company", "company_name", "street", "address", "address1", "address2", "postal_code", "zip", "city", "country", "phone", "id", "provider"]);
  const extra = Object.entries(v).filter(([k, val]) => !known.has(k) && str(val));
  return (
    <div className="text-[13px] leading-relaxed text-ink">
      {lines.map((l, i) => (
        <p key={i} className={i === 0 ? "font-semibold" : undefined}>
          {l}
        </p>
      ))}
      {phone && (
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-navy-600 hover:underline">
          {phone}
        </a>
      )}
      {(str(v.id) || str(v.provider)) && (
        <p className="mt-1 text-[12px] text-muted">
          {str(v.provider) && <span className="uppercase">{str(v.provider)} </span>}
          {str(v.id) && <span className="font-mono">ID {str(v.id)}</span>}
        </p>
      )}
      {extra.length > 0 && (
        <dl className="mt-1 text-[12px] text-muted">
          {extra.map(([k, val]) => (
            <div key={k}>
              <dt className="inline">{k}: </dt>
              <dd className="inline">{str(val)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
