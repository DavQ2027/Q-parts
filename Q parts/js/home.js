import { normalize, pageURL } from './utils.js';
export function initHome() {
  const trigger = document.querySelector('#draggable-chat-btn'); if (!trigger) return;
  const chat = document.querySelector('#chatWindow');
  const input = document.querySelector('#chatInput');
  const messages = document.querySelector('#chatMessages');
  const close = document.querySelector('#chatCloseBtn');
  const send = document.querySelector('#chatSendBtn');
  let moved = false, drag = null;
  trigger.setAttribute('aria-controls','chatWindow'); trigger.setAttribute('aria-expanded','false');
  trigger.title = 'Abrir Q Bot. En escritorio puedes arrastrar el botón.';
  chat.setAttribute('role','region'); chat.setAttribute('aria-label','Q Bot, ayuda de repuestos');
  messages.setAttribute('role','log'); messages.setAttribute('aria-live','polite');
  input.setAttribute('aria-label','Escribe tu consulta'); input.maxLength = 500;
  send.setAttribute('aria-label','Enviar consulta'); close.setAttribute('aria-label','Cerrar Q Bot');
  function position() {
    if (!chat.classList.contains('is-open')) return;
    const rect = trigger.getBoundingClientRect(), width = innerWidth <= 600 ? innerWidth - 24 : Math.min(400, innerWidth - 24);
    chat.style.width = width + 'px';
    const left = innerWidth <= 600 ? (innerWidth - width)/2 : Math.max(12, Math.min(rect.right - width, innerWidth - width - 12));
    const height = chat.getBoundingClientRect().height;
    const top = Math.max(88, Math.min(rect.top - height - 12, innerHeight - height - 12));
    chat.style.setProperty('--qp-chat-left', left + 'px');
    chat.style.setProperty('--qp-chat-top', top + 'px');
  }
  function open() { chat.classList.add('is-open'); trigger.setAttribute('aria-expanded','true'); position(); input.focus({preventScroll:true}); }
  function hide() { chat.classList.remove('is-open'); trigger.setAttribute('aria-expanded','false'); trigger.focus({preventScroll:true}); }
  trigger.addEventListener('click', () => { if (!moved) chat.classList.contains('is-open') ? hide() : open(); });
  close.addEventListener('click',hide);
  chat.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  trigger.addEventListener('pointerdown', event => {
    moved = false;
    if (event.pointerType !== 'mouse' || event.button !== 0 || innerWidth <= 600) return;
    const rect = trigger.getBoundingClientRect(); drag = {x:event.clientX,y:event.clientY,left:rect.left,top:rect.top}; trigger.setPointerCapture(event.pointerId);
  });
  trigger.addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx)+Math.abs(dy)>5) moved = true;
    if (!moved) return;
    trigger.style.right = 'auto'; trigger.style.bottom = 'auto';
    trigger.style.left = Math.max(12,Math.min(innerWidth-76,drag.left+dx))+'px';
    trigger.style.top = Math.max(88,Math.min(innerHeight-76,drag.top+dy))+'px'; position();
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>trigger.addEventListener(name,()=>{drag=null;}));
  addEventListener('resize', () => { trigger.style.left=''; trigger.style.top=''; trigger.style.right=''; trigger.style.bottom=''; position(); });
  window.visualViewport?.addEventListener('resize', position);
  function response(query) {
    const text = normalize(query);
    if (/freno|pastilla|frenar/.test(text)) return 'Busca la categoría de frenos en el catálogo de tu modelo. Confirma la compatibilidad de pastillas y discos con un asesor antes de comprarlos.';
    if (/aceite|filtro/.test(text)) return 'El filtro y el aceite dependen del modelo y motor. Consulta el manual de tu vehículo y busca el repuesto por nombre o código en el catálogo.';
    if (/amortiguador|suspension|bache|golpe/.test(text)) return 'Busca en suspensión o dirección para tu modelo. Si notas ruido o rebote, una revisión presencial puede determinar qué componente necesita atención.';
    if (/motor|arranc|electr/.test(text)) return 'Puedes explorar los componentes del motor de tu modelo. Una revisión técnica presencial es necesaria para identificar una avería.';
    if (/donde|sucursal|tienda|ubicacion|contacto/.test(text)) return 'En Contacto encontrarás los medios de atención. Confirma con un asesor la sucursal, horario y disponibilidad antes de visitar.';
    if (/cotiz|carrito|cantidad/.test(text)) return 'Pulsa Añadir en un repuesto. Usa +, − o Eliminar en el panel que aparece. También puedes ajustar cantidades y descargar un PDF en Cotización.';
    if (/nissan|mazda|isuzu/.test(text)) return 'Selecciona la marca y el modelo en Catálogo. La búsqueda filtra por nombre, código y categoría; las existencias se muestran en cada repuesto.';
    return 'Puedo orientarte sobre el catálogo, la cotización y categorías de repuestos. Soy un asistente de respuestas predefinidas; confirma diagnósticos y compatibilidad con un asesor.';
  }
  function submit() {
    const text = input.value.trim(); if (!text) { input.focus(); return; }
    const user = document.createElement('div'); user.className='chat-bubble user-bubble'; user.textContent=text; messages.append(user); input.value='';
    setTimeout(()=>{
      const bot=document.createElement('div'); bot.className='chat-bubble bot-bubble'; bot.textContent=response(text); messages.append(bot);
      while(messages.children.length>80)messages.firstElementChild.remove(); messages.scrollTop=messages.scrollHeight;
    },350);
    messages.scrollTop=messages.scrollHeight;
  }
  send.addEventListener('click',submit); input.addEventListener('keydown',event=>{if(event.key==='Enter' && !event.isComposing){event.preventDefault();submit();}});
  document.querySelector('#btn-search')?.addEventListener('click',()=>location.assign(pageURL('carrito.html')));
  document.querySelectorAll('a[href$="#qbot"]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();open();}));
  if(location.hash==='#qbot')open();

  const modal = document.querySelector('#brandModal');
  if(modal) {
    document.querySelectorAll('.brand-btn').forEach(button=>button.addEventListener('click',()=>{
      for(const [id,key] of [['modalBrandTitle','brand'],['modalBrandOrigin','origin'],['modalBrandFact','fact'],['modalBrandDesc','desc']]) {
        document.getElementById(id).textContent=button.dataset[key] || '';
      }
      modal.showModal();
    }));
    document.querySelector('#modalCloseBtn').addEventListener('click',()=>modal.close());
    modal.addEventListener('click',event=>{if(event.target===modal)modal.close();});
  }
}
