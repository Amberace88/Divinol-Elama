import { Fragment } from "react";
import { LegalToc } from "./LegalToc";

export type LegalSection = { title: string; body: string };

const LINK_RE = /([\w.+-]+@[\w-]+\.[\w.-]+|(?:https?:\/\/|www\.)[^\s,;)]+)/g;

/** Turns e-mail addresses and URLs inside plain text into links. */
function linkify(text: string) {
  const parts = text.split(LINK_RE);
  return parts.map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    const clean = part.replace(/[.]+$/, "");
    const trail = part.slice(clean.length);
    const href = clean.includes("@") && !clean.startsWith("http") ? `mailto:${clean}` : clean.startsWith("http") ? clean : `https://${clean}`;
    const external = !href.startsWith("mailto:");
    return (
      <Fragment key={i}>
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="font-semibold text-navy-600 underline decoration-navy-200 underline-offset-2 hover:decoration-navy-500"
        >
          {clean}
        </a>
        {trail}
      </Fragment>
    );
  });
}

/** Renders a body string: blank line = new paragraph, lines starting with "- " = bullet list. */
function Body({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const out: React.ReactNode[] = [];
        let list: string[] = [];
        const flush = () => {
          if (list.length) {
            out.push(
              <ul key={`l${out.length}`}>
                {list.map((li, k) => (
                  <li key={k}>{linkify(li)}</li>
                ))}
              </ul>,
            );
            list = [];
          }
        };
        for (const line of lines) {
          if (line.startsWith("- ")) list.push(line.slice(2));
          else {
            flush();
            if (line.trim()) out.push(<p key={`p${out.length}`}>{linkify(line)}</p>);
          }
        }
        flush();
        return <Fragment key={bi}>{out}</Fragment>;
      })}
    </>
  );
}

export function fillPlaceholders(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

/** Legal text with a sticky, scroll-spied table of contents. */
export function LegalDocument({
  sections,
  values,
  tocLabel,
  updated,
  footer,
}: {
  sections: LegalSection[];
  values: Record<string, string>;
  tocLabel: string;
  updated: string;
  footer?: React.ReactNode;
}) {
  const items = sections.map((s, i) => ({ id: `section-${i + 1}`, title: `${i + 1}. ${s.title}` }));
  return (
    <div className="container-x grid gap-10 py-12 sm:py-16 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16">
      <LegalToc items={items} label={tocLabel} updated={updated} />
      <article className="max-w-3xl">
        {sections.map((s, i) => (
          <section key={items[i].id} id={items[i].id} aria-labelledby={`${items[i].id}-h`} className="scroll-mt-28 border-b border-line py-8 first:pt-0 last:border-0">
            <h2 id={`${items[i].id}-h`} className="flex items-baseline gap-3 text-xl font-extrabold text-navy-700 sm:text-2xl">
              <span className="grid h-8 min-w-8 shrink-0 -skew-x-12 place-items-center rounded-md bg-brand-400 px-1.5 text-sm text-navy-900">
                <span className="skew-x-12">{i + 1}</span>
              </span>
              {s.title}
            </h2>
            <div className="prose-product mt-4">
              <Body text={fillPlaceholders(s.body, values)} />
            </div>
          </section>
        ))}
        {footer && <div className="mt-6 rounded-2xl bg-canvas p-5 text-[14px] text-muted">{footer}</div>}
      </article>
    </div>
  );
}
