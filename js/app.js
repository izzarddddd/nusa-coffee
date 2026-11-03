/* Public storefront (English /en/ and Indonesian /id/ share this file; language comes from <html lang>). */
(function () {
  const LANG = document.documentElement.lang === 'id' ? 'id' : 'en';
  const OTHER = LANG === 'id' ? 'en' : 'id';
  const t = NCI18n.make(LANG);
  const L = NCLib, D = NCData;
  const app = document.getElementById('app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n, d = 0) => Number(n).toLocaleString(LANG === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: d });
  const tx = (row, f) => L.localized(row, f, LANG);
  try { localStorage.setItem('nc_lang', LANG); } catch (e) { /* storage may be blocked */ }

  let products = null, filter = 'ALL';

  /* ───────── static chrome ───────── */
  function chrome() {
    document.title = t('seo.title');
    const md = document.querySelector('meta[name="description"]'); if (md) md.content = t('seo.desc');
    document.getElementById('nav').innerHTML = `
      <a href="#/coffees">${esc(t('nav.coffees'))}</a><a href="#/how">${esc(t('nav.how'))}</a>
      <a href="#/eudr">${esc(t('nav.eudr'))}</a><a href="#/status">${esc(t('nav.status'))}</a>`;
    const sw = document.getElementById('lang');
    sw.innerHTML = `<span class="sr-only">${esc(t('lang.label'))}</span>
      <a href="../${LANG}/index.html" aria-current="true" lang="${LANG}">${LANG.toUpperCase()}</a>
      <a href="../${OTHER}/index.html" data-switch lang="${OTHER}" hreflang="${OTHER}">${OTHER.toUpperCase()}</a>`;
    const sl = sw.querySelector('[data-switch]');
    const upd = () => { sl.href = `../${OTHER}/index.html${location.hash}`; };
    upd(); window.addEventListener('hashchange', upd);
    document.getElementById('foot').innerHTML = `<p>${esc(t('footer.rights'))}</p>${D.DEMO || (products && products.some(p => p.is_sample_data)) ? `<p>${esc(t('footer.sample'))}</p>` : ''}`;
    if (D.DEMO) { const b = document.getElementById('demo'); b.hidden = false; b.textContent = t('demo.banner'); }
  }

  /* ───────── views ───────── */
  const specRows = p => [
    [t('spec.species'), t('species.' + p.species)],
    [t('spec.process'), p.process ? t('process.' + p.process) : t('spec.na')],
    [t('spec.variety'), p.variety || t('spec.na')],
    [t('spec.grade'), p.grade || t('spec.na')],
    [t('spec.cupping'), p.cupping_score != null ? nf(p.cupping_score, 1) : t('spec.na')],
    [t('spec.moisture'), p.moisture_percentage != null ? nf(p.moisture_percentage, 1) + '%' : t('spec.na')],
    [t('spec.screen'), p.screen_size || t('spec.na')],
    [t('spec.origin'), p.origin || t('spec.na')],
    [t('spec.lot'), p.lot_code || t('spec.na')],
    [t('spec.eudr'), p.eudr_ready ? t('spec.eudr.yes') : t('spec.eudr.no')]
  ];

  function card(p) {
    const out = p.status === 'OUT_OF_STOCK';
    return `<article class="card">
      ${p.image_url ? `<img class="photo" src="${esc(p.image_url)}" alt="${esc(tx(p, 'name'))}" width="400" height="300" loading="lazy">` : ''}
      <div class="card-top"><span class="chip chip-${p.species.toLowerCase()}">${esc(t('species.' + p.species))}</span>${p.is_sample_data ? `<span class="chip chip-sample">${esc(t('sample.badge'))}</span>` : ''}</div>
      <h3><a href="#/lot/${esc(p.slug)}">${esc(tx(p, 'name'))}</a></h3>
      <p class="meta">${esc([p.process ? t('process.' + p.process) : '', p.cupping_score != null ? t('spec.cupping') + ' ' + nf(p.cupping_score, 1) : '', p.moisture_percentage != null ? nf(p.moisture_percentage, 1) + '%' : ''].filter(Boolean).join(' · '))}</p>
      <p class="price"><span>${esc(t('card.from'))}</span> <b>${esc(L.formatUSD(p.price_per_kg))}</b>${esc(t('card.perkg'))}</p>
      <p class="meta">${esc(t('card.moq'))} ${esc(nf(p.moq_kg))} kg${out ? ` · ${esc(t('card.out'))}` : ''}</p>
      <a class="btn" href="#/lot/${esc(p.slug)}">${esc(t('card.view'))}</a></article>`;
  }

  function landing(scrollTo) {
    const list = (products || []).filter(p => filter === 'ALL' || p.species === filter);
    app.innerHTML = `
      <section class="hero"><p class="eyebrow">${esc(t('hero.eyebrow'))}</p><h1>${esc(t('hero.title'))}</h1><p>${esc(t('hero.text'))}</p>
        <p class="hero-cta"><a class="btn btn-primary" href="#/coffees">${esc(t('hero.cta'))}</a> <a class="btn" href="#/how">${esc(t('hero.cta2'))}</a></p></section>
      <section id="coffees"><h2>${esc(t('catalog.title'))}</h2>
        <div class="filters" role="group">${['ALL', 'ARABICA', 'ROBUSTA'].map(f => `<button type="button" class="pill" data-f="${f}" aria-pressed="${f === filter}">${esc(t(f === 'ALL' ? 'catalog.all' : 'catalog.' + f.toLowerCase()))}</button>`).join('')}</div>
        <div class="grid" id="grid">${products === null ? `<p>${esc(t('catalog.loading'))}</p>` : list.length ? list.map(card).join('') : `<p>${esc(t('catalog.empty'))}</p>`}</div></section>
      <section id="how"><h2>${esc(t('how.title'))}</h2><ol class="steps">${[1, 2, 3, 4].map(i => `<li><b>${esc(t(`how.${i}.t`))}</b><span>${esc(t(`how.${i}.d`))}</span></li>`).join('')}</ol></section>
      <section id="eudr"><h2>${esc(t('eudr.title'))}</h2><p>${esc(t('eudr.text'))}</p><p class="meta">${esc(t('eudr.note'))}</p></section>`;
    app.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; landing(); }));
    if (scrollTo) { const el = document.getElementById(scrollTo); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else window.scrollTo(0, 0);
  }

  async function lot(slug) {
    app.innerHTML = `<p>${esc(t('catalog.loading'))}</p>`;
    let p;
    try { p = await D.product(slug); } catch (e) { app.innerHTML = `<p role="alert">${esc(t('catalog.error'))}</p>`; return; }
    if (!p) { app.innerHTML = `<p>${esc(t('lot.notfound'))}</p><p><a href="#/coffees">${esc(t('lot.back'))}</a></p>`; return; }
    document.title = `${tx(p, 'name')} | ${t('brand')}`;
    const out = p.status === 'OUT_OF_STOCK';
    app.innerHTML = `
      <p><a href="#/coffees">&larr; ${esc(t('lot.back'))}</a></p>
      <article class="lot">${p.image_url ? `<img class="photo" src="${esc(p.image_url)}" alt="${esc(tx(p, 'name'))}" width="800" height="500">` : ''}<div class="card-top"><span class="chip chip-${p.species.toLowerCase()}">${esc(t('species.' + p.species))}</span>${p.is_sample_data ? `<span class="chip chip-sample">${esc(t('sample.badge'))}</span>` : ''}</div>
        <h1>${esc(tx(p, 'name'))}</h1><p>${esc(tx(p, 'description'))}</p>
        <table class="specs"><tbody>${specRows(p).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
          <tr><th scope="row">${esc(t('spec.stock'))}</th><td>${esc(nf(p.stock_kg))} kg</td></tr>
          <tr><th scope="row">${esc(t('spec.moq'))}</th><td>${esc(nf(p.moq_kg))} kg</td></tr>
          <tr><th scope="row">${esc(t('spec.price'))}</th><td><b>${esc(L.formatUSD(p.price_per_kg))}</b>${esc(t('card.perkg'))}</td></tr></tbody></table>
        <p class="meta">${esc(t('lot.price.note'))}</p>
        <p class="lot-cta"><button class="btn" data-kind="SAMPLE">${esc(t('lot.sample'))}</button> <button class="btn btn-primary" data-kind="RFQ"${out ? ' disabled' : ''}>${esc(t('lot.rfq'))}</button></p></article>`;
    app.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => requestForm(p, b.dataset.kind)));
    window.scrollTo(0, 0);
  }

  /* ───────── request form (sample or RFQ) ───────── */
  function requestForm(p, kind) {
    const dlg = document.getElementById('dlg');
    const key = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
    const f = (name, label, attrs = '') => `<label for="f-${name}">${esc(label)}</label><input id="f-${name}" name="${name}" ${attrs}><small class="err" data-err="${name}" role="alert"></small>`;
    dlg.innerHTML = `<form method="dialog" id="rf" novalidate><h2>${esc(t('form.title.' + kind))}</h2><p class="meta">${esc(tx(p, 'name'))}</p>
      ${f('company_name', t('form.company'), 'autocomplete="organization" required')}${f('contact_name', t('form.contact'), 'autocomplete="name" required')}
      ${f('email', t('form.email'), 'type="email" autocomplete="email" required')}${f('phone', t('form.phone'), 'type="tel" autocomplete="tel" required')}
      ${f('country', t('form.country'), 'autocomplete="country-name" required')}
      ${kind === 'RFQ' ? `<label for="f-incoterm">${esc(t('form.incoterm'))}</label><select id="f-incoterm" name="incoterm" required><option value="">${esc(t('form.incoterm.choose'))}</option>${L.INCOTERMS.map(i => `<option>${i}</option>`).join('')}</select><small class="err" data-err="incoterm" role="alert"></small>${f('destination_port', t('form.port'))}` : f('destination_port', t('form.port'))}
      ${f('quantity_kg', t(`form.qty.${kind}`, { moq: nf(p.moq_kg) }), 'inputmode="decimal" required')}
      <label for="f-notes">${esc(t('form.notes'))}</label><textarea id="f-notes" name="notes" rows="3" maxlength="1000"></textarea><small class="err" data-err="notes" role="alert"></small>
      <div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <p class="err" id="rf-msg" role="alert"></p>
      <div class="dlg-actions"><button type="button" class="btn" id="rf-cancel">${esc(t('form.cancel'))}</button><button class="btn btn-primary" id="rf-submit">${esc(t('form.submit'))}</button></div></form>`;
    const form = dlg.querySelector('#rf');
    dlg.querySelector('#rf-cancel').addEventListener('click', () => dlg.close());
    const showErrs = errs => {
      form.querySelectorAll('[data-err]').forEach(e => { e.textContent = errs[e.dataset.err] ? t('err.' + errs[e.dataset.err]) : ''; });
      form.querySelector('#rf-msg').textContent = Object.keys(errs).length ? t('form.fix') : '';
    };
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const v = Object.fromEntries(new FormData(form).entries());
      const payload = { ...v, kind, product_id: p.id, price_per_kg: p.price_per_kg };
      const errs = L.validateRequest(payload, p); showErrs(errs);
      if (Object.keys(errs).length) return;
      const btn = form.querySelector('#rf-submit'); btn.disabled = true; btn.textContent = t('form.sending');
      try {
        const res = await D.createRequest(payload, key, LANG);
        if (res.ok) return done(dlg, res);
        if (res.code === 'VALIDATION_ERROR') showErrs(res.errors || {});
        else form.querySelector('#rf-msg').textContent = t('err.' + res.code) !== 'err.' + res.code ? t('err.' + res.code) : t('err.generic');
      } catch (e) { form.querySelector('#rf-msg').textContent = t('err.generic'); }
      btn.disabled = false; btn.textContent = t('form.submit');
    });
    dlg.showModal();
  }

  function done(dlg, res) {
    const d = res.data;
    dlg.innerHTML = `<div class="done"><h2>${esc(t('form.done.title'))}</h2>
      <p>${esc(t('form.done.number'))}: <b class="mono">${esc(d.inquiry_number)}</b></p><p class="meta">${esc(t('form.done.save'))}</p>
      ${d.total_estimate != null ? `<p>${esc(t('form.done.total'))}: <b>${esc(L.formatUSD(d.total_estimate))}</b></p>` : ''}
      ${res.demo ? `<p class="err">${esc(t('form.done.demo'))}</p>` : ''}
      <button class="btn btn-primary" id="done-close">${esc(t('form.done.close'))}</button></div>`;
    dlg.querySelector('#done-close').addEventListener('click', () => dlg.close());
  }

  /* ───────── status lookup ───────── */
  function status() {
    document.title = `${t('status.title')} | ${t('brand')}`;
    app.innerHTML = `<h1>${esc(t('status.title'))}</h1><form id="sf" novalidate>
      <label for="s-n">${esc(t('status.number'))}</label><input id="s-n" name="n" autocomplete="off" required>
      <label for="s-e">${esc(t('status.email'))}</label><input id="s-e" name="e" type="email" autocomplete="email" required>
      <p><button class="btn btn-primary" id="s-go">${esc(t('status.check'))}</button></p></form><div id="s-out" role="status"></div>`;
    const out = app.querySelector('#s-out');
    app.querySelector('#sf').addEventListener('submit', async ev => {
      ev.preventDefault();
      const n = ev.target.n.value.trim(), e = ev.target.e.value.trim();
      if (!n || !e) return;
      const go = app.querySelector('#s-go'); go.disabled = true; go.textContent = t('status.checking');
      try {
        const r = await D.lookup(n, e);
        if (r.ok) {
          const d = r.data;
          out.innerHTML = `<table class="specs"><tbody>
            <tr><th scope="row">${esc(t('status.kind.' + d.kind))}</th><td class="mono">${esc(d.inquiry_number)}</td></tr>
            <tr><th scope="row">Status</th><td><b>${esc(t('status.' + d.status))}</b></td></tr>
            <tr><th scope="row">${esc(t('status.product'))}</th><td>${esc((LANG === 'id' && d.product_name_id) || d.product_name_en)}</td></tr>
            <tr><th scope="row">${esc(t('status.qty'))}</th><td>${esc(nf(d.quantity_kg, 2))} kg</td></tr>
            <tr><th scope="row">${esc(t('status.updated'))}</th><td>${esc(new Date(d.updated_at).toLocaleDateString(LANG === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium' }))}</td></tr></tbody></table>`;
        } else out.innerHTML = `<p class="err">${esc(t('status.' + (r.code === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'NOT_FOUND')))}</p>`;
      } catch (err) { out.innerHTML = `<p class="err">${esc(t('err.generic'))}</p>`; }
      go.disabled = false; go.textContent = t('status.check');
    });
    window.scrollTo(0, 0);
  }

  /* ───────── router ───────── */
  async function route() {
    const h = (location.hash || '#/').replace(/^#/, '');
    const m = h.match(/^\/lot\/([^/?#]+)/);
    if (m) return lot(decodeURIComponent(m[1]));
    if (h.startsWith('/status')) return status();
    document.title = t('seo.title');
    if (products === null) { landing(); try { products = await D.products(); } catch (e) { app.querySelector('#grid').innerHTML = `<p role="alert">${esc(t('catalog.error'))}</p>`; return; } chrome(); }
    landing({ '/coffees': 'coffees', '/how': 'how', '/eudr': 'eudr' }[h]);
  }

  chrome();
  window.addEventListener('hashchange', route);
  route();
})();
