"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocale } from "next-intl";
import { ArrowUp, Bot, Check, Loader2, RotateCcw, ShoppingCart, Sparkles, X } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { usePricing } from "@/components/providers/PriceProvider";
import { cn } from "@/lib/utils";

type Card = { slug: string; name: string; type: string; image: string | null; url: string; from: string | null; promo: number | null };
type AddAction = {
  type: "add_to_cart";
  qty: number;
  item: { slug: string; key: string; sku: string | null; name: string; pack: string; image: string | null; size: number | null; unit: string; price_net: number; promo_percent?: number };
};
type Msg = { role: "user" | "assistant"; content: string; cards?: Card[]; added?: string[]; error?: boolean };

const STORE_KEY = "divinol-assistant-v1";

const T = {
  lv: {
    title: "Divinol konsultants",
    subtitle: "Tiešsaistē · atbildam uzreiz",
    preview: "Priekšskatījums — redz tikai izstrādātājs",
    hello: "Labdien! 👋 Palīdzēšu atrast piemērotāko eļļu Jūsu auto vai tehnikai, pateikšu cenu, pieejamību un piegādes iespējas. Kādam auto meklējat?",
    placeholder: "Rakstiet šeit…",
    send: "Sūtīt",
    reset: "Jauna saruna",
    close: "Aizvērt",
    open: "Atvērt palīgu",
    thinking: "Raksta…",
    added: "Ielikts grozā",
    from: "no",
    error: "Neizdevās atbildēt. Mēģini vēlreiz vai sazinies ar mums: +371 26556099.",
    limit: "Sasniegts ziņu limits. Mēģini vēlāk vai sazinies ar mums.",
    disclaimer: "Digitālais konsultants · apstiprinājumus pārbaudiet servisa grāmatiņā",
    chips: ["Kāda eļļa der VW Golf 2.0 TDI 2017?", "Cik maksā piegāde uz pakomātu?", "Nepieciešams 20 L 10W-40 traktoram", "Kur ir mans pasūtījums?"],
  },
  et: {
    title: "Divinoli konsultant",
    subtitle: "Võrgus · vastame kohe",
    preview: "Eelvaade — näeb ainult arendaja",
    hello: "Tere! Olen Divinoli poe abiline. Aitan valida õli just sinu autole või masinale, ütlen hinnad, tarnevõimalused ja lisan tooted ostukorvi. Millest alustame?",
    placeholder: "Kirjuta küsimus…",
    send: "Saada",
    reset: "Uus vestlus",
    close: "Sulge",
    open: "Ava abiline",
    thinking: "Kirjutab…",
    added: "Lisatud ostukorvi",
    from: "alates",
    error: "Vastamine ebaõnnestus. Proovi uuesti või võta meiega ühendust.",
    limit: "Sõnumite limiit on täis. Proovi hiljem või võta meiega ühendust.",
    disclaimer: "AI-abiline võib eksida — kontrolli heakskiite auto kasutusjuhendist.",
    chips: ["Milline õli sobib VW Golf 2.0 TDI 2017?", "Kui palju maksab pakiautomaati tarne?", "Vajan 20 L 10W-40 traktorile", "Kus on minu tellimus?"],
  },
  lt: {
    title: "Divinol konsultantas",
    subtitle: "Prisijungę · atsakome iš karto",
    preview: "Peržiūra — mato tik kūrėjas",
    hello: "Sveiki! Esu Divinol parduotuvės asistentas. Padėsiu parinkti alyvą jūsų automobiliui ar technikai, pasakysiu kainas, pristatymo galimybes ir įdėsiu prekes į krepšelį. Nuo ko pradėsime?",
    placeholder: "Parašykite klausimą…",
    send: "Siųsti",
    reset: "Naujas pokalbis",
    close: "Uždaryti",
    open: "Atidaryti asistentą",
    thinking: "Rašo…",
    added: "Įdėta į krepšelį",
    from: "nuo",
    error: "Nepavyko atsakyti. Bandykite dar kartą arba susisiekite su mumis.",
    limit: "Pasiektas žinučių limitas. Bandykite vėliau arba susisiekite su mumis.",
    disclaimer: "DI asistentas gali klysti — patvirtinimus patikrinkite automobilio vadove.",
    chips: ["Kokia alyva tinka VW Golf 2.0 TDI 2017?", "Kiek kainuoja pristatymas į paštomatą?", "Reikia 20 L 10W-40 traktoriui", "Kur mano užsakymas?"],
  },
  en: {
    title: "Divinol advisor",
    subtitle: "Online · we reply instantly",
    preview: "Preview — visible to the developer only",
    hello: "Hi! I'm the Divinol shop assistant. I can pick the right oil for your car or machine, tell you prices and delivery options and put products in your cart. Where shall we start?",
    placeholder: "Ask a question…",
    send: "Send",
    reset: "New chat",
    close: "Close",
    open: "Open assistant",
    thinking: "Typing…",
    added: "Added to cart",
    from: "from",
    error: "Something went wrong. Please try again or contact us.",
    limit: "Message limit reached. Please try later or contact us.",
    disclaimer: "The AI assistant can make mistakes — confirm approvals in your vehicle manual.",
    chips: ["Which oil fits a VW Golf 2.0 TDI 2017?", "How much is parcel locker delivery?", "I need 20 L of 10W-40 for a tractor", "Where is my order?"],
  },
  ru: {
    title: "Консультант Divinol",
    subtitle: "В сети · отвечаем сразу",
    preview: "Предпросмотр — видит только разработчик",
    hello: "Здравствуйте! Я помощник магазина Divinol. Подберу масло для вашего автомобиля или техники, подскажу цены и варианты доставки и положу товары в корзину. С чего начнём?",
    placeholder: "Напишите вопрос…",
    send: "Отправить",
    reset: "Новый чат",
    close: "Закрыть",
    open: "Открыть помощника",
    thinking: "Печатает…",
    added: "Добавлено в корзину",
    from: "от",
    error: "Не удалось ответить. Попробуйте ещё раз или свяжитесь с нами.",
    limit: "Достигнут лимит сообщений. Попробуйте позже или свяжитесь с нами.",
    disclaimer: "ИИ-помощник может ошибаться — проверяйте допуски в руководстве автомобиля.",
    chips: ["Какое масло подходит для VW Golf 2.0 TDI 2017?", "Сколько стоит доставка в пакомат?", "Нужно 20 л 10W-40 для трактора", "Где мой заказ?"],
  },
} as const;

// ───────────── tiny, safe Markdown renderer (bold, italics, code, links, lists, headings) ─────────────

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\s][^*]*)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${i++}`;
    if (m[1] != null) {
      const href = m[2];
      const safe = /^(\/|https?:\/\/|mailto:|tel:)/.test(href) ? href : "#";
      const external = /^https?:\/\//.test(safe) && !/divinol\.(lv|ee)/.test(safe);
      out.push(
        <a key={k} href={safe} className="font-semibold text-navy-600 underline decoration-brand-400 decoration-2 underline-offset-2 hover:text-navy-800 dark:text-brand-300" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {m[1]}
        </a>,
      );
    } else if (m[3] != null) out.push(<strong key={k} className="font-bold text-ink">{m[3]}</strong>);
    else if (m[4] != null) out.push(<code key={k} className="rounded bg-navy-50 px-1 py-0.5 text-[12.5px] dark:bg-white/10">{m[4]}</code>);
    else if (m[5] != null) out.push(<em key={k}>{m[5]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(" "), `p${blocks.length}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const L = list.ordered ? "ol" : "ul";
    blocks.push(
      <L key={`l${blocks.length}`} className={cn("space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc marker:text-brand-500")}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, `l${blocks.length}-${i}`)}</li>
        ))}
      </L>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const head = line.match(/^#{1,4}\s+(.*)$/);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (head) {
      flushPara();
      flushList();
      blocks.push(<p key={`h${blocks.length}`} className="font-extrabold text-ink">{inline(head[1], `h${blocks.length}`)}</p>);
    } else if (bullet || num) {
      flushPara();
      const ordered = Boolean(num);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className="space-y-2.5">{blocks}</div>;
}

// ───────────── widget ─────────────

export function AssistantWidget() {
  const [enabled, setEnabled] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/assistant", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setEnabled(Boolean(d.enabled));
        setPreview(Boolean(d.preview));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!enabled) return null;
  return <AssistantPanel preview={preview} />;
}

function AssistantPanel({ preview }: { preview: boolean }) {
  const locale = useLocale() as keyof typeof T;
  const t = T[locale] ?? T.lv;
  const reduce = useReducedMotion();
  const { items, add } = useCart();
  const { market } = usePricing();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // restore the conversation of this browser tab
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { msgs: Msg[]; chatId: string | null };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from sessionStorage after mount
        setMsgs(Array.isArray(s.msgs) ? s.msgs : []);
        setChatId(s.chatId ?? null);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    if (busy) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ msgs: msgs.slice(-40), chatId }));
    } catch {
      /* ignore */
    }
  }, [msgs, chatId, busy]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [msgs, status, open, reduce]);

  useEffect(() => {
    if (!open) return;
    // full-screen sheet on phones → keep the page behind it from scrolling
    const lock = window.matchMedia("(max-width: 639px)").matches;
    const prevOverflow = document.body.style.overflow;
    if (lock) document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const id = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      if (lock) document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(id);
    };
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setInput("");
      const history: Msg[] = [...msgs, { role: "user", content: q }];
      setMsgs([...history, { role: "assistant", content: "" }]);
      setBusy(true);
      setStatus(t.thinking);
      const ac = new AbortController();
      abortRef.current = ac;
      const patch = (fn: (m: Msg) => Msg) =>
        setMsgs((prev) => {
          const next = [...prev];
          next[next.length - 1] = fn(next[next.length - 1]);
          return next;
        });
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            chatId,
            locale,
            market,
            messages: history.filter((m) => !m.error && m.content.trim()).map((m) => ({ role: m.role, content: m.content.slice(0, 7900) })),
            cart: items.map((i) => ({ slug: i.slug, key: i.key, qty: i.qty })),
          }),
        });
        if (!res.ok || !res.body) {
          patch((m) => ({ ...m, content: res.status === 429 ? t.limit : t.error, error: true }));
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let ev: { t: string; d?: string; items?: Card[]; action?: AddAction; chatId?: string | null };
            try {
              ev = JSON.parse(line);
            } catch {
              continue;
            }
            if (ev.t === "text" && ev.d) {
              setStatus(null);
              patch((m) => ({ ...m, content: m.content + ev.d }));
            } else if (ev.t === "status" && ev.d) setStatus(ev.d);
            else if (ev.t === "cards" && ev.items?.length) {
              const cards = ev.items;
              patch((m) => {
                const seen = new Set((m.cards ?? []).map((c) => c.slug));
                return { ...m, cards: [...(m.cards ?? []), ...cards.filter((c) => !seen.has(c.slug))].slice(0, 8) };
              });
            } else if (ev.t === "action" && ev.action?.type === "add_to_cart") {
              const a = ev.action;
              add(a.item, a.qty);
              patch((m) => ({ ...m, added: [...(m.added ?? []), `${a.qty} × ${a.item.name} ${a.item.pack}`.trim()] }));
            } else if (ev.t === "error") {
              patch((m) => ({ ...m, content: m.content || t.error, error: !m.content }));
            } else if (ev.t === "done") {
              if (ev.chatId) setChatId(ev.chatId);
            }
          }
        }
      } catch {
        if (!ac.signal.aborted) patch((m) => ({ ...m, content: m.content || t.error, error: !m.content }));
      } finally {
        setBusy(false);
        setStatus(null);
        abortRef.current = null;
      }
    },
    [busy, msgs, chatId, locale, market, items, add, t],
  );

  const reset = () => {
    abortRef.current?.abort();
    setMsgs([]);
    setChatId(null);
    setInput("");
  };

  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 34 };

  return (
    <>
      {/* launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t.open}
            initial={reduce ? false : { scale: 0.6, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0, y: 12 }}
            transition={spring}
            className="group fixed bottom-4 right-4 z-[60] flex items-center gap-2.5 rounded-full bg-navy-700 p-2 sm:py-2.5 sm:pl-2.5 sm:pr-4 text-white shadow-[0_18px_40px_-12px_rgb(10_17_34/0.55)] ring-1 ring-white/10 transition hover:bg-navy-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 sm:bottom-6 sm:right-6 max-lg:[:root:has([data-buybar])_&]:bottom-[96px]"
          >
            <span className="relative grid size-11 place-items-center rounded-full bg-brand-400 text-navy-900 sm:size-9">
              <Sparkles className="size-[18px]" aria-hidden />
              {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/40" aria-hidden />}
            </span>
            <span className="hidden text-[14px] font-extrabold tracking-tight sm:inline">{t.title}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* panel */}
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label={t.title}
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={spring}
            style={{ transformOrigin: "bottom right" }}
            className="fixed inset-0 z-[95] flex flex-col overflow-hidden bg-surface sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(680px,calc(100vh-48px))] sm:w-[410px] sm:rounded-3xl sm:shadow-[0_30px_80px_-20px_rgb(10_17_34/0.55)] sm:ring-1 sm:ring-line"
          >
            <header className="relative flex items-center gap-3 bg-navy-700 px-4 py-3.5 text-white">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-400 text-navy-900">
                <Bot className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-extrabold tracking-tight">{t.title}</p>
                <p className="truncate text-[11.5px] text-white/65">{t.subtitle}</p>
              </div>
              {msgs.length > 0 && (
                <button type="button" onClick={reset} title={t.reset} aria-label={t.reset} className="grid size-9 place-items-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white">
                  <RotateCcw className="size-[18px]" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="grid size-9 place-items-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white">
                <X className="size-5" />
              </button>
            </header>
            {preview && (
              <p className="bg-brand-400 px-4 py-1.5 text-center text-[11.5px] font-bold text-navy-900">{t.preview}</p>
            )}

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
              <Bubble role="assistant">
                <Markdown text={t.hello} />
              </Bubble>
              {msgs.length === 0 && (
                <div className="flex flex-wrap gap-2 pl-1">
                  {t.chips.map((c, i) => (
                    <motion.button
                      key={c}
                      type="button"
                      onClick={() => send(c)}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduce ? 0 : 0.08 * i }}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-left text-[12.5px] font-semibold text-navy-700 transition hover:border-brand-400 hover:bg-brand-50 dark:bg-white/5 dark:text-white/85"
                    >
                      {c}
                    </motion.button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => (
                <Fragment key={i}>
                  {m.role === "user" ? (
                    <Bubble role="user">
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </Bubble>
                  ) : (
                    (m.content || m.cards?.length || m.added?.length) && (
                      <div className="space-y-2.5">
                        {m.content && (
                          <Bubble role="assistant" error={m.error}>
                            <Markdown text={m.content} />
                          </Bubble>
                        )}
                        {m.added?.map((a, j) => (
                          <p key={j} className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            <Check className="size-3.5" /> {t.added}: {a}
                          </p>
                        ))}
                        {!!m.cards?.length && <Cards cards={m.cards} from={t.from} />}
                      </div>
                    )
                  )}
                </Fragment>
              ))}
              {busy && status && (
                <p className="flex items-center gap-2 pl-1 text-[12.5px] font-semibold text-muted">
                  <Loader2 className="size-4 animate-spin text-brand-500" /> {status}
                </p>
              )}
            </div>

            <form
              className="border-t border-line bg-surface px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <div className="flex items-end gap-2 rounded-2xl border border-line bg-white px-3 py-2 transition focus-within:border-navy-400 focus-within:ring-4 focus-within:ring-navy-100 dark:bg-white/5 dark:focus-within:ring-white/10">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 2000))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  rows={1}
                  placeholder={t.placeholder}
                  aria-label={t.placeholder}
                  className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[14px] text-ink outline-none placeholder:text-muted/70"
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label={t.send}
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-400 text-navy-900 transition hover:bg-brand-300 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="size-[18px] animate-spin" /> : <ArrowUp className="size-[18px]" />}
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10.5px] text-muted">{t.disclaimer}</p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ role, error, children }: { role: "user" | "assistant"; error?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed",
          role === "user"
            ? "rounded-br-md bg-navy-700 text-white"
            : error
              ? "rounded-bl-md bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200"
              : "rounded-bl-md bg-slate-100 text-ink dark:bg-white/[0.06]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Cards({ cards, from }: { cards: Card[]; from: string }) {
  return (
    <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {cards.map((c) => (
        <a
          key={c.slug}
          href={c.url}
          className="group flex w-[180px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-[0_12px_28px_-14px_rgb(10_17_34/0.45)] dark:bg-white/5"
        >
          <span className="relative flex h-[108px] items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 to-white p-2 dark:from-white/5 dark:to-transparent">
            {c.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote catalogue images, small thumbnails
              <img src={c.image} alt="" loading="lazy" className="max-h-full max-w-full object-contain transition group-hover:scale-[1.04]" />
            ) : (
              <ShoppingCart className="size-8 text-slate-300" aria-hidden />
            )}
            {c.promo ? <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10.5px] font-extrabold text-white">−{c.promo}%</span> : null}
          </span>
          <span className="flex flex-1 flex-col gap-0.5 px-3 py-2.5">
            <span className="line-clamp-2 text-[12.5px] font-extrabold leading-snug text-ink">{c.name}</span>
            {c.type && <span className="line-clamp-1 text-[11px] text-muted">{c.type}</span>}
            {c.from && (
              <span className="mt-auto pt-1 text-[12.5px] font-bold text-navy-700 dark:text-brand-300">
                {from} {c.from}
              </span>
            )}
          </span>
        </a>
      ))}
    </div>
  );
}
