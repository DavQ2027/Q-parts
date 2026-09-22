import { createHash } from 'node:crypto';
import { clean, createCatalogLoader, modelContext, searchCatalog } from './catalog.js';
import { HELP, ROUTES } from './knowledge.js';
import { SYSTEM_PROMPT, GEMINI_PLAN_SCHEMA, validatePlan } from './prompt.js';

const json = (body, status=200, extra={}) => Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const fail = (status, code, message, extra={}) => json({error:{code,message}},status,extra);
const linksFor = key => [{label:ROUTES[key][0],path:ROUTES[key][1]}];
const base = {products:[],links:[],context:'',source:null};
function help(topic) { const [answer,route]=HELP[topic]||HELP.catalog;return {...base,answer,links:linksFor(route),context:'Ayuda: '+topic}; }

export function answerFromPlan(plan, snapshot) {
  if(plan.intent==='help')return help(plan.topic);
  if(plan.intent==='out_of_scope')return {...base,answer:'Puedo ayudarte con repuestos, existencias, precios y el uso de Q-Parts. Para diagnósticos, horarios o compatibilidad exacta, contacta a un asesor.',links:linksFor('contact')};
  if(plan.intent==='clarify')return {...base,answer:'¿Qué pieza o código buscas y para qué marca y modelo? Si necesitas varias unidades, indícame cuántas.'};
  const matches=searchCatalog(snapshot.products,plan), shown=matches.slice(0,6);
  const scope=[plan.query||plan.category,plan.brand,plan.model,plan.year].filter(Boolean).join(' · ');
  let answer;
  if(!matches.length)answer=`No encontré registros${scope?' para '+scope:''}${plan.codes.length?' con código '+plan.codes.join(', '):''} con esos filtros. Prueba con otro nombre o código. Esto no confirma existencias fuera del catálogo.`;
  else if(plan.intent==='count') {
    const known=matches.filter(p=>p.stock!==null), units=known.reduce((n,p)=>n+p.stock,0);
    answer=`Hay ${matches.length} repuestos distintos${scope?' para '+scope:''}, ${known.length?`con ${units} unidades registradas en total.`:'sin información de existencias.'}${known.length>0&&known.length<matches.length?' Hay registros sin existencias informadas.':''}`;
  } else answer=`Encontré ${matches.length} ${matches.length===1?'repuesto':'repuestos'}${scope?' para '+scope:''}.${matches.length>6?' Te muestro los primeros 6; puedes precisar la pieza o el código.':''}`;
  if(matches.length&&plan.quantity>1)answer+=` Consulta abajo si hay ${plan.quantity} unidades de cada pieza.`;
  if(matches.length&&plan.intent==='add')answer+=' Confirma con el botón del repuesto que deseas añadir a tu cotización.';
  const references=matches.filter(p=>p.reference).length;
  if(references)answer+=` ${references} ${references===1?'registro es una referencia':'registros son referencias'} de otros modelos; confirma su compatibilidad con un asesor.`;
  return { answer, products:shown.map(p=>({...p,quantity:plan.quantity})),links:linksFor('catalog'),
    source:{name:'Firebase · Repuestos',checkedAt:snapshot.fetchedAt},
    context:JSON.stringify({filters:{brand:plan.brand,model:plan.model,query:plan.query,category:plan.category,year:plan.year,minPrice:plan.minPrice,maxPrice:plan.maxPrice,stock:plan.stock,sort:plan.sort},results:shown.map((p,i)=>({position:i+1,code:p.code})),quantity:plan.quantity}) };
}

async function readInput(request) {
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new Error('INPUT_TYPE');
  if(Number(request.headers.get('content-length'))>10000)throw new Error('INPUT_SIZE');
  const reader=request.body?.getReader();if(!reader)throw new Error('INPUT');
  let size=0;const chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>10000){await reader.cancel();throw new Error('INPUT_SIZE');}chunks.push(Buffer.from(value));}
  const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!value||typeof value.message!=='string'||!value.message.trim()||value.message.length>700)throw new Error('INPUT');
  if(Object.keys(value).some(k=>!['message','history'].includes(k)))throw new Error('INPUT');
  if(value.history!==undefined&&(!Array.isArray(value.history)||value.history.length>6))throw new Error('INPUT');
  const history=(value.history||[]).map(h=>{
    if(!h||!['user','assistant'].includes(h.role)||typeof h.text!=='string'||h.text.length>1200)throw new Error('INPUT');
    return {role:h.role,text:h.text.slice(0,h.role==='user'?700:1200)};
  }).slice(-4);
  return {message:value.message.trim(),history};
}

export function createChatHandler({fetchImpl=fetch,env=process.env,now=Date.now,loadCatalog=createCatalogLoader({fetchImpl,now})}={}) {
  const visitors=new Map(), plans=new Map();let concurrent=0;
  return async request => {
    if(request.method!=='POST')return fail(405,'METHOD','Usa POST para consultar Q Bot.',{Allow:'POST'});
    const origin=request.headers.get('origin');
    if(origin&&origin!==new URL(request.url).origin)return fail(403,'ORIGIN','Solicitud no permitida.');
    const ip=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'local';
    const key=createHash('sha256').update(ip).digest('hex');
    const day=Math.floor(now()/86400000),minute=Math.floor(now()/60000);
    const previous=visitors.get(key), slot=previous?.day===day?previous:{day,minute,count:0,total:0};
    if(slot.minute!==minute){slot.minute=minute;slot.count=0;}
    if(slot.count>=8||slot.total>=100)return fail(429,'RATE_LIMIT','Has realizado varias consultas. Espera un momento antes de continuar.',{'Retry-After':String(slot.total>=100?Math.ceil(((day+1)*86400000-now())/1000):60)});
    if(visitors.size>=1000&&!visitors.has(key))visitors.delete(visitors.keys().next().value);
    slot.count++;slot.total++;visitors.set(key,slot);
    let input;
    try {input=await readInput(request);}catch(error){return fail(error.message==='INPUT_SIZE'?413:400,'INVALID_REQUEST','Escribe una consulta de hasta 700 caracteres.');}
    if(/^(hola|buenas|buenos dias|buenas tardes|buenas noches|gracias|muchas gracias)[!.¿? ]*$/.test(clean(input.message)))return json(help('greeting'));
    if(!env.GEMINI_API_KEY?.trim())return fail(503,'AI_NOT_CONFIGURED','Q Bot aún no está configurado. Puedes consultar el catálogo mientras tanto.');
    if(concurrent>=3)return fail(429,'BUSY','Q Bot está atendiendo otras consultas. Inténtalo en unos segundos.',{'Retry-After':'10'});
    concurrent++;
    try {
      let snapshot;
      try {snapshot=await loadCatalog();}catch{return fail(503,'CATALOG_UNAVAILABLE','No pude comprobar el inventario en este momento. Inténtalo de nuevo; no mostraré existencias sin verificar.');}
      const model=env.GEMINI_MODEL||'gemini-3.1-flash-lite';
      if(!/^gemini-[a-z0-9.-]+$/.test(model))return fail(503,'AI_CONFIGURATION','Q Bot necesita una revisión de su configuración.');
      const cacheKey=createHash('sha256').update(JSON.stringify([model,snapshot.hash,input])).digest('hex');
      let plan, usage=null;const cached=plans.get(cacheKey);
      if(cached&&cached.expires>now())plan=cached.plan;
      else {
        const catalog=modelContext(snapshot.products,snapshot.fetchedAt,input.message,input.history);
        const context=JSON.stringify({DATOS_CATALOGO:catalog,HISTORIAL:input.history,CONSULTA:input.message});
        if(Buffer.byteLength(context)>21000)return fail(413,'CONTEXT_SIZE','La consulta es demasiado amplia. Indica una marca, modelo o código.');
        const generationConfig={responseMimeType:'application/json',responseJsonSchema:GEMINI_PLAN_SCHEMA,maxOutputTokens:768,
          ...(model.startsWith('gemini-3')?{thinkingConfig:{thinkingLevel:'minimal'}}:model.startsWith('gemini-2.5-flash')?{thinkingConfig:{thinkingBudget:0}}:{})};
        let response;
        try {response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
          method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},signal:AbortSignal.timeout(16000),
          body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM_PROMPT}]},contents:[{role:'user',parts:[{text:context}]}],generationConfig})
        });}catch{return fail(504,'AI_TIMEOUT','Q Bot tardó demasiado en responder. Tu consulta no modificó la cotización; puedes reintentar.');}
        if(response.status===429)return fail(429,'AI_QUOTA','Se alcanzó temporalmente el límite de consultas de Q Bot. Usa el catálogo o inténtalo más tarde.',{'Retry-After':'60'});
        if(!response.ok)return fail(503,'AI_UNAVAILABLE','Q Bot no pudo conectarse al asistente. Puedes consultar el catálogo o reintentar más tarde.');
        const result=await response.json(), candidate=result.candidates?.[0];
        if(candidate?.finishReason!=='STOP')return fail(502,'AI_RESPONSE_INVALID','No pude interpretar esa consulta con seguridad. Intenta con el nombre o código del repuesto.');
        try {plan=validatePlan(JSON.parse(candidate.content.parts.filter(p=>p.text&&!p.thought).map(p=>p.text).join('')));}catch{return fail(502,'AI_RESPONSE_INVALID','No pude interpretar esa consulta con seguridad. Intenta con el nombre o código del repuesto.');}
        usage={inputTokens:result.usageMetadata?.promptTokenCount??null,outputTokens:result.usageMetadata?.candidatesTokenCount??null,thinkingTokens:result.usageMetadata?.thoughtsTokenCount??null};
        if(plans.size>=200)plans.delete(plans.keys().next().value);
        plans.set(cacheKey,{plan,expires:now()+30000});
      }
      return json({...answerFromPlan(plan,snapshot),usage});
    }catch{return fail(503,'CHAT_UNAVAILABLE','No pude completar la consulta. Inténtalo de nuevo en unos momentos.');}
    finally {concurrent--;}
  };
}
