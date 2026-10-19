(() => {
  const form = document.getElementById('login');
  const err = document.getElementById('err');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: form.username.value, password: form.password.value }),
      });
      if (r.ok) { location.href = '/admin'; return; }
      const d = await r.json().catch(() => ({}));
      err.textContent = d.error || 'Connexion impossible.';
    } catch {
      err.textContent = 'Connexion impossible.';
    }
    err.hidden = false;
    btn.disabled = false;
  });
})();
