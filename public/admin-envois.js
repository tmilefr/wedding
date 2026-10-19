(() => {
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
  const json = async (url, opts) => {
    const r = await fetch(url, opts && { headers: { 'Content-Type': 'application/json' }, ...opts });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || r.status);
    return d;
  };
  const day = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');

  let guests = [], filter = 'all';
  const selected = new Set();

  const filters = {
    all: ['Tous', () => true],
    never: ['Jamais envoyé', (g) => !(g.mail && g.mail.sentAt)],
    noreply: ['Sans réponse', (g) => !g.response],
    noemail: ['Sans e-mail', (g) => !validEmail(g.email)],
  };

  async function refresh() {
    const [d, st] = await Promise.all([json('/api/admin/guests'), json('/api/admin/mail-status')]);
    guests = d.guests;
    const b = $('banner');
    if (st.configured) { b.className = 'banner live'; b.textContent = `Envoi réel activé : les e-mails partent depuis ${st.from}.`; }
    else { b.className = 'banner sim'; b.textContent = 'Mode simulation : aucun SMTP configuré, donc aucun e-mail n\'est réellement envoyé. Les messages sont enregistrés dans le dossier data/outbox. Voir le README pour activer l\'envoi réel.'; }
    for (const id of [...selected]) if (!guests.find((g) => g.id === id)) selected.delete(id);
    render();
  }

  const visible = () => guests.filter(filters[filter][1]);

  function renderTabs() {
    $('tabs').replaceChildren(...Object.entries(filters).map(([k, [label, fn]]) =>
      h('button', { class: 'tab', type: 'button', 'aria-pressed': String(filter === k), onclick: () => { filter = k; render(); } }, `${label} (${guests.filter(fn).length})`)));
  }

  function mailCell(g) {
    if (g.mail && g.mail.error && (!g.mail.sentAt || g.mail.errorAt > g.mail.sentAt))
      return h('span', { class: 'badge no', title: g.mail.error }, 'Échec : ' + g.mail.error.slice(0, 40));
    if (g.mail && g.mail.sentAt)
      return h('span', {}, h('span', { class: 'badge ok' }, g.mail.simulated ? 'Simulé' : 'Envoyé'), ' ', h('span', { class: 'muted' }, day(g.mail.sentAt) + (g.mail.count > 1 ? ` (×${g.mail.count})` : '')));
    return h('span', { class: 'badge wait' }, 'Jamais envoyé');
  }

  function renderRows() {
    const list = visible();
    $('empty').hidden = list.length > 0;
    $('empty').textContent = guests.length ? 'Aucun invité dans cette vue.' : 'Aucun invité pour l\'instant. Ajoutez-les avec le formulaire ci-dessus.';
    $('rows').replaceChildren(...list.map((g) => {
      const ok = validEmail(g.email);
      const r = g.response;
      return h('tr', {},
        h('td', {}, h('input', { type: 'checkbox', 'aria-label': `Sélectionner ${g.name}`, disabled: !ok, checked: selected.has(g.id), onchange: (e) => { e.target.checked ? selected.add(g.id) : selected.delete(g.id); updateBar(); } })),
        h('td', {}, h('strong', {}, g.name), h('div', { class: 'muted' }, ok ? g.email : h('a', { href: `/admin/invite/${g.id}` }, 'Ajouter une adresse e-mail'))),
        h('td', {}, !r ? h('span', { class: 'badge wait' }, 'En attente') : r.attending ? h('span', { class: 'badge ok' }, 'Présent') : h('span', { class: 'badge no' }, 'Absent')),
        h('td', {}, mailCell(g)),
        h('td', {}, h('div', { class: 'actions' },
          h('a', { class: 'btn ghost small', href: `/api/admin/mail-preview/${g.id}`, target: '_blank', rel: 'noopener' }, 'Aperçu'),
          h('button', { class: 'btn small', disabled: !ok, onclick: () => send([g.id], r ? 'rappel' : 'invitation', true) }, g.mail && g.mail.sentAt ? 'Renvoyer' : 'Envoyer'))));
    }));
    const boxes = [...document.querySelectorAll('#rows input[type=checkbox]:not(:disabled)')];
    $('all').checked = boxes.length > 0 && boxes.every((b) => b.checked);
  }

  function updateBar() {
    const n = selected.size;
    $('count').textContent = n === 0 ? 'Aucun invité sélectionné' : `${n} invité${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''}`;
    $('sendInv').disabled = $('sendRap').disabled = n === 0;
    const boxes = [...document.querySelectorAll('#rows input[type=checkbox]:not(:disabled)')];
    $('all').checked = boxes.length > 0 && boxes.every((b) => b.checked);
  }

  function render() { renderTabs(); renderRows(); updateBar(); }

  async function send(ids, kind, single) {
    const already = ids.map((id) => guests.find((g) => g.id === id)).filter((g) => g && g.mail && g.mail.sentAt);
    const label = kind === 'rappel' ? 'un rappel' : 'l\'invitation';
    let msg = single ? `Envoyer ${label} à ${guests.find((g) => g.id === ids[0]).name} ?` : `Envoyer ${label} à ${ids.length} invité(s) ?`;
    if (already.length && !single) msg += `\n\n${already.length} d'entre eux l'ont déjà reçue : ils la recevront une nouvelle fois.`;
    if (!confirm(msg)) return;
    const btns = [$('sendInv'), $('sendRap')];
    btns.forEach((b) => (b.disabled = true));
    $('result').replaceChildren(h('p', { class: 'muted' }, 'Envoi en cours…'));
    try {
      const d = await json('/api/admin/send', { method: 'POST', body: JSON.stringify({ ids, kind }) });
      const ok = d.results.filter((r) => r.ok), ko = d.results.filter((r) => !r.ok);
      $('result').replaceChildren(
        h('p', {}, h('strong', {}, `${ok.length} e-mail(s) ${d.simulated ? 'simulé(s)' : 'envoyé(s)'}`), ko.length ? ` · ${ko.length} échec(s)` : ''),
        ko.length ? h('ul', {}, ko.map((r) => h('li', {}, `${r.name} : ${r.error}`))) : null);
      ok.forEach((r) => selected.delete(r.id));
    } catch (e) {
      $('result').replaceChildren(h('p', { class: 'error' }, `Échec de l'envoi : ${e.message}`));
    }
    await refresh();
  }

  $('all').addEventListener('change', (e) => {
    document.querySelectorAll('#rows input[type=checkbox]:not(:disabled)').forEach((b) => { b.checked = e.target.checked; });
    visible().filter((g) => validEmail(g.email)).forEach((g) => (e.target.checked ? selected.add(g.id) : selected.delete(g.id)));
    updateBar();
  });
  $('addBtn').addEventListener('click', async () => {
    const list = $('bulk').value.split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l) => { const [name, email] = l.split(/[;\t]/).map((x) => x.trim()); return { name, email: email || '' }; });
    if (!list.length) { $('addMsg').textContent = 'Saisissez au moins un invité.'; return; }
    try {
      const r = await json('/api/admin/guests', { method: 'POST', body: JSON.stringify({ guests: list }) });
      const noMail = list.filter((g) => !validEmail(g.email)).length;
      $('bulk').value = '';
      $('addMsg').textContent = `${r.added} invité(s) ajouté(s)` + (noMail ? `, dont ${noMail} sans adresse e-mail valide.` : '.');
      await refresh();
    } catch (e) { $('addMsg').textContent = `Échec de l'ajout : ${e.message}`; }
  });
  $('importBtn').addEventListener('click', async () => {
    const f = $('xlsFile').files[0];
    if (!f) { $('importMsg').textContent = 'Choisissez un fichier .xlsx.'; return; }
    $('importMsg').textContent = 'Import…';
    try {
      const r = await fetch('/api/admin/import', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: await f.arrayBuffer() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || r.status);
      $('xlsFile').value = '';
      $('importMsg').textContent = `${d.added} foyer(s) importé(s) (${d.people} personne(s))` +
        (d.skipped.length ? `, ${d.skipped.length} ignoré(s) car déjà présent(s) : ${d.skipped.slice(0, 5).join(', ')}${d.skipped.length > 5 ? '…' : ''}.` : '.');
      await refresh();
    } catch (e) { $('importMsg').textContent = `Échec de l'import : ${e.message}`; }
  });
  $('sendInv').addEventListener('click', () => send([...selected], 'invitation'));
  $('sendRap').addEventListener('click', () => send([...selected], 'rappel'));
  $('testBtn').addEventListener('click', async () => {
    $('testMsg').textContent = 'Envoi…';
    try {
      const d = await json('/api/admin/send-test', { method: 'POST', body: JSON.stringify({ to: $('testTo').value }) });
      $('testMsg').textContent = d.simulated ? 'Simulé : voir data/outbox (aucun SMTP configuré).' : 'E-mail test envoyé. Vérifiez votre boîte (et les indésirables).';
    } catch (e) { $('testMsg').textContent = `Échec : ${e.message}`; }
  });
  refresh();
})();
