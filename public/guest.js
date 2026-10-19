(() => {
  const token = location.pathname.split('/').pop();
  const app = document.getElementById('app');
  let cfg, guest;
  let mode = 'welcome'; // welcome | step | done
  let stepIdx = 0;
  let error = '';
  let sending = false;

  const blankPerson = () => ({ firstName: '', lastName: '', age: '', sleepsOnSite: null, diet: '' });
  let state = {
    attending: null,
    people: [blankPerson()],
    fridayPresent: null, fridayPrep: false, fridayDinner: false,
    bring: [], bringOther: '',
    regionalHas: null, regionalDetail: '',
    extendMonday: null, brunch: null, cleanup: null,
    comment: '',
  };

  // ---------- utilitaires DOM ----------
  function h(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      e.append(k.nodeType ? k : document.createTextNode(k));
    }
    return e;
  }

  let uid = 0;
  function yesNo(name, value, onChange, labels = ['Oui', 'Non']) {
    const id = `${name}-${++uid}`;
    return h('div', { class: 'choices', role: 'radiogroup' },
      [[true, labels[0]], [false, labels[1]]].map(([v, text]) =>
        h('label', { class: 'choice' },
          h('input', { type: 'radio', name: id, checked: value === v, onchange: () => { onChange(v); } }),
          h('span', {}, text))));
  }
  function check(label, checked, onChange) {
    return h('label', { class: 'choice check' },
      h('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) }),
      h('span', {}, label));
  }
  const stepsList = () => (state.attending === false ? ['presence', 'review'] : ['presence', 'people', 'friday', 'saturday', 'sunday', 'review']);

  // ---------- chargement ----------
  async function init() {
    const r = await fetch(`/api/invite/${encodeURIComponent(token)}`);
    if (!r.ok) {
      app.replaceChildren(h('h2', {}, 'Lien introuvable'), h('p', {}, "Ce lien ne correspond à aucune invitation. Vérifiez qu'il est complet, ou contactez-nous."));
      return;
    }
    const data = await r.json();
    cfg = data.config; guest = data.guest;
    document.title = `${cfg.couple.first} & ${cfg.couple.second} · ${cfg.dateShort}`;
    document.getElementById('greeting').textContent = `Bonjour ${guest.name} !`;
    document.getElementById('names').textContent = `${cfg.couple.first} & ${cfg.couple.second}`;
    document.getElementById('date').textContent = `se marient le ${cfg.dateLabel}`;
    if (!guest.response && guest.members && guest.members.length) {
      state.people = guest.members.map((m) => ({ ...blankPerson(), firstName: m.firstName || '', lastName: m.lastName || '', age: m.age == null ? '' : m.age }));
    }
    if (guest.response) {
      state = { ...state, ...guest.response, people: (guest.response.people && guest.response.people.length) ? guest.response.people : [blankPerson()] };
      mode = 'done';
    }
    render();
  }

  // ---------- vues ----------
  function programView() {
    return cfg.program.map((d) =>
      h('section', { class: 'day' },
        h('h3', {}, d.day),
        h('ul', { class: 'timeline' }, d.items.map((i) =>
          h('li', {}, h('span', { class: 't' }, i.time), h('span', {}, i.title, h('span', { class: 'place' }, i.place))))),
        d.note ? h('p', { class: 'note' }, d.note) : null));
  }

  function welcomeView() {
    return [
      h('p', {}, 'Vous êtes invité(e) à célébrer notre mariage. ' + cfg.intro),
      h('h2', {}, 'Le week-end'),
      h('p', { class: 'muted' }, `La fête a lieu à ${cfg.venue.name}, ${cfg.venue.address}.`),
      programView(),
      h('div', { class: 'nav' }, h('span'), h('button', { class: 'btn', onclick: () => { mode = 'step'; stepIdx = 0; render(); } }, 'Répondre à l\'invitation')),
    ];
  }

  function stepPresence() {
    return [
      h('h2', { class: 'step-title' }, 'Serez-vous des nôtres ?'),
      h('fieldset', { class: 'q' },
        h('legend', { class: 'sr' }, 'Présence'),
        yesNo('att', state.attending, (v) => { state.attending = v; error = ''; render(); }, ['Oui, avec plaisir', 'Non, nous ne pourrons pas'])),
    ];
  }

  function personCard(p, i) {
    const f = (label, key, attrs = {}) => {
      const id = `p${i}-${key}`;
      return h('div', {}, h('label', { for: id }, label),
        h('input', { id, type: attrs.type || 'text', value: p[key] ?? '', min: attrs.min, max: attrs.max, inputmode: attrs.inputmode, autocomplete: 'off', oninput: (e) => (p[key] = e.target.value) }));
    };
    return h('div', { class: 'person' },
      h('h4', {}, state.people.length > 1 ? `Personne ${i + 1}` : 'Vous'),
      state.people.length > 1 ? h('button', { class: 'btn link small rm', type: 'button', onclick: () => { state.people.splice(i, 1); render(); } }, 'Retirer') : null,
      h('div', { class: 'grid' },
        f('Prénom', 'firstName'),
        f('Nom', 'lastName'),
        f('Âge en août 2027', 'age', { type: 'number', min: 0, max: 120, inputmode: 'numeric' }),
        h('div', {}, h('label', {}, 'Dort sur place ?'),
          yesNo(`sleep${i}`, p.sleepsOnSite, (v) => { p.sleepsOnSite = v; }, ['Oui', 'Non'])),
        h('div', { class: 'full' }, f('Régime alimentaire ou allergies (facultatif)', 'diet'))));
  }

  function stepPeople() {
    return [
      h('h2', { class: 'step-title' }, 'Qui sera là ?'),
      h('p', {}, "Ajoutez chaque personne de votre foyer, enfants compris, avec l'âge qu'elle aura le jour du mariage."),
      h('div', { class: 'info' }, h('p', {}, cfg.lodging)),
      state.people.map(personCard),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { state.people.push(blankPerson()); render(); } }, '+ Ajouter une personne'),
    ];
  }

  function stepFriday() {
    return [
      h('h2', { class: 'step-title' }, 'Le vendredi'),
      h('p', {}, 'Nous disposons de la salle dès le vendredi 14h pour préparer et commencer la fête.'),
      h('fieldset', { class: 'q' },
        h('legend', {}, 'Serez-vous présent(s) dès le vendredi ?'),
        yesNo('fri', state.fridayPresent, (v) => { state.fridayPresent = v; render(); })),
      state.fridayPresent ? h('fieldset', { class: 'q' },
        h('legend', {}, 'Vous serez là'),
        h('div', { class: 'choices' },
          check('Pour la préparation', state.fridayPrep, (v) => (state.fridayPrep = v)),
          check('Pour le repas du soir', state.fridayDinner, (v) => (state.fridayDinner = v)))) : null,
      state.fridayPresent ? h('fieldset', { class: 'q' },
        h('legend', {}, 'Apporterez-vous quelque chose à manger ou à boire ?'),
        h('p', { class: 'hint' }, 'Plusieurs choix possibles, ou aucun.'),
        h('div', { class: 'choices' }, cfg.bringOptions.map((o) =>
          check(o.label, state.bring.includes(o.key), (v) => {
            state.bring = v ? [...new Set([...state.bring, o.key])] : state.bring.filter((k) => k !== o.key);
          }))),
        h('div', { style: 'margin-top:.7rem' },
          h('label', { class: 'sr', for: 'bringOther' }, 'Autre chose'),
          h('input', { id: 'bringOther', type: 'text', placeholder: 'Autre chose ? Précisez ici', value: state.bringOther, oninput: (e) => (state.bringOther = e.target.value) }))) : null,
    ];
  }

  function stepSaturday() {
    const sat = cfg.program.find((d) => d.day.startsWith('Samedi'));
    const ta = h('textarea', { id: 'regionalDetail', placeholder: 'Ex. : gâteau basque, tomme de brebis…', oninput: (e) => (state.regionalDetail = e.target.value) }, state.regionalDetail);
    return [
      h('h2', { class: 'step-title' }, 'Le samedi'),
      sat ? h('section', { class: 'day' }, h('ul', { class: 'timeline' }, sat.items.map((i) =>
        h('li', {}, h('span', { class: 't' }, i.time), h('span', {}, i.title, h('span', { class: 'place' }, i.place)))))) : null,
      sat && sat.note ? h('p', {}, sat.note) : null,
      h('fieldset', { class: 'q' },
        h('legend', {}, 'Aurez-vous une spécialité régionale à partager sur le buffet ?'),
        h('p', { class: 'hint' }, 'Nous aimerions goûter les saveurs de vos régions.'),
        yesNo('reg', state.regionalHas, (v) => { state.regionalHas = v; render(); })),
      state.regionalHas ? h('div', { class: 'q' },
        h('label', { class: 'lbl', for: 'regionalDetail' }, 'Laquelle ou lesquelles ?'),
        ta,
        h('p', { class: 'hint', style: 'margin-top:.7rem' }, 'Nos envies, pour vous inspirer (un clic les ajoute) :'),
        h('div', { class: 'chips' }, cfg.specialtyIdeas.map((idea) =>
          h('button', { class: 'chip', type: 'button', onclick: () => {
            state.regionalDetail = state.regionalDetail ? `${state.regionalDetail}\n${idea}` : idea;
            ta.value = state.regionalDetail; ta.focus();
          } }, idea)))) : null,
    ];
  }

  function stepSunday() {
    return [
      h('h2', { class: 'step-title' }, 'Dimanche et lundi'),
      h('p', {}, 'Le dimanche, nous rangeons la salle et partageons un brunch. Nous pouvons aussi prolonger la fête jusqu\'au lundi midi, selon les envies de chacun.'),
      h('fieldset', { class: 'q' }, h('legend', {}, 'Serez-vous présent(s) au brunch du dimanche ?'),
        yesNo('brunch', state.brunch, (v) => (state.brunch = v))),
      h('fieldset', { class: 'q' }, h('legend', {}, 'Nous aiderez-vous à ranger la salle ?'),
        yesNo('cleanup', state.cleanup, (v) => (state.cleanup = v))),
      h('fieldset', { class: 'q' }, h('legend', {}, "Seriez-vous intéressé(s) pour prolonger la fête jusqu'au lundi ?"),
        yesNo('mon', state.extendMonday, (v) => (state.extendMonday = v))),
    ];
  }

  const yn = (v) => (v ? 'oui' : 'non');
  function recapItems() {
    const items = [];
    if (state.attending === false) return [['Présence', 'Vous ne pourrez pas venir']];
    items.push(['Présence', 'Vous serez des nôtres']);
    items.push(['Personnes', state.people.map((p) => `${p.firstName} ${p.lastName}`.trim() + ` (${p.age} ans${p.sleepsOnSite ? ', dort sur place' : ''})`).join(' ; ')]);
    items.push(['Vendredi', state.fridayPresent
      ? ['présent', state.fridayPrep && 'préparation', state.fridayDinner && 'repas du soir'].filter(Boolean).join(', ')
      : 'non présent']);
    const bring = [...state.bring.map((k) => (cfg.bringOptions.find((o) => o.key === k) || {}).label), state.bringOther].filter(Boolean);
    if (state.fridayPresent) items.push(['Vous apportez', bring.length ? bring.join(', ') : 'rien de particulier']);
    items.push(['Spécialité du samedi', state.regionalHas ? (state.regionalDetail || 'oui').replace(/\n/g, ', ') : 'aucune']);
    items.push(['Brunch du dimanche', yn(state.brunch)]);
    items.push(['Rangement', yn(state.cleanup)]);
    items.push(['Prolonger jusqu\'au lundi', yn(state.extendMonday)]);
    return items;
  }

  function stepReview() {
    return [
      h('h2', { class: 'step-title' }, state.attending === false ? 'Un petit mot ?' : 'Vérifiez vos réponses'),
      state.attending === false ? h('p', {}, 'Dommage, vous nous manquerez. Vous pouvez nous laisser un message.') : null,
      h('ul', { class: 'recap' }, recapItems().map(([k, v]) => h('li', {}, h('strong', {}, k + ' : '), v))),
      h('div', { class: 'q' },
        h('label', { class: 'lbl', for: 'comment' }, 'Un message ou une précision (facultatif)'),
        h('textarea', { id: 'comment', oninput: (e) => (state.comment = e.target.value) }, state.comment)),
    ];
  }

  function doneView() {
    return [
      h('div', { class: 'thanks' },
        h('span', { class: 'hand' }, 'Merci !'),
        h('p', {}, state.attending === false
          ? 'Votre réponse est bien enregistrée. Vous nous manquerez !'
          : 'Votre réponse est bien enregistrée. À très vite à Baeselbach !')),
      h('ul', { class: 'recap' }, recapItems().map(([k, v]) => h('li', {}, h('strong', {}, k + ' : '), v))),
      h('p', { class: 'muted' }, 'Un changement de dernière minute ? Vous pouvez modifier vos réponses à tout moment avec ce même lien.'),
      h('div', { class: 'nav' },
        h('button', { class: 'btn ghost', onclick: () => { mode = 'step'; stepIdx = 0; render(); } }, 'Modifier mes réponses'),
        h('button', { class: 'btn ghost', onclick: () => { mode = 'welcome'; render(); } }, 'Revoir le programme')),
    ];
  }

  // ---------- validation ----------
  function validate(step) {
    if (step === 'presence' && state.attending === null) return 'Merci de répondre par oui ou par non.';
    if (step === 'people') {
      for (const [i, p] of state.people.entries()) {
        const who = state.people.length > 1 ? `la personne ${i + 1}` : 'vous';
        if (!p.firstName.trim()) return `Indiquez le prénom de ${who}.`;
        if (p.age === '' || p.age == null || Number(p.age) < 0 || !Number.isFinite(Number(p.age))) return `Indiquez l'âge de ${p.firstName || who}.`;
        if (p.sleepsOnSite === null) return `Indiquez si ${p.firstName} dort sur place.`;
      }
    }
    if (step === 'friday' && state.fridayPresent === null) return 'Indiquez si vous serez là dès le vendredi.';
    if (step === 'saturday' && state.regionalHas === null) return 'Indiquez si vous avez une spécialité à partager.';
    if (step === 'sunday' && (state.brunch === null || state.cleanup === null || state.extendMonday === null)) return 'Répondez aux trois questions pour continuer.';
    return '';
  }

  async function send() {
    sending = true; error = ''; render();
    try {
      const r = await fetch(`/api/invite/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur');
      mode = 'done';
    } catch (e) {
      error = `L'envoi a échoué : ${e.message}. Vos réponses sont conservées, réessayez.`;
    }
    sending = false; render();
  }

  function render() {
    let body;
    if (mode === 'welcome') body = welcomeView();
    else if (mode === 'done') body = doneView();
    else {
      const steps = stepsList();
      const step = steps[stepIdx];
      const views = { presence: stepPresence, people: stepPeople, friday: stepFriday, saturday: stepSaturday, sunday: stepSunday, review: stepReview };
      const last = stepIdx === steps.length - 1;
      body = [
        h('ol', { class: 'steps', 'aria-label': `Étape ${stepIdx + 1} sur ${steps.length}` },
          steps.map((_, i) => h('li', { class: i < stepIdx ? 'done' : i === stepIdx ? 'now' : '' }))),
        views[step](),
        error ? h('p', { class: 'error', role: 'alert' }, error) : null,
        h('div', { class: 'nav' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { error = ''; if (stepIdx === 0) mode = 'welcome'; else stepIdx--; render(); } }, 'Retour'),
          last
            ? h('button', { class: 'btn', type: 'button', disabled: sending, onclick: send }, sending ? 'Envoi…' : 'Envoyer mes réponses')
            : h('button', { class: 'btn', type: 'button', onclick: () => {
                error = validate(step);
                if (!error) stepIdx++;
                render();
              } }, 'Continuer')),
      ];
    }
    const scrollTop = mode === 'step' || mode === 'done';
    app.replaceChildren(...[body].flat(Infinity).filter(Boolean));
    if (scrollTop && window.__lastKey !== `${mode}${stepIdx}`) { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    window.__lastKey = `${mode}${stepIdx}`;
  }

  init();
})();
