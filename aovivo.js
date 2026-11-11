'use strict';
/* =====================================================================
   Ao vivo: o que um colega muda aparece na hora para os outros,
   e notificações (push) no celular de cada pessoa da equipe
   ===================================================================== */
const AOVIVO={ch:null,timers:{},estado:'off'};
const TAB_RECARGA={
  config:()=>sb.from('config').select('*').eq('id','geral').maybeSingle().then(({data})=>{if(data){S.config=data.dados||{};applyConfig();}}),
  intimacoes:()=>carregarIntimacoes(),
  movimentacoes:()=>sb.from('movimentacoes').select('*').then(({data})=>{if(data){S.movs={};data.forEach(m=>S.movs[m.numero]=m);}}),
  envios_arquivos:()=>typeof carregarEnviosNovos==='function'?carregarEnviosNovos():null};
function aoVivoMudou(tabela){
  clearTimeout(AOVIVO.timers[tabela]);
  AOVIVO.timers[tabela]=setTimeout(async()=>{
    try{if(TABS.includes(tabela))await carregar(tabela);else if(TAB_RECARGA[tabela])await TAB_RECARGA[tabela]();else return;}catch(e){console.warn('ao vivo',tabela,e);return;}
    lastSync=new Date();setSync();
    // não mexe na tela de quem está com um formulário aberto ou escrevendo
    if(podeAtualizar())body_();else window.__pendente=true;
  },700);
}
function pintarAoVivo(){
  const n=$('#syncNote');if(!n)return;let b=$('#aoVivo');
  if(!b){b=document.createElement('span');b.id='aoVivo';b.className='aovivo';n.parentNode.appendChild(b);}
  b.hidden=AOVIVO.estado!=='on';b.textContent='ao vivo';b.title='As mudanças da equipe aparecem na hora';
}
function ligarAoVivo(){
  if(AOVIVO.ch||!sb||typeof sb.channel!=='function')return;
  try{
    AOVIVO.ch=sb.channel('escritorio-'+Math.random().toString(36).slice(2,8))
      .on('postgres_changes',{event:'*',schema:'public'},p=>{if(p&&p.table)aoVivoMudou(p.table);})
      .subscribe(st=>{AOVIVO.estado=st==='SUBSCRIBED'?'on':'off';pintarAoVivo();});
  }catch(e){console.warn('ao vivo indisponível',e);}
}
function desligarAoVivo(){if(AOVIVO.ch){try{sb.removeChannel(AOVIVO.ch);}catch(_){}AOVIVO.ch=null;}AOVIVO.estado='off';pintarAoVivo();}
// liga depois de carregar os dados pela primeira vez
(window.HOOKS_CARREGAR=window.HOOKS_CARREGAR||[]).push(async()=>{setTimeout(ligarAoVivo,500);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&me&&AOVIVO.ch&&AOVIVO.estado!=='on'){desligarAoVivo();ligarAoVivo();}});

/* ---------- notificações no celular (Web Push) ---------- */
const b64u=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64uBytes=s=>{s=String(s).replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return Uint8Array.from(atob(s),c=>c.charCodeAt(0));};
const pushSuportado=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&window.isSecureContext;
const ehIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent);
const instaladoComoApp=()=>window.matchMedia&&matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const registroSW=()=>Promise.race([navigator.serviceWorker.getRegistration().catch(()=>null),new Promise(r=>setTimeout(()=>r(null),2500))]);
async function assinaturaAtual(){try{const reg=await registroSW();return reg&&reg.pushManager?await reg.pushManager.getSubscription():null;}catch(_){return null;}}
function nomeAparelho(){const u=navigator.userAgent;const so=/Android/.test(u)?'Android':/iPhone|iPad/.test(u)?'iPhone/iPad':/Windows/.test(u)?'Windows':/Mac/.test(u)?'Mac':'Outro';const nav=/Edg\//.test(u)?'Edge':/Chrome\//.test(u)?'Chrome':/Firefox\//.test(u)?'Firefox':/Safari\//.test(u)?'Safari':'Navegador';return so+' · '+nav;}
async function gerarChavesVapid(){
  const k=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']);
  const pub=await crypto.subtle.exportKey('raw',k.publicKey);const jwk=await crypto.subtle.exportKey('jwk',k.privateKey);
  return{publica:b64u(pub),privada:jwk.d};
}
async function ativarPushAqui(){
  const pub=S.config.vapidPublic;if(!pub)return toast('Primeiro gere as chaves de notificação (logo acima).');
  const perm=await Notification.requestPermission();if(perm!=='granted')return toast('O celular não deu permissão. Libere as notificações deste site nas configurações do navegador.');
  try{
    const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
    if(sub){const atual=sub.options&&sub.options.applicationServerKey?b64u(sub.options.applicationServerKey):'';if(atual&&atual!==pub){await sub.unsubscribe();sub=null;}}
    const assinar=()=>reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(pub)});
    if(!sub){try{sub=await assinar();}catch(e1){ /* o Android às vezes falha na 1ª tentativa: limpa e tenta de novo */
      try{const v=await reg.pushManager.getSubscription();if(v)await v.unsubscribe();}catch(_){}
      await new Promise(r=>setTimeout(r,1500));sub=await assinar();}}
    const membro=S.equipe.find(m=>String(m.email||'').toLowerCase()===String(me.email||'').toLowerCase());
    const{error}=await sb.from('push').upsert({endpoint:sub.endpoint,email:me.email,membro_id:membro?membro.id:null,assinatura:sub.toJSON(),aparelho:nomeAparelho()});
    if(error)throw error;
    toast('Pronto! Este aparelho vai receber os avisos.');
  }catch(e){console.error(e);const m=String(e.message||'');toast(/push service|Registration failed/i.test(m)?'O serviço de notificações do Google não aceitou este aparelho (comum em Xiaomi ou navegador sem os serviços do Google). Os avisos continuam chegando pelo Telegram e pelo e-mail.':'Não foi possível ativar: '+(m||'erro'),9000);}
  renderPushAjustes();
}
async function desativarPushAqui(){
  const sub=await assinaturaAtual();if(sub){await sb.from('push').delete().eq('endpoint',sub.endpoint);try{await sub.unsubscribe();}catch(_){}}
  toast('Avisos desligados neste aparelho.');renderPushAjustes();
}
async function renderPushAjustes(){
  const box=$('#cfPush');if(!box)return;const pub=S.config.vapidPublic;
  if(!pushSuportado()){box.innerHTML=`<span class="hint">${ehIOS()&&!instaladoComoApp()?'No iPhone, primeiro instale o sistema na tela inicial (Safari › Compartilhar › Adicionar à Tela de Início), abra por lá e volte aqui.':'Este navegador não aceita notificações. Use o Chrome, o Edge ou o sistema instalado no celular.'}</span>`;return;}
  const reg=await registroSW();if(!$('#cfPush'))return;
  if(!reg){box.innerHTML='<span class="hint">As notificações funcionam no endereço publicado do sistema (https), com o aplicativo instalado ou aberto no navegador. Abra por lá para ativar.</span>';return;}
  const sub=await assinaturaAtual();if(!$('#cfPush'))return;
  const ativo=!!sub&&Notification.permission==='granted';
  const{data:lista}=await sb.from('push').select('endpoint,email,aparelho,criado_em').order('criado_em',{ascending:false});
  const meus=(lista||[]).filter(x=>String(x.email||'').toLowerCase()===String(me.email||'').toLowerCase());
  box.innerHTML=`<span class="hint">O robô manda um aviso no celular de cada responsável quando um prazo está chegando, chega intimação nova ou o cliente envia documento. Cada pessoa ativa no próprio aparelho.</span>
    ${pub?`<div class="acts" style="margin:0">${ativo?`<span class="chip c-ok">Ativo neste aparelho</span><button class="btn sm ghost" type="button" id="pushOff">Desligar aqui</button><button class="btn sm" type="button" id="pushTeste">Mandar aviso de teste</button>`:`<button class="btn pri" type="button" id="pushOn">Receber avisos neste aparelho</button>`}</div>
      ${meus.length?`<span class="hint">Seus aparelhos: ${meus.map(x=>esc(x.aparelho||'aparelho')).join(', ')}</span>`:''}
      <details style="margin-top:4px"><summary class="hint" style="cursor:pointer">Chaves de notificação (administrador)</summary><span class="hint">Já geradas. Se trocar, todos precisam ativar de novo nos aparelhos e a chave secreta nova vai para o GitHub.</span><div><button class="btn sm ghost" type="button" id="pushGerar">Gerar chaves novas</button></div><div id="pushChave"></div></details>`
    :`<span class="hint"><b>Primeira vez:</b> o administrador gera as chaves uma única vez. A chave secreta aparece só agora e vai para o GitHub (Secret <span class="mono">VAPID_PRIVATE</span>). Ela não fica guardada no sistema.</span><div><button class="btn pri" type="button" id="pushGerar">Gerar chaves de notificação</button></div><div id="pushChave"></div>`}
    ${ehIOS()?'<span class="hint">iPhone: só funciona com o sistema instalado na tela inicial (iOS 16.4 ou mais novo).</span>':''}`;
  const on=$('#pushOn');if(on)on.onclick=ativarPushAqui;
  const off=$('#pushOff');if(off)off.onclick=desativarPushAqui;
  const te=$('#pushTeste');if(te)te.onclick=async()=>{const reg=await navigator.serviceWorker.ready;reg.showNotification(S.config.nome||NOME_PADRAO,{body:'Teste: os avisos estão chegando neste aparelho. Os avisos de verdade vêm do robô, duas vezes por dia.',icon:'icone-192.png',badge:'icone-192.png',tag:'teste'});};
  const g=$('#pushGerar');if(g)g.onclick=async()=>{
    if(pub&&!g.dataset.armed){g.dataset.armed='1';g.textContent='Toque de novo para trocar as chaves';return;}
    g.disabled=true;
    try{const k=await gerarChavesVapid();if(!(await salvarConfig({...S.config,vapidPublic:k.publica})))return;
      $('#pushChave').innerHTML=`<div class="banner" style="margin:8px 0 0;display:block"><b>Copie a chave secreta abaixo agora</b> e cole no GitHub: repositório › Settings › Secrets and variables › Actions › New repository secret, com o nome <span class="mono">VAPID_PRIVATE</span>. Depois de fechar esta tela ela não aparece mais.<div class="msgbox mono" style="margin:8px 0;word-break:break-all">${esc(k.privada)}</div><button class="btn sm" type="button" id="pushCopiar">Copiar chave secreta</button></div>`;
      $('#pushCopiar').onclick=()=>copiar(k.privada);
      const box2=$('#cfPush');const hint=document.createElement('div');hint.className='acts';hint.innerHTML='<button class="btn pri" type="button" id="pushOn2">Receber avisos neste aparelho</button>';box2.appendChild(hint);$('#pushOn2').onclick=ativarPushAqui;
    }catch(e){console.error(e);toast('Não foi possível gerar: '+(e.message||'erro'));}
    finally{g.disabled=false;}};
}
