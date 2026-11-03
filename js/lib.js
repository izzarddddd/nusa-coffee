/* Shared logic (browser + Node tests). Price/quantity rules live here and in schema.sql; keep them in sync. */
(function (root) {
  const SAMPLE_MIN_KG = 0.1, SAMPLE_MAX_KG = 5, RFQ_MAX_KG = 100000;
  const INCOTERMS = ['EXW', 'FOB', 'CFR', 'CIF'];
  const STATUSES = ['PENDING', 'SAMPLE_SENT', 'QUOTED', 'CONFIRMED', 'CANCELLED'];
  const STATUS_FLOW = {
    PENDING: ['SAMPLE_SENT', 'QUOTED', 'CANCELLED'],
    SAMPLE_SENT: ['QUOTED', 'CANCELLED'],
    QUOTED: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['CANCELLED'],
    CANCELLED: []
  };

  const round2 = n => Number(Math.round(Number(n) + 'e2') + 'e-2');
  const decimals = n => { const s = String(n); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };
  const estimate = (qtyKg, pricePerKg) => round2(Number(qtyKg) * Number(pricePerKg));
  const formatUSD = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const PHONE_RE = /^[+0-9 ()-]{6,30}$/;
  const CONTROL_RE = /[\x01-\x08\x0B\x0C\x0E-\x1F]/;

  /**
   * Returns { field: errorCode } (empty object = valid). Codes are translated by the UI (i18n key `err.<code>`).
   * kind: 'SAMPLE' | 'RFQ'; product needs moq_kg.
   */
  function validateRequest(p, product) {
    const e = {};
    const t = v => String(v ?? '').trim();
    const kind = String(p.kind || '').toUpperCase();
    if (kind !== 'SAMPLE' && kind !== 'RFQ') e.kind = 'invalid';
    if (t(p.company_name).length < 2 || t(p.company_name).length > 120) e.company_name = 'company_name';
    if (t(p.contact_name).length < 2 || t(p.contact_name).length > 120) e.contact_name = 'contact_name';
    if (!EMAIL_RE.test(t(p.email)) || t(p.email).length > 254) e.email = 'email';
    if (!PHONE_RE.test(t(p.phone))) e.phone = 'phone';
    if (t(p.country).length < 2 || t(p.country).length > 80) e.country = 'country';
    if (t(p.destination_port).length > 120) e.destination_port = 'destination_port';
    if (kind === 'RFQ' && !INCOTERMS.includes(t(p.incoterm).toUpperCase())) e.incoterm = 'incoterm';
    const q = Number(p.quantity_kg);
    if (p.quantity_kg === '' || p.quantity_kg == null || !Number.isFinite(q)) e.quantity_kg = 'quantity_required';
    else if (decimals(p.quantity_kg) > 2) e.quantity_kg = 'quantity_decimals';
    else if (kind === 'SAMPLE' && (q < SAMPLE_MIN_KG || q > SAMPLE_MAX_KG)) e.quantity_kg = 'sample_range';
    else if (kind === 'RFQ' && product && q < Number(product.moq_kg)) e.quantity_kg = 'below_moq';
    else if (kind === 'RFQ' && q > RFQ_MAX_KG) e.quantity_kg = 'too_large';
    const n = t(p.notes);
    if (n.length > 1000 || CONTROL_RE.test(n)) e.notes = 'notes';
    return e;
  }

  /** Admin product form: price > 0, stock >= 0, percentages 0..100, MOQ >= 1. */
  function validateProduct(p) {
    const e = {};
    const num = v => (v === '' || v == null ? NaN : Number(v));
    if (!String(p.name_en ?? '').trim()) e.name_en = 'English name is required.';
    if (!['ARABICA', 'ROBUSTA'].includes(p.species)) e.species = 'Choose Arabica or Robusta.';
    if (!(num(p.price_per_kg) > 0)) e.price_per_kg = 'Price must be greater than 0.';
    if (!(num(p.stock_kg) >= 0)) e.stock_kg = 'Stock cannot be negative.';
    if (!(num(p.moq_kg) >= 1)) e.moq_kg = 'MOQ must be at least 1 kg.';
    if (p.cupping_score !== '' && p.cupping_score != null && !(num(p.cupping_score) >= 0 && num(p.cupping_score) <= 100)) e.cupping_score = 'Cupping score is 0 to 100.';
    if (p.moisture_percentage !== '' && p.moisture_percentage != null && !(num(p.moisture_percentage) >= 0 && num(p.moisture_percentage) <= 100)) e.moisture_percentage = 'Moisture is 0 to 100.';
    if (String(p.image_url ?? '').trim() && !/^https:\/\/\S+$/i.test(String(p.image_url).trim())) e.image_url = 'Photo URL must start with https://';
    return e;
  }

  const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  /** Pick the text for a language, falling back to English when the translation is empty. */
  const localized = (row, field, lang) => (lang === 'id' && row[field + '_id'] ? row[field + '_id'] : row[field + '_en']) || '';

  const api = { SAMPLE_MIN_KG, SAMPLE_MAX_KG, RFQ_MAX_KG, INCOTERMS, STATUSES, STATUS_FLOW, round2, estimate, formatUSD,
    validateRequest, validateProduct, slugify, localized };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NCLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
