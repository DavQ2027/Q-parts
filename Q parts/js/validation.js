export const digits = value => String(value || '').replace(/[\s()+-]/g, '');
export function validationMessage(kind, value, other = '') {
  const text = String(value || '').trim();
  if (!text) return 'Completa este campo.';
  switch (kind) {
    case 'name': return text.length >= 3 && text.length <= 80 && /^[\p{L}\p{M} .'-]+$/u.test(text) ? '' : 'Escribe un nombre de 3 a 80 caracteres, sin números.';
    case 'dui': return /^(?:\d{9}|\d{8}-\d)$/.test(text) ? '' : 'Usa 9 dígitos, por ejemplo 01234567-8.';
    case 'phone': return /^(?:\+503[ -]?)?\d{4}[ -]?\d{4}$/.test(text) ? '' : 'Usa 8 dígitos; puedes anteponer +503.';
    case 'email': return text.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? '' : 'Escribe un correo válido, por ejemplo nombre@dominio.com.';
    case 'address': return text.length >= 10 && text.length <= 200 ? '' : 'Escribe una dirección de 10 a 200 caracteres.';
    case 'business': return text.length >= 2 && text.length <= 100 ? '' : 'Escribe de 2 a 100 caracteres.';
    case 'fiscal': return /^[0-9]+(?:-[0-9]+)*$/.test(text) && digits(text).length >= 2 && digits(text).length <= 14 ? '' : 'Usa entre 2 y 14 dígitos; puedes separar grupos con guiones.';
    case 'new-password': return value.length >= 8 && value.length <= 128 && value.trim().length > 0 ? '' : 'La contraseña debe tener entre 8 y 128 caracteres.';
    case 'confirm-password': return value === other ? '' : 'Las contraseñas no coinciden.';
    case 'message': return text.length >= 10 && text.length <= 2000 ? '' : 'Escribe un mensaje de 10 a 2000 caracteres.';
    default: return '';
  }
}
export function prepareValidation(form) {
  form.noValidate = true;
  const controls = [...form.querySelectorAll('[data-validate]')];
  function validate(control) {
    const error = validationMessage(control.dataset.validate, control.value, form.querySelector('[data-validate="new-password"]')?.value);
    control.setCustomValidity(error); control.setAttribute('aria-invalid', String(Boolean(error)));
    document.getElementById(control.id + '-error').textContent = error; return !error;
  }
  for (const control of controls) {
    const error = document.createElement('small'); error.id = control.id + '-error'; error.className = 'qp-field-error';
    control.after(error); control.setAttribute('aria-describedby', [control.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
    control.addEventListener('blur', () => validate(control));
    control.addEventListener('input', () => { if (control.getAttribute('aria-invalid') === 'true') validate(control); });
  }
  return () => {
    const valid = controls.map(validate).every(Boolean);
    if (!valid) controls.find(control => !control.validity.valid)?.focus();
    return valid;
  };
}
