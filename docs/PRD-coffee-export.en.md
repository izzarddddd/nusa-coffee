# PRD: Coffee Export Website (B2B Green Coffee)

**Status:** Draft 1 · **Date:** 2026-11-03 · **Reference:** Nusa Vanilla PRD (simplified and improved) · **Indonesian original:** [PRD-ekspor-kopi.md](PRD-ekspor-kopi.md)

> **[Assumption]** means the owner has not confirmed it yet. All assumptions are collected in 6.4.

## 1. Summary
A single-seller website for exporting green coffee beans. Importers and roasters abroad see a catalog with clear quality data, ask for a sample, then ask for a quote (RFQ). The owner manages products and requests from an admin portal. Why now: the EU anti-deforestation rule (EUDR) starts to apply at the end of 2026, so European buyers look for suppliers who can prove where the coffee comes from.

## 2. Background
- Indonesian coffee exports rose sharply: about 508.8 thousand tonnes in 2025, roughly 62.6% more than in 2024 ([Databoks/BPS](https://databoks.katadata.co.id/en/agroindustry/statistics/6a687272edc9d/indonesias-coffee-export-performance-surges-in-2025)). The United States was the largest destination in the first half of 2025 ([Databoks](https://databoks.katadata.co.id/en/trade/statistics/68b900896b359/united-states-indonesias-top-coffee-export-destination-first-half-of-2025)).
- Specialty buyers usually ask for a sample first, and specialty importers often require at least one bag (60 to 70 kg) ([Cafe Imports](https://cafeimports.com/europe/blog/?p=590)). So the "sample, then order" flow must exist from the start.
- EUDR applies from 30 December 2026 for medium and large operators, and from 30 June 2027 for micro and small enterprises. Coffee must come with plot coordinates (polygons for plots over 4 hectares) ([EFI summary](https://efi.int/sites/default/files/2026-08/preparedness-check-of-lao-coffee-for-eudr.pdf), [StoneX](https://www.stonex.com/en/insights/eudr-enters-a-new-phase-as-coffee-industry-shifts-from-preparation-to-execution/)). Some of these sources belong to compliance vendors, so check the official regulation text.

## 3. Objective
- **Objective:** buyers abroad can judge the quality and origin of the coffee and ask for a sample or a quote without a middleman.
- **Key results [Assumption, numbers not approved by the owner]:**
  1. At least 5 valid RFQs per month within 3 months after launch.
  2. At least 3 sample requests that lead to an RFQ within 3 months.
  3. The owner answers 90% of RFQs within 48 hours.

## 4. Market segments
The three groups in the vanilla reference (importer, specialty retailer, admin) are replaced by two segments defined by the job they want done. **[Assumption]** The owner must confirm both.

1. **Specialty coffee importers and traders** (Europe, US, Japan): looking for quality lots they can trace.
2. **Mid-size roasters who buy direct:** looking for single-origin coffee in small contract sizes.

Limits: retail (B2C) and other suppliers are not served in the first version.

## 5. Value propositions

**Segment 1: Specialty importers and traders**
- **Who:** importers supplying roasters in Europe and the US.
- **Why:** they must prove where the coffee comes from (EUDR) and its quality, or they cannot sell it.
- **What before:** sourcing through middlemen, origin and quality hard to verify, documents arrive late.
- **How:** a page per lot with cupping score, moisture, bean size, farm or cooperative, and plot data; sample and RFQ through one form.
- **What after:** they decide faster and can prepare compliance documents sooner.
- **Alternatives:** traders, online sourcing platforms ([FreshCup](https://freshcup.com/online-green-coffee-sourcing/)), trade fairs. They choose us when lot origin is proven and the price comes straight from the producer.

**Segment 2: Mid-size roasters**
- **Who:** roasters who want single-origin coffee from one trusted supplier.
- **Why:** hard to find an Indonesian supplier that is consistent and serves small quantities.
- **What before:** buying through importers with large minimums and little origin information.
- **How:** a catalog with clear minimum orders, cheap or free samples, and a request status that can be checked.
- **What after:** a first order with less quality risk.
- **Alternatives:** local importers and general B2B marketplaces.

**Value statement:** "Indonesian coffee with measured quality and farm origin you can prove, direct from the producer, from sample to contract."

## 6. Solution

### 6.1 Main flow
The buyer opens the catalog, opens a lot page, asks for a sample or sends an RFQ, receives a reference number, then checks the status with the number and email. The admin gets a notification, contacts the buyer, and updates the status.

### 6.2 Must-have features (version 1)
- **Catalog and lot page:** name, origin, variety, process (washed, natural, honey), grade, cupping score, moisture, bean size, indicative price in USD/kg, stock, minimum order. **Version 1 sells Arabica and Robusta only.**
- **Lot traceability (new compared with vanilla):** each lot has an ID, farm or cooperative, harvest date, and plot data for EUDR. Plot data is **not** shown publicly; only an "EUDR ready: yes/no" status.
- **Sample request:** a short form with sample size and destination. Counted as its own kind of request.
- **RFQ:** company, contact, country, quantity (kg), Incoterm, destination port, notes. The price is stored when the request is made; the reference number is unique.
- **Status check:** reference number plus email, with an attempt limit.
- **Admin portal:** manage products and lots, change request status, see a summary.
- **Spam protection (new):** CAPTCHA (for example Turnstile) and rate limiting through an Edge Function. In vanilla only a honeypot was used, and that was a gap.
- **Email notification to the admin** when a request arrives. Vanilla did not have this, and a missed request means a lost buyer.
- **Two languages: English and Indonesian.** English is the default because buyers are abroad. Visitors can switch language with a button on every public page, and the choice is remembered. Translated: all page text, product names and descriptions, the forms and their error messages, automatic emails, and the title and description for search engines. Each language has its own address so it can be found on Google. Technical data (quality numbers, prices, reference numbers) is the same in both languages.

### 6.3 Technology
Reuse the vanilla setup: static web on GitHub Pages and Supabase (Postgres, Auth, RLS) with RFQ rules in database functions. Additions: an Edge Function for email and rate limiting. For two languages, interface text lives in one translation file per language, and product columns have English and Indonesian versions. Vanilla used `#`-based addresses, which are not search-friendly, so a separate address per language (for example `/en/` and `/id/`) is used.

### 6.4 Assumptions and open questions
**Assumptions (not proven):**
- **[Assumption]** The owner is an exporter (or partners with a licensed exporter) and has access to lots with farm data.
- **[Assumption]** Segments 1 and 2 are right, and the main markets include Europe, the US and Japan.
- **[Assumption]** Payment is by bank transfer (T/T), confirmed manually in version 1.
- **[Assumption]** The key-result numbers in section 3 are reasonable for the owner's volume.
- **[Assumption]** Cupping scores exist or will be tested by a laboratory.
- **[Assumption]** The owner or team can write or check product text in both languages. Machine translation alone is risky for quality and legal terms.

**Open questions (only the owner knows):**
1. Where do the two coffees come from, what are the variety and process, and how many lots at the start?
2. Who handles shipping and export documents: the owner or a forwarder?
3. Are samples free, paid, or credited to the first order?
4. Is plot coordinate data available, and who collects it?
5. Which language does the admin portal use: Indonesian only, or English and Indonesian?
6. Should other languages (for example German or Japanese) be considered after version 1, given the target markets?

*Already decided:* the public site is in English (default) and Indonesian. Version 1 sells **Arabica and Robusta** only; other coffees come later.

## 7. Release

**Version 1 (estimated 8 to 10 weeks):** catalog and lot pages, sample and RFQ, status check, admin portal, admin email, and spam protection.

**Later versions:** export document generator (proforma, packing list), COA upload per lot, tiered pricing, international payments, a third language and beyond, plot data for EUDR buyers, other coffee types.

**Deliberately not in version 1:**
- Multi-seller marketplace and retail (B2C).
- Automatic card payments.
- Container tracking.
- Mobile app.
- Heavy animation. The vanilla reference has a long list of motion rules; they are **not** carried into this PRD. Visual details are decided at design time.
