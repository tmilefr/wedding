(() => {
  let guests = [], couple = { first: '', second: '' }, bring = [];
  const $ = (id) => document.getElementById(id);
  function h(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const k of kids.flat(Infinity)) { if (k == null || k === false) continue; e.append(k.nodeType ? k : document.createTextNode(k)); }
    return e;
  }
  const api = async (url, opts) => {
    const r = await fetch(url, opts && { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (r.status === 401) { location.href = '/admin/login'; throw new Error(401); }
    if (!r.ok) throw new Error(r.status);
    return r.json();
  };
  $('logout').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    location.href = '/admin/login';
  });

  async function refresh() {
    const d = await api('/api/admin/guests');
    guests = d.guests; couple = d.couple; bring = d.bringOptions;
    render();
  }

  const people = (g) => (g.response && g.response.attending ? g.response.people : []);
  function tiles() {
    const answered = guests.filter((g) => g.response);
    const present = guests.filter((g) => g.response && g.response.attending);
    const all = present.flatMap((g) => g.response.people);
    const data = [
      [guests.length, 'invitations'],
      [answered.length, 'réponses reçues'],
      [guests.length - answered.length, 'en attente', true],
      [all.length, 'personnes présentes'],
      [all.filter((p) => p.sleepsOnSite).length, 'couchages à prévoir', true],
      [present.filter((g) => g.response.fridayDinner).reduce((n, g) => n + g.response.people.length, 0), 'au repas du vendredi'],
      [present.filter((g) => g.response.brunch).reduce((n, g) => n + g.response.people.length, 0), 'au brunch'],
      [present.filter((g) => g.response.extendMonday).reduce((n, g) => n + g.response.people.length, 0), 'prolongent jusqu\'au lundi'],
    ];
    $('tiles').replaceChildren(...data.map(([n, l, a]) => h('div', { class: 'tile' + (a ? ' accent' : '') }, h('b', {}, String(n)), h('span', {}, l))));
  }

  function respDetails(g) {
    const r = g.response;
    if (!r) return '';
    if (!r.attending) return h('span', { class: 'muted' }, r.comment || '—');
    const label = Object.fromEntries(bring.map((o) => [o.key, o.label]));
    const lines = [
      r.people.map((p) => `${p.firstName} ${p.lastName} (${p.age} ans${p.sleepsOnSite ? ', couchage' : ''}${p.diet ? ', ' + p.diet : ''})`).join(' ; '),
      r.fridayPresent ? `Vendredi : ${[r.fridayPrep && 'préparation', r.fridayDinner && 'repas'].filter(Boolean).join(' + ') || 'présent'}` : null,
      [...r.bring.map((k) => label[k]), r.bringOther].filter(Boolean).length ? `Apporte : ${[...r.bring.map((k) => label[k]), r.bringOther].filter(Boolean).join(', ')}` : null,
      r.regionalHas ? `Spécialité : ${r.regionalDetail.replace(/\n/g, ', ')}` : null,
      `Brunch : ${r.brunch ? 'oui' : 'non'} · Rangement : ${r.cleanup ? 'oui' : 'non'} · Lundi : ${r.extendMonday ? 'oui' : 'non'}`,
      r.comment ? `Message : ${r.comment}` : null,
    ].filter(Boolean);
    return h('details', { class: 'resp' }, h('summary', {}, 'Voir'), h('div', {}, lines.map((l) => h('div', {}, l))));
  }

  function rows() {
    const q = $('filter').value.trim().toLowerCase();
    const list = guests.filter((g) => !q || (g.name + ' ' + g.email).toLowerCase().includes(q));
    $('empty').hidden = guests.length > 0;
    $('rows').replaceChildren(...list.map((g) => {
      const r = g.response;
      const badge = !r ? h('span', { class: 'badge wait' }, 'En attente') : r.attending ? h('span', { class: 'badge ok' }, 'Présent') : h('span', { class: 'badge no' }, 'Absent');
      const copyBtn = h('button', { class: 'btn ghost small', onclick: async (e) => {
        try { await navigator.clipboard.writeText(g.link); e.target.textContent = 'Copié'; } catch { prompt('Copiez le lien :', g.link); }
        setTimeout(() => (e.target.textContent = 'Copier le lien'), 1500);
      } }, 'Copier le lien');
      return h('tr', {},
        h('td', {}, h('strong', {}, g.name), g.email ? h('div', { class: 'muted' }, g.email) : null),
        h('td', {}, badge),
        h('td', {}, r && r.attending ? String(r.people.length) : '—'),
        h('td', {}, r && r.attending ? String(r.people.filter((p) => p.sleepsOnSite).length) : '—'),
        h('td', {}, respDetails(g)),
        h('td', {}, h('div', { class: 'actions' },
          h('a', { class: 'btn small', href: `/admin/invite/${g.id}` }, 'Détail'),
          copyBtn,
          h('a', { class: 'btn ghost small', href: `/api/admin/qr/${g.id}.svg`, target: '_blank', rel: 'noopener' }, 'QR'),
          h('button', { class: 'btn link small', onclick: async () => {
            if (confirm(`Supprimer « ${g.name} » ? Sa réponse sera perdue.`)) { await api(`/api/admin/guests/${g.id}`, { method: 'DELETE' }); refresh(); }
          } }, 'Supprimer'))));
    }));
  }

  function cards() {
    $('cards').replaceChildren(...guests.map((g) =>
      h('div', { class: 'qrcard' },
        h('div', { class: 'names' }, `${couple.first} & ${couple.second}`),
        h('div', { class: 'hand' }, g.name),
        h('img', { src: `/api/admin/qr/${g.id}.svg`, alt: `QR code de ${g.name}` }),
        h('div', { class: 'muted', style: 'font-size:.8rem' }, 'Scannez pour répondre à l\'invitation'))));
  }

  function render() { tiles(); rows(); cards(); }

  $('filter').addEventListener('input', rows);
  $('printCards').addEventListener('click', () => window.print());
  refresh();
})();
