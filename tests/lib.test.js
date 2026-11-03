const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/lib.js');

const good = { kind: 'RFQ', company_name: 'Acme Roasters', contact_name: 'Jo Doe', email: 'jo@acme.com', phone: '+31 20 123 4567',
  country: 'Netherlands', incoterm: 'FOB', quantity_kg: 60, notes: '' };
const product = { moq_kg: 60 };

test('estimate multiplies quantity by price and rounds to 2 decimals', () => {
  assert.equal(L.estimate(60, 8.5), 510);
  assert.equal(L.estimate(33.33, 4.2), 139.99);
});

test('a complete RFQ at the MOQ is valid', () => {
  assert.deepEqual(L.validateRequest(good, product), {});
});

test('RFQ below MOQ, zero, empty and >2 decimals are rejected', () => {
  assert.equal(L.validateRequest({ ...good, quantity_kg: 59.99 }, product).quantity_kg, 'below_moq');
  assert.equal(L.validateRequest({ ...good, quantity_kg: 0 }, product).quantity_kg, 'below_moq');
  assert.equal(L.validateRequest({ ...good, quantity_kg: '' }, product).quantity_kg, 'quantity_required');
  assert.equal(L.validateRequest({ ...good, quantity_kg: '60.123' }, product).quantity_kg, 'quantity_decimals');
  assert.equal(L.validateRequest({ ...good, quantity_kg: 100001 }, product).quantity_kg, 'too_large');
});

test('RFQ needs a valid Incoterm', () => {
  assert.equal(L.validateRequest({ ...good, incoterm: '' }, product).incoterm, 'incoterm');
  assert.equal(L.validateRequest({ ...good, incoterm: 'DDP' }, product).incoterm, 'incoterm');
  assert.equal(L.validateRequest({ ...good, incoterm: 'cif' }, product).incoterm, undefined);
});

test('sample size must be 0.1 to 5 kg and needs no Incoterm', () => {
  const s = { ...good, kind: 'SAMPLE', incoterm: '', quantity_kg: 0.5 };
  assert.deepEqual(L.validateRequest(s, product), {});
  assert.equal(L.validateRequest({ ...s, quantity_kg: 0.05 }, product).quantity_kg, 'sample_range');
  assert.equal(L.validateRequest({ ...s, quantity_kg: 5.01 }, product).quantity_kg, 'sample_range');
});

test('bad email, phone, short names and unknown kind are rejected', () => {
  const e = L.validateRequest({ ...good, kind: 'X', email: 'nope', phone: 'abc', company_name: 'A', contact_name: '' }, product);
  assert.deepEqual(Object.keys(e).sort(), ['company_name', 'contact_name', 'email', 'kind', 'phone']);
});

test('notes over 1000 characters or with control characters are rejected', () => {
  assert.equal(L.validateRequest({ ...good, notes: 'x'.repeat(1001) }, product).notes, 'notes');
  assert.equal(L.validateRequest({ ...good, notes: 'hi\x07' }, product).notes, 'notes');
  assert.equal(L.validateRequest({ ...good, notes: 'line1\nline2' }, product).notes, undefined);
});

test('admin product form: price, stock, MOQ, score, moisture and photo URL rules', () => {
  const ok = { name_en: 'Lot', species: 'ARABICA', price_per_kg: '8.5', stock_kg: '0', moq_kg: '1', cupping_score: '', moisture_percentage: '', image_url: '' };
  assert.deepEqual(L.validateProduct(ok), {});
  assert.ok(L.validateProduct({ ...ok, price_per_kg: '0' }).price_per_kg);
  assert.ok(L.validateProduct({ ...ok, stock_kg: '-1' }).stock_kg);
  assert.ok(L.validateProduct({ ...ok, moq_kg: '0.5' }).moq_kg);
  assert.ok(L.validateProduct({ ...ok, cupping_score: '101' }).cupping_score);
  assert.ok(L.validateProduct({ ...ok, moisture_percentage: '-2' }).moisture_percentage);
  assert.ok(L.validateProduct({ ...ok, species: 'LIBERICA' }).species);
  assert.ok(L.validateProduct({ ...ok, image_url: 'http://x.test/a.jpg' }).image_url);
  assert.ok(L.validateProduct({ ...ok, image_url: 'javascript:alert(1)' }).image_url);
  assert.deepEqual(L.validateProduct({ ...ok, image_url: 'https://x.test/a.jpg' }), {});
});

test('status flow matches the database trigger', () => {
  assert.deepEqual(L.STATUS_FLOW.PENDING, ['SAMPLE_SENT', 'QUOTED', 'CANCELLED']);
  assert.deepEqual(L.STATUS_FLOW.SAMPLE_SENT, ['QUOTED', 'CANCELLED']);
  assert.deepEqual(L.STATUS_FLOW.QUOTED, ['CONFIRMED', 'CANCELLED']);
  assert.deepEqual(L.STATUS_FLOW.CONFIRMED, ['CANCELLED']);
  assert.deepEqual(L.STATUS_FLOW.CANCELLED, []);
});

test('localized text falls back to English when the Indonesian text is empty', () => {
  const row = { name_en: 'Sample', name_id: 'Contoh' };
  assert.equal(L.localized(row, 'name', 'id'), 'Contoh');
  assert.equal(L.localized(row, 'name', 'en'), 'Sample');
  assert.equal(L.localized({ name_en: 'Sample', name_id: null }, 'name', 'id'), 'Sample');
});

test('slugify strips accents and symbols', () => {
  assert.equal(L.slugify('Arabica, Washed (Lot #1)'), 'arabica-washed-lot-1');
});
