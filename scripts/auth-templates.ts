/*
 * Builds the Supabase Auth e-mail templates (magic link, confirm sign-up, password reset, e-mail change) in the
 * same design as the shop e-mails. Supabase does not know the visitor's language, so every e-mail is Latvian
 * with short Estonian / English / Russian lines. Output: .email-preview/auth-*.html + .email-preview/auth.json
 * (paste into Supabase → Authentication → Emails → Templates).
 */
import fs from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { C, FONT, layout, type EmailContext } from "../src/lib/email/templates/layout";

const out = path.resolve(".email-preview");
fs.mkdirSync(out, { recursive: true });

const messages = JSON.parse(fs.readFileSync("src/messages/lv/emails.json", "utf8"));
const tr = createTranslator({ locale: "lv", messages, namespace: "emails", onError: () => {}, getMessageFallback: ({ key }) => key }) as unknown as (
  k: string,
  v?: Record<string, string | number>,
) => string;

const ctx: EmailContext = {
  locale: "lv",
  t: (k, v) => tr(k, v),
  company: {
    name: 'SIA "Elama"',
    reg_no: "40103512445",
    vat_no: "LV40103512445",
    address: '"Priežkalni 2", Jumpravas pag., Ogres nov., LV-5022',
    warehouse: "Ventspils iela 51, Rīga, LV-1002",
    phone: "+371 26556099",
    email: "elama@elama.lv",
  },
  siteUrl: "https://divinol.lv",
  logoUrl: "https://divinol.lv/media/brand/elama-logo.png",
  links: {
    catalog: "https://divinol.lv/katalogs",
    oilFinder: "https://divinol.lv/ellas-izvele",
    account: "https://divinol.lv/account",
    contact: "https://divinol.lv/kontakti",
  },
};

const URL_VAR = "{{ .ConfirmationURL }}";
const s = (size: number, color: string, extra = "") => `font-family:${FONT};font-size:${size}px;line-height:1.6;color:${color};${extra}`;

function cta(label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 10px;border-collapse:separate;"><tr>
<td align="center" bgcolor="${C.yellow}" style="border-radius:10px;background:${C.yellow};mso-padding-alt:14px 28px;">
<a href="${URL_VAR}" target="_blank" style="display:inline-block;padding:14px 28px;border-radius:10px;background:${C.yellow};color:${C.navy};${s(16, C.navy, "font-weight:800;line-height:1.2;text-decoration:none;")}">${label}&nbsp;&rarr;</a>
</td></tr></table>`;
}

function other(langs: { code: string; text: string; link: string }[]) {
  const rows = langs
    .map(
      (l) => `<tr><td valign="top" width="34" style="padding:8px 10px 8px 0;width:34px;">
<span style="display:inline-block;padding:2px 6px;border-radius:6px;background:${C.navy};${s(10, C.white, "font-weight:800;letter-spacing:0.06em;line-height:1.4;")}">${l.code}</span></td>
<td class="em-text" valign="top" style="padding:8px 0;${s(13, C.ink, "line-height:1.5;")}">${l.text} <a href="${URL_VAR}" target="_blank" style="color:${C.navy};font-weight:800;text-decoration:underline;">${l.link}&nbsp;&rarr;</a></td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;"><tr><td class="em-soft" bgcolor="${C.soft}" style="background:${C.soft};border-radius:12px;padding:10px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table>`;
}

function fallback() {
  return `<p class="em-muted" style="margin:18px 0 0;${s(12, C.muted, "line-height:1.5;")}">Ja poga nedarbojas, iekopē šo saiti pārlūkā:<br><a href="${URL_VAR}" style="color:${C.navy};word-break:break-all;">${URL_VAR}</a></p>`;
}

function security(text: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 0;"><tr><td class="em-soft" bgcolor="${C.yellowSoft}" style="background:${C.yellowSoft};border-left:4px solid ${C.yellow};border-radius:10px;padding:12px 16px;${s(13, C.ink, "line-height:1.5;")}">&#128274;&nbsp; ${text}</td></tr></table>`;
}

const IGNORE =
  "Saite ir vienreizēja un derīga ierobežotu laiku. Ja to nepieprasīji tu, vienkārši ignorē šo e-pastu — ar tavu kontu nekas nenotiks.";

type Tpl = { subject: string; eyebrow: string; title: string; intro: string; button: string; body?: string; other: { code: string; text: string; link: string }[] };

const T: Record<string, Tpl> = {
  magic: {
    subject: "Tava pieslēgšanās saite · Sisselogimine · Sign in — Divinol",
    eyebrow: "Pieslēgšanās",
    title: "Tava pieslēgšanās saite",
    intro: "Nospied pogu, lai pieslēgtos savam Divinol e-veikala kontam — parole nav vajadzīga.",
    button: "Pieslēgties",
    other: [
      { code: "ET", text: "Vajuta lingile, et Divinoli e-poodi sisse logida.", link: "Logi sisse" },
      { code: "EN", text: "Click the link to sign in to your Divinol shop account.", link: "Sign in" },
      { code: "RU", text: "Нажмите на ссылку, чтобы войти в аккаунт магазина Divinol.", link: "Войти" },
    ],
  },
  confirm: {
    subject: "Apstiprini e-pastu · Kinnita e-post · Confirm your e-mail — Divinol",
    eyebrow: "Reģistrācija",
    title: "Laipni lūgts Divinol e-veikalā!",
    intro: "Atliek tikai apstiprināt e-pasta adresi, un tavs konts būs gatavs.",
    button: "Apstiprināt e-pastu",
    body: `<p class="em-text" style="margin:0 0 6px;${s(15, C.ink)}">Ar kontu vari:</p>
<p class="em-text" style="margin:0;${s(14, C.ink, "line-height:1.9;")}"><span style="color:${C.yellow};font-weight:800;">&#10003;</span>&nbsp; sekot pasūtījumiem un piegādēm<br><span style="color:${C.yellow};font-weight:800;">&#10003;</span>&nbsp; lejupielādēt rēķinus PDF formātā<br><span style="color:${C.yellow};font-weight:800;">&#10003;</span>&nbsp; saglabāt piegādes adreses ātrākai pasūtīšanai<br><span style="color:${C.yellow};font-weight:800;">&#10003;</span>&nbsp; uzņēmumiem — pieteikties B2B cenām un apmaksai ar rēķinu</p>`,
    other: [
      { code: "ET", text: "Registreerimise lõpetamiseks kinnita oma e-posti aadress.", link: "Kinnita e-post" },
      { code: "EN", text: "Confirm your e-mail address to finish signing up.", link: "Confirm e-mail" },
      { code: "RU", text: "Подтвердите адрес эл. почты, чтобы завершить регистрацию.", link: "Подтвердить" },
    ],
  },
  recovery: {
    subject: "Paroles maiņa · Parooli muutmine · Reset password — Divinol",
    eyebrow: "Konta drošība",
    title: "Paroles maiņa",
    intro: "Saņēmām pieprasījumu mainīt tava Divinol konta paroli. Nospied pogu, lai izvēlētos jaunu paroli.",
    button: "Izvēlēties jaunu paroli",
    other: [
      { code: "ET", text: "Saime taotluse sinu Divinoli konto parooli muutmiseks.", link: "Muuda parooli" },
      { code: "EN", text: "We received a request to reset your Divinol account password.", link: "Reset password" },
      { code: "RU", text: "Мы получили запрос на смену пароля вашего аккаунта Divinol.", link: "Сменить пароль" },
    ],
  },
  email_change: {
    subject: "Apstiprini jauno e-pastu · Kinnita uus e-post · Confirm new e-mail — Divinol",
    eyebrow: "Konta drošība",
    title: "Apstiprini jauno e-pasta adresi",
    intro: "Lai mainītu sava Divinol konta e-pastu, apstiprini jauno adresi.",
    button: "Apstiprināt",
    body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 4px;"><tr><td class="em-soft em-rule" bgcolor="${C.soft}" style="background:${C.soft};border:1px solid ${C.rule};border-radius:10px;padding:12px 14px;">
<div class="em-muted" style="${s(11, C.muted, "font-weight:700;text-transform:uppercase;letter-spacing:0.08em;line-height:1.4;")}">Jaunā e-pasta adrese</div>
<div class="em-text" style="${s(17, C.ink, "font-weight:800;line-height:1.4;")}">{{ .NewEmail }}</div></td></tr></table>`,
    other: [
      { code: "ET", text: "Uue e-posti aadressi kinnitamiseks vajuta lingile.", link: "Kinnita" },
      { code: "EN", text: "Confirm the new e-mail address for your Divinol account.", link: "Confirm" },
      { code: "RU", text: "Подтвердите новый адрес эл. почты для аккаунта Divinol.", link: "Подтвердить" },
    ],
  },
};

const json: Record<string, { subject: string; body: string }> = {};
for (const [key, tpl] of Object.entries(T)) {
  const body = [tpl.body ?? "", cta(tpl.button), security(IGNORE), other(tpl.other), fallback()].join("\n");
  // auth e-mails come from the no-reply sender, so drop the "just reply" hint of the help card
  const html = layout(ctx, { title: tpl.subject, preheader: tpl.intro, hero: { eyebrow: tpl.eyebrow, title: tpl.title, intro: tpl.intro }, body }).replace(
    new RegExp(`<div[^>]*>${ctx.t("help.reply").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</div>`),
    "",
  );
  json[key] = { subject: tpl.subject, body: html };
  fs.writeFileSync(path.join(out, `auth-${key}.html`), html);
}
fs.writeFileSync(path.join(out, "auth.json"), JSON.stringify(json, null, 2));
console.log(Object.entries(json).map(([k, v]) => `${k}: ${v.subject} (${v.body.length} b)`).join("\n"));
