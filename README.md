# Nusa Coffee

Green coffee export site (Arabica and Robusta, single seller) for importers and roasters. Browse lots, request a sample or a quote (RFQ), check request status, and manage everything from an admin portal. **English and Indonesian.**

"Nusa Coffee" is a placeholder brand name. Change it in `js/i18n.js`, the three `index.html` files and `css`/title tags once the real name is chosen.

- **Product spec:** [`docs/PRD-coffee-export.en.md`](docs/PRD-coffee-export.en.md) (English) and [`docs/PRD-ekspor-kopi.md`](docs/PRD-ekspor-kopi.md) (Indonesian).
- **Frontend:** static HTML, CSS and JavaScript, no build step. Meant for GitHub Pages.
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security). Request rules live in database functions (`schema.sql`).

## Languages
| Path | Language |
|---|---|
| `/` | Redirects to the saved choice, then the browser language, then English |
| `/en/` | English (default, canonical for `x-default`) |
| `/id/` | Indonesian |
| `/admin/` | Admin portal, English only for now |

Each language has its own URL, `hreflang` links, and its own `<title>` and description. The language switch keeps you on the same page. UI text is in `js/i18n.js`; product names and descriptions have `_en` and `_id` columns and fall back to English when the Indonesian text is empty. `tests/i18n.test.js` fails if a key exists in one language only.

Inside each language page, lots use `#/lot/<slug>`. Individual lot pages are therefore not separate URLs for search engines yet (see "Not done").

## Run locally
```
npm test          # 19 tests: request rules, i18n parity, language pages (Node built-in, no dependencies)
npm run serve     # or: python -m http.server 5174, then open http://127.0.0.1:5174/en/
```
With `SUPABASE_URL` / `SUPABASE_ANON_KEY` empty in `config.js` the site runs in **demo mode**: two sample lots, requests are not saved, and a banner says so.

## Set up Supabase
1. Create a project at supabase.com.
2. SQL Editor: paste all of `schema.sql` and run. It is safe to re-run (policies and triggers are recreated). It also inserts two **sample** lots marked `is_sample_data`.
3. Fill `config.js` with the Project URL and **anon key** (Project Settings, API). Never use the `service_role` key here.
4. Authentication, Users: add the admin user (tick Auto Confirm), then:
   ```sql
   insert into admins (user_id) select id from auth.users where email = 'ADMIN_EMAIL';
   ```
5. Authentication, Providers, Email: turn **off** "Enable sign ups". One admin account is created by hand.
6. Open `/admin/`, log in, replace the sample lots with real ones (Lots, Add lot) and delete the samples.

## Deploy (GitHub Pages)
Settings, Pages, Deploy from a branch, `main` / root. GitHub Pages on a private repository needs a paid plan; make the repository public or use another static host. Then set `window.SITE_URL` in `config.js` and update the URLs in `sitemap.xml`, `robots.txt` and the `canonical`/`hreflang` tags.

## What was improved over Nusa Vanilla
| Vanilla finding | Here |
|---|---|
| Only a honeypot against spam | Per-email (5/hour) and global (300/hour) limits in `create_inquiry`. A real CAPTCHA is still needed (see below). |
| Anyone could lock out the owner of an RFQ number by failing lookups | Lookup limit is per (number + email), so a wrong email never blocks the real owner |
| Idempotency key could reveal another buyer's RFQ | Replay only works with the same email |
| Lookup attempts table grew forever | Pruned on every lookup (older than 1 day) |
| `pg_sleep(0.25)` held a connection per call | Removed |
| `#` URLs only, weak for search | Separate `/en/` and `/id/` pages with `hreflang` |
| Validation messages in one language only | Database returns error codes; the page translates them |
| Policies not updated on re-run | Policies dropped and recreated |

## Not done yet (be honest before launch)
- **CAPTCHA (Cloudflare Turnstile) and per-IP rate limit.** Needs a Supabase Edge Function. The database throttles above are a stop-gap, and they can also be used to block a real buyer's email for an hour.
- **Email notification to the admin** when a request arrives (Database Webhook + Edge Function + email provider). Until then, check the admin portal regularly.
- **Email to the buyer.** Not built.
- **Separate indexable URL per lot** (needs a build step or pre-generated pages).
- **Admin in Indonesian.** Open question in the PRD.
- **EUDR plot data per lot.** Only a yes/no flag exists. Storing plot coordinates safely is a separate piece of work and needs a decision on who collects them.
- **Real content:** lots, origin, cupping scores, photos, certificates, brand name, contact details, privacy policy and terms. The sample prices (USD 8.50 and 4.20) are placeholders, not market prices.
- **Not verified against a live database.** The SQL functions were written carefully but not run on a real Supabase project; run the smoke test below first. Lighthouse (speed, accessibility) was not measured.

## Smoke test after connecting Supabase
1. Open `/en/`, request a sample for a lot, note the reference number.
2. Check status with number and email (`/en/#/status`). A wrong email must say "not found".
3. Log in at `/admin/`, find the request, move it Received, Sample sent, Quote sent.
4. Try an invalid jump (Received to Confirmed) and confirm the database refuses it.
5. As a visitor, confirm you cannot read `inquiries` (the REST API must return an empty list or an error).

## Structure
```
index.html          language redirect
en/ id/             the two language pages
admin/              admin portal (English)
config.js           Supabase URL and anon key, SITE_URL
schema.sql          tables, RLS, triggers, RPC functions, sample lots
css/                styles.css, admin.css
js/lib.js           shared rules (browser + tests)
js/i18n.js          English and Indonesian text
js/data.js          Supabase access and demo mode
js/app.js           public site
js/admin.js         admin portal
tests/              unit tests
docs/               PRD in English and Indonesian
```
