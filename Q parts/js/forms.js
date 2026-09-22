import { getBackend } from './backend.js';
import { prepareValidation, digits } from './validation.js';
import { notify, busy } from './ui.js';
import { el, button, icons, pageURL, errorMessage } from './utils.js';
import { observeSession, session, loginURL, nextURL } from './session.js';
import { welcomeDialog } from './auth-feedback.js';

export function initForms() {
  const type = document.body.dataset.page;
  const form = document.querySelector('form');
  if (!form || !['login', 'register', 'profile', 'contact'].includes(type)) return;
  const valid = prepareValidation(form);
  const submit = form.querySelector('[type="submit"]');
  for (const input of form.querySelectorAll('input[type="password"]')) {
    const toggle = button('Mostrar contraseña', 'eye', 'qp-password-toggle'); toggle.setAttribute('aria-pressed', 'false');
    toggle.onclick = () => {
      const show = input.type === 'password'; input.type = show ? 'text' : 'password';
      toggle.querySelector('span').textContent = show ? 'Ocultar contraseña' : 'Mostrar contraseña'; toggle.setAttribute('aria-pressed', String(show));
    };
    document.getElementById(input.id + '-error')?.after(toggle);
  }
  function readProfile() {
    const value = role => form.querySelector(`[data-validate="${role}"]`)?.value.trim() || '';
    return { nombre: value('name'), dui: digits(value('dui')), telefono: digits(value('phone')).replace(/^503(?=\d{8}$)/, ''), direccion: value('address'), giro: value('business'), Registro: digits(value('fiscal')), correo: value('email').toLowerCase() };
  }
  if (type === 'profile') {
    submit.disabled = true;
    observeSession(async user => {
      if (!user) { if (!session.signingOut) location.replace(loginURL()); return; }
      try {
        const api = await getBackend();
        const snapshot = await api.get(api.ref(api.db, `usuarios/${user.uid}`));
        const data = snapshot.val() || {};
        for (const [kind, field] of Object.entries({name:'nombre',dui:'dui',phone:'telefono',address:'direccion',business:'giro',fiscal:'Registro'})) {
          form.querySelector(`[data-validate="${kind}"]`).value = data[field] || (field === 'nombre' ? user.displayName : '') || '';
        }
        form.querySelector('[data-validate="email"]').value = user.email || '';
        submit.disabled = false;
      } catch (error) { notify('No se pudo cargar el perfil. Vuelve a cargar la página antes de guardar.', 'error'); }
    });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!valid()) return;
    busy(submit, async () => {
      let accountCreated = false;
      if (google) google.disabled = true;
      try {
        if (type === 'contact') {
          const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
          try {
            const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }, signal: controller.signal });
            if (!response.ok) throw new Error('contact-request');
            form.reset(); notify('Gracias por contactarnos. Tu mensaje se envió correctamente.', 'success');
          } finally { clearTimeout(timeout); }
          return;
        }
        const api = await getBackend();
        const email = form.querySelector('[data-validate="email"]').value.trim().toLowerCase();
        const password = form.querySelector('input[autocomplete="current-password"], input[autocomplete="new-password"]')?.value;
        if (type === 'login') {
          await api.signInWithEmailAndPassword(api.auth, email, password);
          await welcomeDialog(); location.assign(nextURL());
        } else if (type === 'register') {
          const { user } = await api.createUserWithEmailAndPassword(api.auth, email, password); accountCreated = true;
          const profile = readProfile();
          await api.set(api.ref(api.db, `usuarios/${user.uid}`), { ...profile, metodoRegistro: 'email', createdAt: new Date().toISOString() });
          await api.updateProfile(user, { displayName: profile.nombre }); location.assign(pageURL('perfil.html'));
        } else if (type === 'profile') {
          const user = session.user; if (!user) return;
          const data = readProfile();
          const emailChanged = email !== user.email?.toLowerCase();
          if (emailChanged) await api.verifyBeforeUpdateEmail(user, email);
          await api.update(api.ref(api.db, `usuarios/${user.uid}`), { ...data, correo: user.email });
          await api.updateProfile(user, { displayName: data.nombre });
          notify(emailChanged ? 'Perfil guardado. Revisa el nuevo correo y verifica el enlace para completar el cambio de dirección de acceso.' : 'Los cambios del perfil se guardaron correctamente.', 'success');
        }
      } catch (error) {
        if (accountCreated) {
          notify('La cuenta se creó, pero faltó guardar parte del perfil. Puedes completarlo desde Mi perfil.', 'error');
          const link = el('a', 'qp-text-link', 'Completar mi perfil'); link.href = pageURL('perfil.html'); form.append(link);
        } else notify(errorMessage(error), 'error');
      } finally { if (google) google.disabled = false; }
    });
  });
  const google = form.querySelector('#Googleboton');
  if (google) google.addEventListener('click', () => busy(google, async () => {
    submit.disabled = true;
    try {
      const api = await getBackend();
      const { user } = await api.signInWithPopup(api.auth, new api.GoogleAuthProvider());
      const reference = api.ref(api.db, `usuarios/${user.uid}`);
      const snapshot = await api.get(reference);
      if (!snapshot.exists()) {
        await api.set(reference, { nombre: user.displayName || '', correo: user.email || '', dui: '', telefono: user.phoneNumber || '', direccion: '', giro: '', Registro: '', metodoRegistro: 'google', createdAt: new Date().toISOString() });
        await welcomeDialog('Tu cuenta con Google está lista. Completa tus datos en Mi perfil.');
        location.assign(pageURL('perfil.html'));
      } else { await welcomeDialog(); location.assign(nextURL()); }
    } catch (error) { notify(errorMessage(error), 'error'); }
    finally { submit.disabled = false; }
  }));
  icons();
}
