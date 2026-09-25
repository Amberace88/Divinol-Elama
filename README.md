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
| NEXT_PUBLIC_STRIPE_ENABLED | `true`, kad pieslēgta karšu apmaksa |
| OMNIVA_USERNAME / OMNIVA_PASSWORD / OMNIVA_CUSTOMER_CODE | Omniva OMX API (sūtījumi, uzlīmes, izsekošana). Neobligāti: OMNIVA_API_URL (tests: https://test-omx.omniva.eu/api/v01/omx/) |
| DPD_API_TOKEN | DPD eserviss API atslēga (sūtījumi, uzlīmes, izsekošana, Pickup punkti). Neobligāti: DPD_API_URL, DPD_COURIER_SERVICE, DPD_LABEL_PAPER=A4 |
| VENIPAK_USERNAME / VENIPAK_PASSWORD / VENIPAK_API_ID | Venipak API (sūtījumi, uzlīmes). Neobligāti: VENIPAK_API_URL, VENIPAK_LABEL_FORMAT=a4 |

Sūtījumi: /admin/shipping. Pārvadātāji bez API (SmartPosti, Unisend, Latvijas Pasts, DHL, kravas) strādā manuālajā režīmā — sūtījuma kodu ievada admins, uzlīmi (PDF) var augšupielādēt. Tarifi (izmaksas veikalam) — tabulā `shipping_rates`, klienta piegādes cena joprojām no iestatījumiem.

## Pirmais admins
Reģistrējies lapā → datubāzē: `update profiles set role='admin' where email='...';`
Tad /admin → Produkti → "Importēt sākotnējo katalogu".
