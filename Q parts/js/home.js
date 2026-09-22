import { pageURL } from './utils.js';
import { initChatClient } from './chat-client.js';
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
  input.setAttribute('aria-label','Escribe tu consulta'); input.maxLength = 700;
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
  initChatClient({ input, send, messages });
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
