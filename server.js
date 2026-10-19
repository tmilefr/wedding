const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
const config = require('./config');

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'maries';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changez-moi';
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- Stockage (fichier JSON, écriture atomique) ----------
function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { guests: [] };
  }
}
function save(db) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
  // sauvegarde de sécurité horodatée, une par jour
  const day = new Date().toISOString().slice(0, 10);
  const bak = path.join(DATA_DIR, `db-${day}.bak.json`);
  if (!fs.existsSync(bak)) fs.copyFileSync(DATA_FILE, bak);
}
const newToken = () => crypto.randomBytes(9).toString('base64url');
const linkFor = (g) => `${BASE_URL}/i/${g.token}`;

// ---------- Validation des réponses ----------
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const BRING_KEYS = config.bringOptions.map((o) => o.key);

function cleanResponse(b) {
  if (b.attending !== true && b.attending !== false) throw new Error('Indiquez si vous serez des nôtres.');
  const r = { attending: b.attending, comment: str(b.comment, 1000) };
  if (!r.attending) return r;

  r.people = (Array.isArray(b.people) ? b.people : []).slice(0, 15).map((p) => {
    const raw = p.age;
    const age = raw === '' || raw == null ? null : Math.round(Number(raw));
    return {
      lastName: str(p.lastName, 60),
      firstName: str(p.firstName, 60),
      age: Number.isFinite(age) && age >= 0 && age <= 120 ? age : null,
      sleepsOnSite: p.sleepsOnSite === true,
      diet: str(p.diet, 200),
    };
  });
  if (!r.people.length) throw new Error('Indiquez au moins une personne.');
  for (const p of r.people) {
    if (!p.firstName) throw new Error('Un prénom est manquant.');
    if (p.age === null) throw new Error(`L'âge de ${p.firstName} est manquant.`);
  }
  r.fridayPresent = b.fridayPresent === true;
  r.fridayPrep = r.fridayPresent && b.fridayPrep === true;
  r.fridayDinner = r.fridayPresent && b.fridayDinner === true;
  r.bring = (Array.isArray(b.bring) ? b.bring : []).filter((k) => BRING_KEYS.includes(k));
  r.bringOther = str(b.bringOther, 200);
  r.regionalHas = b.regionalHas === true;
  r.regionalDetail = r.regionalHas ? str(b.regionalDetail, 500) : '';
  r.extendMonday = b.extendMonday === true;
  r.brunch = b.brunch === true;
  r.cleanup = b.cleanup === true;
  return r;
}

// ---------- Auth admin (HTTP Basic) ----------
function safeEq(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function adminOnly(req, res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Basic ')) {
    const [u, ...rest] = Buffer.from(h.slice(6), 'base64').toString().split(':');
    if (safeEq(u, ADMIN_USER) && safeEq(rest.join(':'), ADMIN_PASSWORD)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Espace des mariés"').status(401).send('Authentification requise');
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '60kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

// ---------- Pages publiques ----------
app.use('/assets', express.static(path.join(__dirname, 'public/assets'), { maxAge: '7d' }));
app.get('/style.css', (_, res) => res.sendFile(path.join(__dirname, 'public/style.css')));
app.get('/guest.js', (_, res) => res.sendFile(path.join(__dirname, 'public/guest.js')));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public/home.html')));
app.get('/i/:token', (_, res) => res.sendFile(path.join(__dirname, 'public/guest.html')));

app.get('/api/invite/:token', (req, res) => {
  const g = load().guests.find((x) => x.token === req.params.token);
  if (!g) return res.status(404).json({ error: 'Lien inconnu' });
  const { couple, dateLabel, dateShort, intro, venue, lodging, program, specialtyIdeas, bringOptions } = config;
  res.json({
    guest: { name: g.name, response: g.response || null },
    config: { couple, dateLabel, dateShort, intro, venue, lodging, program, specialtyIdeas, bringOptions },
  });
});

app.post('/api/invite/:token', (req, res) => {
  const db = load();
  const g = db.guests.find((x) => x.token === req.params.token);
  if (!g) return res.status(404).json({ error: 'Lien inconnu' });
  try {
    g.response = cleanResponse(req.body || {});
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  g.respondedAt = new Date().toISOString();
  save(db);
  res.json({ ok: true });
});

// ---------- Espace des mariés ----------
app.get('/admin', adminOnly, (_, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/admin.js', adminOnly, (_, res) => res.sendFile(path.join(__dirname, 'public/admin.js')));

app.get('/api/admin/guests', adminOnly, (_, res) => {
  const guests = load().guests.map((g) => ({ ...g, link: linkFor(g) }));
  res.json({ guests, couple: config.couple, bringOptions: config.bringOptions });
});

app.post('/api/admin/guests', adminOnly, (req, res) => {
  const list = Array.isArray(req.body.guests) ? req.body.guests : [];
  const db = load();
  let added = 0;
  for (const item of list.slice(0, 500)) {
    const name = str(item.name, 120);
    if (!name) continue;
    db.guests.push({
      id: crypto.randomUUID(),
      token: newToken(),
      name,
      email: str(item.email, 200),
      createdAt: new Date().toISOString(),
      response: null,
    });
    added++;
  }
  save(db);
  res.json({ added });
});

app.patch('/api/admin/guests/:id', adminOnly, (req, res) => {
  const db = load();
  const g = db.guests.find((x) => x.id === req.params.id);
  if (!g) return res.status(404).end();
  if (req.body.name !== undefined) g.name = str(req.body.name, 120) || g.name;
  if (req.body.email !== undefined) g.email = str(req.body.email, 200);
  save(db);
  res.json({ ok: true });
});

app.delete('/api/admin/guests/:id', adminOnly, (req, res) => {
  const db = load();
  db.guests = db.guests.filter((x) => x.id !== req.params.id);
  save(db);
  res.json({ ok: true });
});

app.get('/api/admin/qr/:id.svg', adminOnly, async (req, res) => {
  const g = load().guests.find((x) => x.id === req.params.id);
  if (!g) return res.status(404).end();
  const svg = await QRCode.toString(linkFor(g), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#27422F', light: '#0000' } });
  res.type('image/svg+xml').send(svg);
});

// ---------- Export Excel ----------
app.get('/api/admin/export.xlsx', adminOnly, async (_, res) => {
  const guests = load().guests;
  const yn = (v) => (v ? 'Oui' : 'Non');
  const label = Object.fromEntries(config.bringOptions.map((o) => [o.key, o.label]));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Site de mariage';
  const ws0 = wb.addWorksheet('Synthèse', { properties: { tabColor: { argb: 'FFC93B2B' } } });

  const style = (ws, widths) => {
    ws.columns.forEach((c, i) => (c.width = widths[i] || 16));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27422F' } };
    head.alignment = { vertical: 'middle', wrapText: true };
    head.height = 30;
    ws.eachRow((row, n) => { if (n > 1) row.alignment = { vertical: 'top', wrapText: true }; });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  };

  const status = (g) => (!g.response ? 'En attente' : g.response.attending ? 'Présent' : 'Absent');
  const people = (g) => (g.response && g.response.attending ? g.response.people : []);

  // 1. Réponses : une ligne par invité (foyer)
  const ws1 = wb.addWorksheet('Réponses');
  ws1.columns = [
    { header: 'Invité' }, { header: 'E-mail' }, { header: 'Statut' }, { header: 'Date de réponse' },
    { header: 'Personnes' }, { header: 'Adultes (18+)' }, { header: 'Enfants (<18)' }, { header: 'Couchages sur place' },
    { header: 'Présent vendredi' }, { header: 'Aide à la préparation' }, { header: 'Repas du vendredi soir' },
    { header: 'Apporte' }, { header: 'Spécialité régionale' }, { header: 'Prolonge jusqu\'au lundi' },
    { header: 'Brunch dimanche' }, { header: 'Rangement' }, { header: 'Commentaire' },
  ];
  for (const g of guests) {
    const r = g.response;
    const ps = people(g);
    const att = r && r.attending;
    ws1.addRow([
      g.name, g.email, status(g), g.respondedAt ? new Date(g.respondedAt) : '',
      att ? ps.length : 0,
      att ? ps.filter((p) => p.age >= 18).length : 0,
      att ? ps.filter((p) => p.age < 18).length : 0,
      att ? ps.filter((p) => p.sleepsOnSite).length : 0,
      att ? yn(r.fridayPresent) : '', att ? yn(r.fridayPrep) : '', att ? yn(r.fridayDinner) : '',
      att ? [...r.bring.map((k) => label[k]), r.bringOther].filter(Boolean).join(', ') : '',
      att ? (r.regionalHas ? r.regionalDetail || 'Oui' : 'Non') : '',
      att ? yn(r.extendMonday) : '', att ? yn(r.brunch) : '', att ? yn(r.cleanup) : '',
      r ? r.comment : '',
    ]);
  }
  ws1.getColumn(4).numFmt = 'dd/mm/yyyy hh:mm';
  style(ws1, [24, 26, 12, 17, 11, 11, 11, 13, 11, 13, 13, 30, 38, 14, 12, 11, 40]);

  // 2. Participants : une ligne par personne
  const ws2 = wb.addWorksheet('Participants');
  ws2.columns = [
    { header: 'Invité (lien)' }, { header: 'Nom' }, { header: 'Prénom' }, { header: 'Âge en août 2027' },
    { header: 'Dort sur place' }, { header: 'Régime / allergies' },
  ];
  for (const g of guests) for (const p of people(g)) ws2.addRow([g.name, p.lastName, p.firstName, p.age, yn(p.sleepsOnSite), p.diet]);
  style(ws2, [24, 18, 18, 12, 12, 40]);

  // 3. Couchages
  const ws3 = wb.addWorksheet('Couchages');
  ws3.columns = [{ header: 'Invité (lien)' }, { header: 'Nom' }, { header: 'Prénom' }, { header: 'Âge' }, { header: 'Lit attribué' }];
  for (const g of guests) for (const p of people(g)) if (p.sleepsOnSite) ws3.addRow([g.name, p.lastName, p.firstName, p.age, '']);
  style(ws3, [24, 18, 18, 8, 16]);

  // 4. Contributions : une ligne par chose apportée
  const ws4 = wb.addWorksheet('Contributions');
  ws4.columns = [{ header: 'Invité' }, { header: 'Moment' }, { header: 'Type' }, { header: 'Détail' }];
  for (const g of guests) {
    const r = g.response;
    if (!r || !r.attending) continue;
    for (const k of r.bring) ws4.addRow([g.name, 'Vendredi soir', label[k], '']);
    if (r.bringOther) ws4.addRow([g.name, 'Vendredi soir', 'Autre', r.bringOther]);
    if (r.regionalHas) ws4.addRow([g.name, 'Samedi soir (buffet)', 'Spécialité régionale', r.regionalDetail]);
  }
  style(ws4, [24, 22, 22, 50]);

  // 5. Liens pour publipostage
  const ws5 = wb.addWorksheet('Liens invités');
  ws5.columns = [{ header: 'Invité' }, { header: 'E-mail' }, { header: 'Lien personnel' }];
  for (const g of guests) ws5.addRow([g.name, g.email, { text: linkFor(g), hyperlink: linkFor(g) }]);
  style(ws5, [26, 30, 60]);

  // 6. Synthèse (en premier onglet)
  const answered = guests.filter((g) => g.response);
  const present = guests.filter((g) => g.response && g.response.attending);
  const all = present.flatMap((g) => g.response.people);
  const count = (fn) => present.filter((g) => fn(g.response)).reduce((n, g) => n + g.response.people.length, 0);
  ws0.columns = [{ header: 'Indicateur' }, { header: 'Valeur' }];
  [
    ['Invitations envoyées (foyers)', guests.length],
    ['Réponses reçues', answered.length],
    ['En attente', guests.length - answered.length],
    ['Foyers présents', present.length],
    ['Foyers absents', answered.length - present.length],
    ['Personnes présentes', all.length],
    ['dont adultes (18+)', all.filter((p) => p.age >= 18).length],
    ['dont enfants (<18)', all.filter((p) => p.age < 18).length],
    ['Couchages à prévoir', all.filter((p) => p.sleepsOnSite).length],
    ['Personnes présentes dès le vendredi', count((r) => r.fridayPresent)],
    ['Personnes au repas du vendredi soir', count((r) => r.fridayDinner)],
    ['Foyers qui aident à la préparation', present.filter((g) => g.response.fridayPrep).length],
    ['Personnes présentes au brunch', count((r) => r.brunch)],
    ['Personnes qui prolongent jusqu\'au lundi', count((r) => r.extendMonday)],
    ['Foyers qui aident au rangement', present.filter((g) => g.response.cleanup).length],
  ].forEach((row) => ws0.addRow(row));
  style(ws0, [44, 12]);
  ws0.autoFilter = undefined;

  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="reponses-mariage-${new Date().toISOString().slice(0, 10)}.xlsx"`,
  });
  await wb.xlsx.write(res);
  res.end();
});

app.listen(PORT, () => {
  console.log(`Site de mariage sur ${BASE_URL}  (espace des mariés : ${BASE_URL}/admin)`);
  if (ADMIN_PASSWORD === 'changez-moi') console.warn('⚠ Définissez ADMIN_PASSWORD avant la mise en ligne.');
});
