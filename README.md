# Divinol / SIA Elama — e-komercijas platforma

Next.js 16 + Supabase + Netlify. Valodas: lv, et, lt, en, ru. Domēni: divinol.lv (lv/lt/en/ru), divinol.ee (et).

## Struktūra
- `src/app/[locale]/` — publiskais veikals (sākums, katalogs, produkti, eļļas izvēle, kalkulatori, B2B, grozs, kase, klienta konts)
- `src/app/admin/` — administrācijas panelis (/admin): statistika, pasūtījumi, sūtījumi (pārvadātāji, uzlīmes, cenu salīdzinājums), rēķini (PDF), produkti, kategorijas, klienti, pieprasījumi, iestatījumi
- `src/messages/<valoda>/*.json` — visi teksti
- `src/data/products.seed.json` — sākotnējais katalogs (82 produkti / 175 iepakojumi, importēts no divinol.lv)
- `supabase/migrations/` — datubāzes shēma un funkcijas (jau uzliktas Supabase projektā "Divinol-Elama")

## Lokāli
```bash
npm install
npm run dev   # http://localhost:3000
```
`.env.local` jau satur Supabase URL un publisko atslēgu.

## Vides mainīgie (Netlify)
| Mainīgais | Vērtība |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | https://sfrcnefjlvsrmkicuqdk.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | publiskā atslēga |
| NEXT_PUBLIC_SITE_URL | galvenā adrese (pagaidām https://divinol-elama.netlify.app) |
| NEXT_PUBLIC_SITE_URL_LV / _EE | https://divinol.lv / https://divinol.ee (kad domēni pieslēgti) |
| NEXT_PUBLIC_NOINDEX | `true` testa versijai (Google neindeksē). Izņemt, kad pieslēgti īstie domēni |
| NEXT_PUBLIC_STRIPE_ENABLED | (vecs, neizmanto, ja pieslēgts Montonio) |
| MONTONIO_ACCESS_KEY / MONTONIO_SECRET_KEY / MONTONIO_ENV / SUPABASE_SERVICE_ROLE_KEY | Tiešsaistes maksājumi — sk. „Maksājumi (Montonio)” |
| OMNIVA_USERNAME / OMNIVA_PASSWORD / OMNIVA_CUSTOMER_CODE | Omniva OMX API (sūtījumi, uzlīmes, izsekošana). Neobligāti: OMNIVA_API_URL (tests: https://test-omx.omniva.eu/api/v01/omx/) |
| DPD_API_TOKEN | DPD eserviss API atslēga (sūtījumi, uzlīmes, izsekošana, Pickup punkti). Neobligāti: DPD_API_URL, DPD_COURIER_SERVICE, DPD_LABEL_PAPER=A4 |
| VENIPAK_USERNAME / VENIPAK_PASSWORD / VENIPAK_API_ID | Venipak API (sūtījumi, uzlīmes). Neobligāti: VENIPAK_API_URL, VENIPAK_LABEL_FORMAT=a4 |

Sūtījumi: /admin/shipping. Pārvadātāji bez API (SmartPosti, Unisend, Latvijas Pasts, DHL, kravas) strādā manuālajā režīmā — sūtījuma kodu ievada admins, uzlīmi (PDF) var augšupielādēt. Tarifi (izmaksas veikalam) — tabulā `shipping_rates`, klienta piegādes cena joprojām no iestatījumiem.

## E-pasti (Resend)
Veikals sūta e-pastus caur Resend HTTP API (`src/lib/email/`). Ja `RESEND_API_KEY` nav iestatīts, e-pasti vienkārši netiek sūtīti (žurnālā viens brīdinājums) — pasūtījumi un admin darbības strādā kā parasti. E-pasti tiek sūtīti pēc atbildes lietotājam (`after()`), tāpēc nekad nebremzē noformēšanu.

| Mainīgais | Nozīme |
|---|---|
| RESEND_API_KEY | Resend API atslēga (obligāta, lai e-pasti tiktu sūtīti) |
| EMAIL_FROM | Sūtītājs, noklusējums `Elama · Divinol <info@divinol.lv>` (domēnam divinol.lv jābūt verificētam Resend) |
| EMAIL_REPLY_TO | Atbildes adrese klientu e-pastiem; noklusējums — uzņēmuma e-pasts no Iestatījumiem (citādi elama@elama.lv) |
| SHOP_NOTIFY_EMAIL | Kur sūtīt paziņojumus veikalam (var vairākas, atdalot ar komatu); noklusējums — uzņēmuma e-pasts no Iestatījumiem |

Klientam (pasūtījuma valodā): pasūtījuma apstiprinājums (ar avansa rēķina PDF), „pasūtījums nosūtīts” (ar izsekošanas saiti), „pasūtījums atcelts”, izrakstīts rēķins (PDF pielikumā), B2B apstiprināts / noraidīts. Veikalam (latviski): jauns pasūtījums, kontaktforma / pieprasījumi, B2B pieteikumi. Teksti: `src/messages/<valoda>/emails.json`. Pārbaude: /admin/settings → „E-pasti” → „Nosūtīt testa e-pastu”.

## Maksājumi (Montonio)
Tiešsaistes apmaksa kasē caur [Montonio](https://www.montonio.com): **bankas saites** (Swedbank, SEB, Citadele, Luminor, LHV, Šiaulių u.c. — LV/EE/LT, klients izvēlas banku jau kasē pēc logo), **maksājumu kartes** (Visa/Mastercard) un **Apple Pay / Google Pay** (ieslēdzas kopā ar kartēm). Kamēr Montonio nav pieslēgts, kase strādā kā līdz šim (bankas pārskaitījums ar avansa rēķinu, B2B rēķins, apmaksa saņemot; „Bankas karte · Drīzumā”).

**Kas jādara īpašniekam (SIA Elama):**
1. Reģistrēties montonio.com → „Sign up” uzņēmumam SIA Elama, aizpildīt uzņēmuma profilu (Montonio pieprasītie uzņēmuma dati un bankas konts izmaksām) un sagaidīt Montonio apstiprinājumu. Pārliecināties, ka veikalam ieslēgtas bankas saites (LV/EE/LT) un karšu maksājumi.
2. Montonio Partner System (partner.montonio.com) → **Stores** → veikals → cilne **API Keys**: nokopēt *Access Key* un *Secret Key*. Sandbox atslēgas ir pieejamas uzreiz (testiem), Production — pēc apstiprināšanas. Ģenerējot jaunas atslēgas, vecās uzreiz vairs nedarbojas.
3. Netlify → Site configuration → Environment variables: ievadīt mainīgos no tabulas zemāk un pārpublicēt lapu (Deploys → Trigger deploy).
4. /admin/settings → „Tiešsaistes maksājumi (Montonio)”: jābūt „Pieslēgts”, redzamas bankas katrai valstij. Testēšanai atstāt `MONTONIO_ENV=sandbox` un veikt testa pirkumu; pēc tam ielikt Production atslēgas un `MONTONIO_ENV=production`.

| Mainīgais | Nozīme |
|---|---|
| MONTONIO_ACCESS_KEY | Montonio Access Key (Partner System → Stores → API Keys) |
| MONTONIO_SECRET_KEY | Montonio Secret Key (tur pat; slepens — nekur nerādīt) |
| MONTONIO_ENV | `sandbox` (noklusējums, testa maksājumi) vai `production` (īsti maksājumi) |
| SUPABASE_SERVICE_ROLE_KEY | Supabase → Project Settings → API Keys → `service_role` / secret key. Vajadzīgs, lai Montonio paziņojums (bez lietotāja sesijas) varētu atzīmēt pasūtījumu kā apmaksātu. Slepens — tikai Netlify vidē |

Montonio pusē **webhook adrese nav jāiestata**: veikals katram maksājumam nosūta `notificationUrl` = `https://<domēns>/api/payments/montonio/webhook` (adrese redzama /admin/settings). Ja Netlify priekšā ir ugunsmūris, jāatļauj Montonio IP 35.156.245.42 un 35.156.159.169.

**Kā tas strādā:** klients kasē izvēlas „Bankas saite” vai „Maksājumu karte” → pasūtījums tiek izveidots ar statusu „Gaida maksājumu” (preces rezervētas, avansa rēķins netiek izrakstīts) → klients tiek novirzīts uz Montonio → pēc apmaksas Montonio paziņo veikalam (webhook) un klients atgriežas lapā „/noformet/apmaksa”. Apmaksātam pasūtījumam automātiski tiek izrakstīts gala rēķins (ELA-, statuss „Apmaksāts”), klientam nosūtīts apstiprinājums ar rēķina PDF, veikalam — paziņojums par jaunu pasūtījumu. Ja klients maksājumu pārtrauc, atgriešanās lapā var maksāt vēlreiz (ar banku vai karti) vai pāriet uz bankas pārskaitījumu (tad tiek izsūtīts avansa rēķins). Ja maksājums netiek pabeigts ~30 min laikā (Montonio statuss ABANDONED), pasūtījums tiek atcelts un atlikumi atjaunoti. Pasūtījuma lapā adminā: Montonio ID, banka, maksātājs, maksājuma vēsture un poga „Atkārtoti pārbaudīt maksājumu” (nolasa statusu no Montonio API). Atmaksas veic Montonio Partner System; statuss „Atmaksāts / Daļēji atmaksāts” pie pasūtījuma atjaunojas automātiski.

## Pirmais admins
Reģistrējies lapā → datubāzē: `update profiles set role='admin' where email='...';`
Tad /admin → Produkti → "Importēt sākotnējo katalogu".
