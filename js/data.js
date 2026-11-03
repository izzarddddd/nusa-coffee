/* Data access. Real mode talks to Supabase; demo mode (empty config) serves sample lots and saves nothing.
   Business rules for requests are enforced in the database functions (schema.sql). */
(function () {
  const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
  const sb = DEMO ? null : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const PUB_COLS = 'id,slug,lot_code,species,process,variety,grade,cupping_score,moisture_percentage,screen_size,origin,eudr_ready,name_en,name_id,description_en,description_id,price_per_kg,moq_kg,stock_kg,status,image_url,is_sample_data';
  const NUM = ['cupping_score', 'moisture_percentage', 'price_per_kg', 'moq_kg', 'stock_kg'];
  const num = r => { const o = { ...r }; NUM.forEach(k => { if (o[k] != null) o[k] = +o[k]; }); return o; };
  const fail = e => { const err = new Error(e.message || 'Error'); err.code = e.code; throw err; };

  const DEMO_PRODUCTS = [
    { id: 'demo-a1', slug: 'sample-arabica-washed', lot_code: 'SAMPLE-A1', species: 'ARABICA', process: 'WASHED', variety: null, grade: 'Specialty',
      cupping_score: 83, moisture_percentage: 11.5, screen_size: '16-18', origin: null, eudr_ready: false,
      name_en: 'Sample Arabica, Washed', name_id: 'Contoh Arabika, Washed',
      description_en: 'Sample entry. Replace with a real lot: origin, variety, process and cupping score must come from the producer.',
      description_id: 'Data contoh. Ganti dengan lot asli: asal, varietas, proses, dan skor cupping harus dari produsen.',
      price_per_kg: 8.5, moq_kg: 60, stock_kg: 600, status: 'AVAILABLE', image_url: null, is_sample_data: true },
    { id: 'demo-r1', slug: 'sample-robusta-natural', lot_code: 'SAMPLE-R1', species: 'ROBUSTA', process: 'NATURAL', variety: null, grade: 'Grade 1',
      cupping_score: null, moisture_percentage: 12, screen_size: '15-17', origin: null, eudr_ready: false,
      name_en: 'Sample Robusta, Natural', name_id: 'Contoh Robusta, Natural',
      description_en: 'Sample entry. Replace with a real lot before publishing.',
      description_id: 'Data contoh. Ganti dengan lot asli sebelum dipublikasikan.',
      price_per_kg: 4.2, moq_kg: 300, stock_kg: 3000, status: 'AVAILABLE', image_url: null, is_sample_data: true }
  ];

  const D = {
    DEMO, sb,
    async products() {
      if (DEMO) return DEMO_PRODUCTS.slice();
      const { data, error } = await sb.from('coffee_products').select(PUB_COLS).is('deleted_at', null).neq('status', 'ARCHIVED').order('created_at');
      if (error) fail(error);
      return data.map(num).sort((a, b) => (a.status === 'OUT_OF_STOCK') - (b.status === 'OUT_OF_STOCK'));
    },
    async product(slug) {
      if (DEMO) return DEMO_PRODUCTS.find(p => p.slug === slug) || null;
      const { data, error } = await sb.from('coffee_products').select(PUB_COLS).eq('slug', slug).is('deleted_at', null).neq('status', 'ARCHIVED').maybeSingle();
      if (error) fail(error);
      return data ? num(data) : null;
    },
    async createRequest(p, key, lang) {
      if (DEMO) return { ok: true, demo: true, data: { inquiry_number: 'DEMO-0000', status: 'PENDING', kind: p.kind,
        total_estimate: p.kind === 'RFQ' ? NCLib.estimate(p.quantity_kg, p.price_per_kg) : null } };
      const { data, error } = await sb.rpc('create_inquiry', {
        p_kind: p.kind, p_product_id: p.product_id, p_company_name: p.company_name, p_contact_name: p.contact_name,
        p_email: p.email, p_phone: p.phone, p_country: p.country, p_quantity_kg: p.quantity_kg,
        p_incoterm: p.incoterm || null, p_destination_port: p.destination_port || null, p_notes: p.notes || null,
        p_idempotency_key: key, p_website: p.website || '', p_lang: lang
      });
      if (error) fail(error);
      return data;
    },
    async lookup(number, email) {
      if (DEMO) return { ok: false, code: 'NOT_FOUND' };
      const { data, error } = await sb.rpc('lookup_inquiry', { p_inquiry_number: number, p_email: email });
      if (error) fail(error);
      return data;
    },

    /* ───────── admin (real mode only) ───────── */
    async session() { const { data } = await sb.auth.getSession(); return data.session; },
    async isAdmin() {
      const s = await D.session(); if (!s) return false;
      const { data } = await sb.from('admins').select('user_id').eq('user_id', s.user.id).maybeSingle();
      return !!data;
    },
    async login(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); return !error; },
    logout() { return sb.auth.signOut(); },
    async adminProducts() {
      const { data, error } = await sb.from('coffee_products').select('*').is('deleted_at', null).order('created_at');
      if (error) fail(error);
      return data.map(num);
    },
    async saveProduct(row) {
      const { id, ...rest } = row;
      const q = id ? sb.from('coffee_products').update(rest).eq('id', id) : sb.from('coffee_products').insert(rest);
      const { error } = await q;
      if (error) { if (error.code === '23505') { const e = new Error('Slug already used by another lot. Change the English name.'); e.code = 'DUPLICATE'; throw e; } fail(error); }
    },
    async softDeleteProduct(id) { const { error } = await sb.from('coffee_products').update({ deleted_at: new Date().toISOString() }).eq('id', id); if (error) fail(error); },
    async inquiries({ status = '', page = 1, limit = 20 } = {}) {
      let q = sb.from('inquiries').select('*, coffee_products(name_en)', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
      if (status) q = q.eq('status', status);
      const { data, error, count } = await q;
      if (error) fail(error);
      return { items: data, total: count || 0, page, limit, totalPages: Math.max(1, Math.ceil((count || 0) / limit)) };
    },
    async setInquiryStatus(id, status) { const { error } = await sb.from('inquiries').update({ status }).eq('id', id); if (error) fail(error); }
  };
  window.NCData = D;
})();
