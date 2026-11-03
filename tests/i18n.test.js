const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { dict, make } = require('../js/i18n.js');
const L = require('../js/lib.js');

test('English and Indonesian have exactly the same keys', () => {
  const en = Object.keys(dict.en).sort(), id = Object.keys(dict.id).sort();
  assert.deepEqual(en.filter(k => !(k in dict.id)), [], 'keys missing in Indonesian');
  assert.deepEqual(id.filter(k => !(k in dict.en)), [], 'keys missing in English');
});

test('no translation is empty', () => {
  for (const lang of ['en', 'id']) for (const [k, v] of Object.entries(dict[lang])) assert.ok(String(v).trim(), `${lang}:${k} is empty`);
});

test('placeholders such as {moq} appear in both languages', () => {
  for (const k of Object.keys(dict.en)) {
    const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
    assert.equal(ph(dict.id[k]), ph(dict.en[k]), `placeholder mismatch in ${k}`);
  }
});

test('every validation error code has a translation in both languages', () => {
  const codes = ['invalid', 'company_name', 'contact_name', 'email', 'phone', 'country', 'destination_port', 'incoterm',
    'quantity_required', 'quantity_decimals', 'sample_range', 'below_moq', 'too_large', 'notes', 'RATE_LIMITED', 'PRODUCT_UNAVAILABLE', 'REJECTED', 'generic'];
  for (const c of codes) for (const lang of ['en', 'id']) assert.ok(dict[lang]['err.' + c], `${lang} missing err.${c}`);
});

test('every status, species and process has a label', () => {
  for (const lang of ['en', 'id']) {
    L.STATUSES.forEach(s => assert.ok(dict[lang]['status.' + s], `${lang} status.${s}`));
    ['ARABICA', 'ROBUSTA'].forEach(s => assert.ok(dict[lang]['species.' + s]));
    ['WASHED', 'NATURAL', 'HONEY', 'SEMI_WASHED', 'OTHER'].forEach(s => assert.ok(dict[lang]['process.' + s]));
  }
});

test('make() fills variables and falls back to English, then to the key', () => {
  assert.equal(make('id')('form.qty.RFQ', { moq: '60' }), 'Jumlah (kg, minimal 60)');
  assert.equal(make('en')('form.qty.RFQ', { moq: '60' }), 'Quantity (kg, minimum 60)');
  assert.equal(make('id')('does.not.exist'), 'does.not.exist');
});

test('every i18n key used in app.js exists in the dictionary', () => {
  const src = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  const used = new Set([...src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)].map(m => m[1]));
  // Keys ending in "." are dynamic prefixes (e.g. 'species.' + code); their full set is covered by the tests above.
  const missing = [...used].filter(k => !k.endsWith('.') && !(k in dict.en));
  assert.deepEqual(missing, []);
});

test('language pages are wired to the matching language', () => {
  const root = path.join(__dirname, '..');
  const en = fs.readFileSync(path.join(root, 'en/index.html'), 'utf8'), id = fs.readFileSync(path.join(root, 'id/index.html'), 'utf8');
  assert.match(en, /<html lang="en">/); assert.match(id, /<html lang="id">/);
  for (const html of [en, id]) { assert.match(html, /hreflang="en"/); assert.match(html, /hreflang="id"/); assert.match(html, /hreflang="x-default"/); }
  assert.match(en, /<link rel="canonical" href="[^"]*\/en\/">/); assert.match(id, /<link rel="canonical" href="[^"]*\/id\/">/);
});
