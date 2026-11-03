/* Admin portal (English). Access is enforced by Row Level Security; the isAdmin() check here only decides what to show. */
(function () {
  const L = NCLib, D = NCData;
  const root = document.getElementById('admin'), nav = document.getElementById('anav');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
  const STATUS_LABEL = { PENDING: 'Received', SAMPLE_SENT: 'Sample sent', QUOTED: 'Quote sent', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled' };
  const badge = s => `<span class="badge badge-${esc(s)}">${esc(STATUS_LABEL[s] || s)}</span>`;
  const fmt = d => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const msg = (el, text) => { el.textContent = text || ''; };

  if (D.DEMO) { root.innerHTML = '<p>Admin needs Supabase. Fill <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in <code>config.js</code>.</p>'; return; }

  async function start() {
    const ok = await D.isAdmin();
    if (!ok) { nav.innerHTML = ''; return login(); }
    nav.innerHTML = '<a href="#/requests">Requests</a><a href="#/lots">Lots</a><button id="out">Log out</button>';
    document.getElementById('out').onclick = async () => { await D.logout(); location.hash = ''; start(); };
    route();
  }

  function login() {
    root.innerHTML = `<h1>Admin login</h1><form id="lf" class="card-admin"><label for="l-e">Email</label><input id="l-e" type="email" autocomplete="username" required>
      <label for="l-p">Password</label><input id="l-p" type="password" autocomplete="current-password" required><p class="err" id="l-m" role="alert"></p><button class="btn btn-primary">Log in</button></form>`;
    let wait = 0;
    root.querySelector('#lf').onsubmit = async ev => {
      ev.preventDefault();
      const b = ev.target.querySelector('button'); b.disabled = true;
      const ok = await D.login(root.querySelector('#l-e').value.trim(), root.querySelector('#l-p').value);
      if (ok && await D.isAdmin()) return start();
      if (ok) await D.logout();
      wait = Math.min(wait + 2, 10);  // growing pause after each failure
      msg(root.querySelector('#l-m'), 'Login failed.');
      setTimeout(() => { b.disabled = false; }, wait * 1000);
    };
  }

  function route() {
    const h = location.hash.replace(/^#/, '') || '/requests';
    if (h.startsWith('/lots')) return lots();
    return requests();
  }
  window.addEventListener('hashchange', () => { D.session().then(s => s && route()); });

  /* ───────── requests ───────── */
  async function requests(page = 1, status = '') {
    root.innerHTML = '<p>Loading...</p>';
    let r;
    try { r = await D.inquiries({ page, status }); } catch (e) { root.innerHTML = `<p class="err" role="alert">${esc(e.message)}</p>`; return; }
    root.innerHTML = `<h1>Requests</h1>
      <label for="flt">Status</label><select id="flt"><option value="">All</option>${L.STATUSES.map(s => `<option value="${s}"${s === status ? ' selected' : ''}>${esc(STATUS_LABEL[s])}</option>`).join('')}</select>
      <p class="meta">${r.total} total</p>
      <div class="tbl-wrap"><table class="tbl"><tr><th>Number</th><th>Type</th><th>Date</th><th>Company</th><th>Lot</th><th class="num">Kg</th><th>Status</th><th></th></tr>
      ${r.items.map(i => `<tr><td class="mono">${esc(i.inquiry_number)}</td><td>${esc(i.kind)}</td><td>${esc(fmt(i.created_at))}</td><td>${esc(i.company_name)}<br><small>${esc(i.country)}</small></td>
        <td>${esc(i.coffee_products?.name_en)}</td><td class="num">${nf(i.quantity_kg, 2)}</td><td>${badge(i.status)}</td><td><button class="btn btn-sm" data-open="${esc(i.id)}">Detail</button></td></tr>`).join('') || '<tr><td colspan="8">No requests yet.</td></tr>'}</table></div>
      <div class="pager"><button class="btn btn-sm" id="pv"${page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${r.page} of ${r.totalPages}</span><button class="btn btn-sm" id="nx"${page >= r.totalPages ? ' disabled' : ''}>Next</button></div><div id="detail"></div>`;
    root.querySelector('#flt').onchange = e => requests(1, e.target.value);
    root.querySelector('#pv').onclick = () => requests(page - 1, status);
    root.querySelector('#nx').onclick = () => requests(page + 1, status);
    root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => detail(r.items.find(i => i.id === b.dataset.open), page, status));
  }

  function detail(i, page, status) {
    const rows = [['Number', i.inquiry_number], ['Type', i.kind], ['Language', i.lang], ['Company', i.company_name], ['Contact', i.contact_name], ['Email', i.email], ['Phone', i.phone],
      ['Destination', i.country + (i.destination_port ? ', ' + i.destination_port : '')], ['Incoterm', i.incoterm || '-'], ['Lot', i.coffee_products?.name_en],
      ['Quantity', nf(i.quantity_kg, 2) + ' kg'], ['Price at request', L.formatUSD(i.price_snapshot_at_inquiry) + '/kg'],
      ['Indicative total', i.kind === 'RFQ' ? L.formatUSD(L.estimate(i.quantity_kg, i.price_snapshot_at_inquiry)) : '-'], ['Notes', i.notes || '-']];
    const el = root.querySelector('#detail');
    el.innerHTML = `<div class="card-admin"><h2>${esc(i.inquiry_number)} ${badge(i.status)}</h2><table class="specs"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td style="white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</tbody></table>
      <div class="row-actions">${(L.STATUS_FLOW[i.status] || []).map(s => `<button class="btn btn-sm" data-to="${s}">Mark: ${esc(STATUS_LABEL[s])}</button>`).join('') || '<span class="meta">No further status changes.</span>'}</div><p class="err" id="d-m" role="alert"></p></div>`;
    el.querySelectorAll('[data-to]').forEach(b => b.onclick = async () => {
      if (b.dataset.to === 'CANCELLED' && !confirm('Cancel this request?')) return;
      try { await D.setInquiryStatus(i.id, b.dataset.to); requests(page, status); } catch (e) { msg(el.querySelector('#d-m'), e.message); }
    });
    el.scrollIntoView({ behavior: 'smooth' });
  }

  /* ───────── lots ───────── */
  async function lots() {
    root.innerHTML = '<p>Loading...</p>';
    let list;
    try { list = await D.adminProducts(); } catch (e) { root.innerHTML = `<p class="err" role="alert">${esc(e.message)}</p>`; return; }
    root.innerHTML = `<h1>Lots</h1><p><button class="btn btn-primary" id="new">Add lot</button></p>
      <div class="tbl-wrap"><table class="tbl"><tr><th>Name</th><th>Species</th><th class="num">USD/kg</th><th class="num">MOQ</th><th class="num">Stock</th><th>Status</th><th></th></tr>
      ${list.map(p => `<tr><td>${esc(p.name_en)}${p.is_sample_data ? ' <small>(sample)</small>' : ''}</td><td>${esc(p.species)}</td><td class="num">${nf(p.price_per_kg, 2)}</td><td class="num">${nf(p.moq_kg)}</td><td class="num">${nf(p.stock_kg)}</td><td>${esc(p.status)}</td>
        <td class="row-actions"><button class="btn btn-sm" data-edit="${esc(p.id)}">Edit</button><button class="btn btn-sm" data-del="${esc(p.id)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="7">No lots.</td></tr>'}</table></div><div id="lotform"></div>`;
    root.querySelector('#new').onclick = () => lotForm({});
    root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => lotForm(list.find(p => p.id === b.dataset.edit)));
    root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm('Delete this lot? It is hidden, not erased.')) { try { await D.softDeleteProduct(b.dataset.del); lots(); } catch (e) { alert(e.message); } } });
  }

  function lotForm(p) {
    const f = (n, label, type = 'text', extra = '') => `<label for="p-${n}">${label}</label><input id="p-${n}" name="${n}" type="${type}" value="${esc(p[n] ?? '')}" ${extra}><small class="err" data-err="${n}"></small>`;
    const sel = (n, label, opts) => `<label for="p-${n}">${label}</label><select id="p-${n}" name="${n}">${opts.map(([v, l]) => `<option value="${v}"${(p[n] ?? '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select><small class="err" data-err="${n}"></small>`;
    const el = root.querySelector('#lotform');
    el.innerHTML = `<form class="card-admin" id="pf" novalidate style="max-width:none"><h2>${p.id ? 'Edit lot' : 'Add lot'}</h2><div class="form-grid">
      ${f('name_en', 'Name (English)')}${f('name_id', 'Name (Indonesian, optional)')}
      ${sel('species', 'Species', [['', 'Choose...'], ['ARABICA', 'Arabica'], ['ROBUSTA', 'Robusta']])}
      ${sel('process', 'Process', [['', 'Not stated'], ['WASHED', 'Washed'], ['NATURAL', 'Natural'], ['HONEY', 'Honey'], ['SEMI_WASHED', 'Semi-washed'], ['OTHER', 'Other']])}
      ${f('variety', 'Variety')}${f('grade', 'Grade')}${f('lot_code', 'Lot code')}${f('origin', 'Origin')}${f('screen_size', 'Screen size')}
      ${f('cupping_score', 'Cupping score (0-100)', 'text', 'inputmode="decimal"')}${f('moisture_percentage', 'Moisture %', 'text', 'inputmode="decimal"')}
      ${f('price_per_kg', 'Price USD/kg', 'text', 'inputmode="decimal"')}${f('moq_kg', 'MOQ (kg)', 'text', 'inputmode="decimal"')}${f('stock_kg', 'Stock (kg)', 'text', 'inputmode="decimal"')}
      ${sel('status', 'Status', [['AVAILABLE', 'Available'], ['OUT_OF_STOCK', 'Out of stock'], ['ARCHIVED', 'Archived (hidden)']])}${f('image_url', 'Photo URL (optional)')}</div>
      <label for="p-description_en">Description (English)</label><textarea id="p-description_en" name="description_en" rows="3">${esc(p.description_en ?? '')}</textarea>
      <label for="p-description_id">Description (Indonesian, optional)</label><textarea id="p-description_id" name="description_id" rows="3">${esc(p.description_id ?? '')}</textarea>
      <label><input type="checkbox" name="eudr_ready" style="width:auto"${p.eudr_ready ? ' checked' : ''}> EUDR plot data is ready for this lot</label>
      <p class="err" id="p-m" role="alert"></p><div class="row-actions"><button class="btn btn-primary">Save</button><button type="button" class="btn" id="pc">Cancel</button></div></form>`;
    el.querySelector('#pc').onclick = () => { el.innerHTML = ''; };
    el.querySelector('#pf').onsubmit = async ev => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(ev.target).entries());
      const errs = L.validateProduct(d);
      el.querySelectorAll('[data-err]').forEach(s => { s.textContent = errs[s.dataset.err] || ''; });
      if (Object.keys(errs).length) return msg(el.querySelector('#p-m'), 'Please check the highlighted fields.');
      const n = v => (v === '' ? null : +v), s = v => (String(v).trim() || null);
      const row = { id: p.id, name_en: d.name_en.trim(), name_id: s(d.name_id), slug: p.slug || L.slugify(d.name_en), species: d.species, process: s(d.process), variety: s(d.variety), grade: s(d.grade),
        lot_code: s(d.lot_code), origin: s(d.origin), screen_size: s(d.screen_size), cupping_score: n(d.cupping_score), moisture_percentage: n(d.moisture_percentage),
        price_per_kg: +d.price_per_kg, moq_kg: +d.moq_kg, stock_kg: +d.stock_kg, status: d.status, image_url: s(d.image_url), description_en: s(d.description_en), description_id: s(d.description_id),
        eudr_ready: !!d.eudr_ready, is_sample_data: false };
      if (!row.id) delete row.id;
      try { await D.saveProduct(row); lots(); } catch (e) { msg(el.querySelector('#p-m'), e.message); }
    };
    el.scrollIntoView({ behavior: 'smooth' });
  }

  start();
})();
