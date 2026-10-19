(() => {
  const id = location.pathname.split('/').pop();
  const root = document.getElementById('fiche');
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
  const yn = (v) => (v ? 'Oui' : 'Non');
  const fmt = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  async function load() {
    const r = await fetch(`/api/admin/guests/${encodeURIComponent(id)}`);
    if (!r.ok) { root.replaceChildren(h('p', {}, 'Invité introuvable.'), h('a', { href: '/admin' }, 'Retour à la liste')); return; }
    render(await r.json());
  }

  function kv(rows) {
    return h('dl', { class: 'kv' }, rows.filter(Boolean).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
  }

  function render({ guest: g, bringOptions }) {
    const r = g.response;
    const label = Object.fromEntries(bringOptions.map((o) => [o.key, o.label]));
    document.title = `Fiche · ${g.name}`;
    const badge = !r ? h('span', { class: 'badge wait' }, 'En attente de réponse')
      : r.attending ? h('span', { class: 'badge ok' }, 'Présent') : h('span', { class: 'badge no' }, 'Absent');

    const nameIn = h('input', { type: 'text', id: 'ename', value: g.name });
    const mailIn = h('input', { type: 'text', id: 'email', value: g.email || '' });
    const msg = h('span', { class: 'muted', role: 'status' });

    const parts = [
      h('div', { class: 'panel' },
        h('div', { class: 'toolbar' }, h('h1', {}, g.name), badge),
        r ? h('p', { class: 'muted', style: 'margin:.4rem 0 0' }, `Réponse du ${fmt(g.respondedAt)}`) : null,
        g.email ? h('p', { class: 'muted', style: 'margin:.2rem 0 0' }, g.email) : null,
        h('p', { class: 'muted', style: 'margin:.2rem 0 0' }, g.mail && g.mail.sentAt ? `Invitation envoyée le ${fmt(g.mail.sentAt)}${g.mail.count > 1 ? ` (${g.mail.count} envois)` : ''}` : 'Invitation pas encore envoyée')),
    ];

    if (r && r.attending) {
      const ps = r.people;
      parts.push(
        h('div', { class: 'tiles' },
          [[ps.length, 'personnes'], [ps.filter((p) => p.age >= 18).length, 'adultes'], [ps.filter((p) => p.age < 18).length, 'enfants'],
           [ps.filter((p) => p.sleepsOnSite).length, 'couchages']].map(([n, l]) => h('div', { class: 'tile' }, h('b', {}, String(n)), h('span', {}, l)))),
        h('div', { class: 'panel' }, h('h2', {}, 'Personnes'),
          h('div', { class: 'tablewrap' }, h('table', {},
            h('thead', {}, h('tr', {}, ['Prénom', 'Nom', 'Âge', 'Couchage', 'Régime / allergies'].map((t) => h('th', {}, t)))),
            h('tbody', {}, ps.map((p) => h('tr', {}, h('td', {}, p.firstName), h('td', {}, p.lastName), h('td', {}, `${p.age} ans`), h('td', {}, yn(p.sleepsOnSite)), h('td', {}, p.diet || '—'))))))),
        h('div', { class: 'panel' }, h('h2', {}, 'Week-end'),
          kv([
            ['Présent dès le vendredi', yn(r.fridayPresent)],
            r.fridayPresent ? ['Préparation / repas du soir', `${yn(r.fridayPrep)} / ${yn(r.fridayDinner)}`] : null,
            r.fridayPresent ? ['Apporte', [...r.bring.map((k) => label[k]), r.bringOther].filter(Boolean).join(', ') || 'Rien de particulier'] : null,
            ['Spécialité régionale', r.regionalHas ? r.regionalDetail || 'Oui (non précisée)' : 'Aucune'],
            ['Brunch du dimanche', yn(r.brunch)],
            ['Aide au rangement', yn(r.cleanup)],
            ['Prolonge jusqu\'au lundi', yn(r.extendMonday)],
          ])));
    }
    if (r && r.comment) parts.push(h('div', { class: 'panel' }, h('h2', {}, 'Message'), h('p', { style: 'white-space:pre-line;margin:0' }, r.comment)));
    if (!r) parts.push(h('div', { class: 'panel' }, h('p', { style: 'margin:0' }, 'Cet invité n\'a pas encore répondu. Pensez à lui renvoyer son lien ci-dessous.')));

    parts.push(
      h('div', { class: 'panel noprint' }, h('h2', {}, 'Lien personnel'),
        h('div', { class: 'linkrow' },
          h('img', { src: `/api/admin/qr/${g.id}.svg`, alt: `QR code de ${g.name}` }),
          h('div', {}, h('code', {}, g.link), h('p', { style: 'margin:.6rem 0 0' },
            h('button', { class: 'btn ghost small', onclick: async (e) => {
              try { await navigator.clipboard.writeText(g.link); e.target.textContent = 'Copié'; } catch { prompt('Copiez le lien :', g.link); }
            } }, 'Copier le lien'))))),
      h('div', { class: 'panel noprint' }, h('h2', {}, 'Modifier l\'invité'),
        h('div', { class: 'editrow' },
          h('div', {}, h('label', { for: 'ename' }, 'Nom affiché'), nameIn),
          h('div', {}, h('label', { for: 'email' }, 'E-mail'), mailIn),
          h('button', { class: 'btn', onclick: async () => {
            const res = await fetch(`/api/admin/guests/${g.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nameIn.value, email: mailIn.value }) });
            if (res.ok) load(); else msg.textContent = 'Échec de l\'enregistrement.';
          } }, 'Enregistrer')),
        h('p', { style: 'margin:.6rem 0 0' }, msg)));
    root.replaceChildren(...parts);
  }
  load();
})();
