import { getBackend } from './backend.js';
import { observeSession, session, loginURL } from './session.js';
import { busy, notify, confirmDialog } from './ui.js';
import { errorMessage } from './utils.js';
export function initInventory() {
  const control = document.querySelector('#BTNnsert'); control.disabled=true;
  observeSession(user=>{control.disabled=!user;});
  control.addEventListener('click',()=>busy(control,async()=>{
    const values=Array.from({length:9},(_,i)=>document.getElementById(i===0?'Namebox':`Namebox${i+1}`).value.trim());
    if(values.some(value=>!value)){notify('Completa todos los campos del repuesto.','error');return;}
    const [name,brand,year,model,price,code,image,stock,tag]=values;
    if(/[.#$\[\]/]/.test(code)||code.length>100||!Number.isFinite(Number(price))||Number(price)<0||!Number.isSafeInteger(Number(stock))||Number(stock)<0||!/^\d{4}$/.test(year)){
      notify('Revisa el código, año de cuatro dígitos, precio no negativo y existencias enteras.','error');return;
    }
    if(!/^(https?:\/\/|(?:\.\.\/)?img\/)/i.test(image)){notify('Usa una imagen de img/ o una URL http/https.','error');return;}
    if(!session.user){location.assign(loginURL());return;}
    try{
      const api=await getBackend(); const reference=api.ref(api.db,`Repuestos/${code}`);
      const old=await api.get(reference);
      if(old.exists()&&!await confirmDialog('Actualizar repuesto','Ya existe un producto con este código. ¿Deseas actualizarlo?','Actualizar'))return;
      await api.set(reference,{NombredelR:name,Auto:brand,year,Model:model,Precio:Number(price),ModelEx:code,imagen:image,Existencias:Number(stock),tag});
      notify('Repuesto guardado correctamente.','success');
    }catch(error){notify(errorMessage(error),'error');}
  }));
}
