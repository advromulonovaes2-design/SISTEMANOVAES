'use strict';
/* =====================================================================
   Cofre de senhas gov.br
   - A senha da cliente é criptografada NO APARELHO (AES-256-GCM) antes de ir ao banco.
   - A chave sai de uma "senha do cofre" que só a equipe sabe (PBKDF2, 600 mil rodadas).
   - O banco, o robô e a cópia de segurança só veem a senha embaralhada.
   - O cofre se tranca sozinho após 10 minutos sem uso.
   - Se a senha do cofre for esquecida, as senhas guardadas não podem ser recuperadas
     (basta cadastrar de novo com a cliente).
   ===================================================================== */
const COFRE={key:null,timer:null,ITER:600000};
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const cofreCriado=()=>!!(S.config.cofre&&S.config.cofre.salt&&S.config.cofre.check);
const cofreAberto=()=>!!COFRE.key;
function cofreSuportado(){return !!(window.crypto&&crypto.subtle&&window.isSecureContext!==false);}

async function derivarChave(senha,saltB64,iter){
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(senha),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:unb64(saltB64),iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function cifrar(key,texto,vinculo){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(vinculo||'')},key,new TextEncoder().encode(texto));
  return{v:1,iv:b64(iv),ct:b64(ct)};
}
async function decifrar(key,obj,vinculo){
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(obj.iv),additionalData:new TextEncoder().encode(vinculo||'')},key,unb64(obj.ct));
  return new TextDecoder().decode(pt);
}
function cofreMexeu(){clearTimeout(COFRE.timer);COFRE.timer=setTimeout(trancarCofre,10*60*1000);}
function trancarCofre(){COFRE.key=null;clearTimeout(COFRE.timer);if(SH&&SH.gov){SH.gov.mostrar=false;SH.gov.claro=null;}document.querySelectorAll('[data-govbox]').forEach(el=>renderGov(el.dataset.govbox));}

async function abrirCofre(senha){
  if(!cofreCriado())return false;
  const c=S.config.cofre;
  try{const k=await derivarChave(senha,c.salt,c.iter||COFRE.ITER);const ok=await decifrar(k,c.check,'cofre');if(ok!=='cofre-ok')return false;COFRE.key=k;cofreMexeu();return true;}
  catch(e){return false;}
}
async function criarCofre(senha){
  const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
  const k=await derivarChave(senha,salt,COFRE.ITER);
  const check=await cifrar(k,'cofre-ok','cofre');
  const ok=await salvarConfig({...S.config,cofre:{salt,iter:COFRE.ITER,check,criadoEm:new Date().toISOString(),criadoPor:me&&me.email||''}});
  if(ok){COFRE.key=k;cofreMexeu();}
  return ok;
}
async function trocarSenhaCofre(nova,progresso){
  if(!COFRE.key)throw new Error('Destranque o cofre antes.');
  const antiga=COFRE.key;
  const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
  const k=await derivarChave(nova,salt,COFRE.ITER);
  const alvo=S.clientes.filter(c=>c.govSenha&&c.govSenha.ct);
  // 1) confere que todas abrem com a chave atual antes de mexer em qualquer coisa
  const abertas=[];
  for(const c of alvo){abertas.push([c,await decifrar(antiga,c.govSenha,c.id)]);}
  // 2) regrava cada cliente com a chave nova; se algo falhar, desfaz o que já foi regravado
  const feitos=[];
  const grava=(c,enc)=>sb.from('clientes').update({dados:limpa({...c,govSenha:enc}),atualizado_em:new Date().toISOString()}).eq('id',c.id).then(({error})=>{if(error)throw error;});
  try{
    for(const[c,senha]of abertas){await grava(c,await cifrar(k,senha,c.id));feitos.push(c);if(progresso)progresso(feitos.length,abertas.length);}
    const check=await cifrar(k,'cofre-ok','cofre');
    const ok=await salvarConfig({...S.config,cofre:{salt,iter:COFRE.ITER,check,criadoEm:new Date().toISOString(),criadoPor:me&&me.email||''}});
    if(!ok)throw new Error('não salvou a nova senha do cofre');
  }catch(e){
    let desfeito=true;
    for(const c of feitos){try{await grava(c,c.govSenha);}catch(_){desfeito=false;}}
    await carregar('clientes');
    throw new Error(desfeito?`${e.message||'erro'}. Nada foi alterado; a senha antiga continua valendo`:`${e.message||'erro'}. Algumas senhas podem ter ficado com a senha nova do cofre; cadastre-as de novo se não abrirem`);
  }
  const n=feitos.length;
  COFRE.key=k;cofreMexeu();await carregar('clientes');
  return n;
}

/* ---------- campo no cadastro da cliente ---------- */
function htmlGov(id){
  return `<div class="filebox" data-govbox="${esc(id)}" style="flex-direction:column;align-items:stretch;gap:8px"></div>`;
}
function renderGov(id){
  const box=document.querySelector(`[data-govbox="${CSS.escape(id)}"]`);if(!box||!SH||!SH.gov)return;
  const G=SH.gov,tem=!!(G.enc&&G.enc.ct)||!!G.nova;
  if(!cofreSuportado()){box.innerHTML='<span class="nm">Abra o sistema pelo endereço https para usar o cofre.</span>';return;}
  if(!cofreCriado()){box.innerHTML=`<span class="nm">O cofre ainda não foi criado. Crie a senha do cofre em Ajustes para guardar senhas gov.br com segurança.</span><div><button class="btn sm" type="button" data-gov="ajustes">Abrir Ajustes</button></div>`;return;}
  if(!cofreAberto()){
    box.innerHTML=`<span class="nm">${tem?'Senha guardada no cofre (trancado).':'Nenhuma senha guardada.'}</span>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" type="password" id="govMestra" placeholder="Senha do cofre" autocomplete="off" style="flex:1;min-width:160px"><button class="btn sm pri" type="button" data-gov="abrir">Destrancar</button></div>`;
    return;
  }
  const mostrar=G.mostrar&&G.claro!=null;
  box.innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input class="input mono" id="govSenhaIn" type="${mostrar?'text':'password'}" autocomplete="new-password" placeholder="${tem?'••••••••  (guardada)':'Digite a senha gov.br da cliente'}" value="${esc(G.nova!=null?G.nova:(mostrar?G.claro:''))}" style="flex:1;min-width:170px">
      ${tem||G.nova?`<button class="btn sm" type="button" data-gov="ver">${mostrar?'Ocultar':'Mostrar'}</button><button class="btn sm" type="button" data-gov="copiar">Copiar</button>`:''}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between">
      <span class="hint">${G.nova!=null?'Nova senha: será criptografada ao salvar.':tem?(G.info||'Guardada e criptografada.'):'Cofre destrancado.'}</span>
      <span style="display:flex;gap:6px">${tem?'<button class="btn sm ghost" type="button" data-gov="apagar">Apagar senha</button>':''}<button class="btn sm ghost" type="button" data-gov="trancar">Trancar cofre</button></span>
    </div>`;
  const inp=box.querySelector('#govSenhaIn');
  inp.addEventListener('input',()=>{G.nova=inp.value===''?null:inp.value;G.apagar=false;cofreMexeu();const h=box.querySelector('.hint');if(h)h.textContent=G.nova!=null?'Nova senha: será criptografada ao salvar.':'';});
}
async function revelarGov(){
  const G=SH.gov;if(G.claro!=null||!G.enc)return G.claro;
  try{G.claro=await decifrar(COFRE.key,G.enc,G.vinculo);}catch(e){G.claro=null;toast('Não foi possível abrir esta senha. Cadastre de novo com a cliente.');}
  return G.claro;
}
async function cliqueGov(acao,box){
  const G=SH.gov,id=box.dataset.govbox;cofreMexeu();
  if(acao==='ajustes'){closeForm();openConfig();return;}
  if(acao==='abrir'){const s=box.querySelector('#govMestra').value;if(!s)return toast('Digite a senha do cofre.');const b=box.querySelector('[data-gov="abrir"]');b.disabled=true;b.textContent='Abrindo…';
    if(await abrirCofre(s)){toast('Cofre destrancado por 10 minutos.');renderGov(id);}else{b.disabled=false;b.textContent='Destrancar';toast('Senha do cofre incorreta.');}return;}
  if(acao==='trancar'){trancarCofre();return;}
  const nomeCli=()=>($('#f_nome')&&$('#f_nome').value)||'';
  if((acao==='ver'||acao==='copiar')&&G.nova==null&&!G['log'+acao]&&typeof registrarHist==='function'){G['log'+acao]=1;registrarHist(acao==='ver'?'viu senha gov.br':'copiou senha gov.br','clientes',SH.id||SH.novoId,nomeCli());}
  if(acao==='ver'){if(G.mostrar){G.mostrar=false;renderGov(id);return;}if(G.nova==null)await revelarGov();G.mostrar=true;renderGov(id);
    clearTimeout(G.t);G.t=setTimeout(()=>{if(SH&&SH.gov===G){G.mostrar=false;renderGov(id);}},20000);return;}
  if(acao==='copiar'){const v=G.nova!=null?G.nova:await revelarGov();if(v)copiar(v);return;}
  if(acao==='apagar'){if(!box.dataset.armed){box.dataset.armed='1';const b=box.querySelector('[data-gov="apagar"]');b.textContent='Toque de novo para apagar';setTimeout(()=>{delete box.dataset.armed;if(b.isConnected)b.textContent='Apagar senha';},4000);return;}
    G.enc=null;G.nova=null;G.claro=null;G.apagar=true;renderGov(id);toast('A senha será apagada ao salvar.');return;}
}
async function prepararGov(v,id){ // roda antes de salvar a cliente
  const G=SH&&SH.gov;if(!G)return;
  const vinculo=id||SH.novoId;
  if(G.nova!=null&&G.nova!==''){
    if(!COFRE.key){toast('Destranque o cofre para salvar a senha.');return false;}
    if(!v.govAutorizado){toast('Marque que a cliente autorizou guardar a senha.');document.getElementById('f_govAutorizado')?.focus();return false;}
    v.govSenha=await cifrar(COFRE.key,G.nova,vinculo);v.govSenhaEm=new Date().toISOString();v.govSenhaPor=me&&me.email||'';
  }else if(G.apagar){v.govSenha=null;v.govSenhaEm='';v.govSenhaPor='';}
  else v.govSenha=G.enc||null;
}

/* ---------- liga o campo ao formulário de clientes ---------- */
(function(){
  const F=FORMS.clientes.f;const i=F.findIndex(x=>x.g==='Acompanhamento');
  const ehPrev=f=>['Previdenciário','Mais de uma área','Ambos'].includes(f.area);
  F.splice(i,0,
    {g:'Acesso gov.br / Meu INSS',show:ehPrev},
    {k:'govLogin',l:'Login (CPF)',t:'text',half:1,mono:1,fmt:'cpf',show:ehPrev,hint:'Se ficar vazio, usa o CPF do cadastro.'},
    {k:'govNivel',l:'Nível da conta',t:'select',o:['Não sei','Bronze','Prata','Ouro'],half:1,show:ehPrev,hint:'Prata ou ouro assina documentos.'},
    {k:'govSenha',l:'Senha',t:'gov',show:ehPrev},
    {k:'gov2fa',l:'Verificação em duas etapas',t:'text',show:ehPrev,ph:'Código chega no celular da filha (91) 9xxxx-xxxx',hint:'Anote para quem ligar quando o gov.br pedir o código.'},
    {k:'govAutorizado',l:'A cliente autorizou o escritório a guardar esta senha',t:'check',show:ehPrev,hint:'Exigido para salvar a senha. O contrato gerado passa a ter a cláusula de autorização.'}
  );
  const antes=FORMS.clientes.beforeSave;
  FORMS.clientes.beforeSave=async(v,id)=>{if(antes&&await antes(v,id)===false)return false;return prepararGov(v,id);};
})();
