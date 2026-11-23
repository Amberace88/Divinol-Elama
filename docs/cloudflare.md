# Divinol on Cloudflare Workers

Built with OpenNext (`@opennextjs/cloudflare`). Config: `wrangler.jsonc`, `open-next.config.ts`.

- Build: `npx opennextjs-cloudflare build` · Deploy: `npx opennextjs-cloudflare deploy` (Workers Builds runs both on every push to `main`).
- Cache: R2 bucket `divinol-opennext-cache` (ISR / `unstable_cache`), D1 `divinol-tag-cache` (`revalidateTag`), Durable Object queue.
- Public build values live in `.env.production` (Supabase URL + anon key, site URLs).
- Runtime secrets (Workers → divinol → Settings → Variables and Secrets, type **Secret**):
  `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `OMNIVA_USERNAME`, `OMNIVA_PASSWORD`, `OMNIVA_CUSTOMER_CODE`, `MONTONIO_ENV`
  (+ optional `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_*`, `MONTONIO_*`, `STRIPE_*`, `DPD_*`, `VENIPAK_*`, `PAYMENT_LINK_SECRET`, `ANALYTICS_SALT`).
- No filesystem on Workers: files from /public are read with `readPublicFile()` (src/lib/runtime-files.ts). Invoice PDFs use pdf-lib.
- SMTP on Workers goes through worker-mailer (cloudflare:sockets), Node keeps nodemailer.
