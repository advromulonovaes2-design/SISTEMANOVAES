'use strict';
/* =====================================================================
   Registro de erros: o que der errado na tela de alguém fica anotado
   (gestores veem na Saúde do sistema; ajuda a achar e corrigir defeitos)
   ===================================================================== */
const ERROS={n:0,vistos:new Set(),lista:[]};
async function anotarErro(mensagem,detalhe){
  try{
    if(typeof me==='undefined'||!me||!me.email||typeof sb==='undefined'||!sb||ERROS.n>=20)return;
    const msg=String(mensagem||'Erro sem mensagem').slice(0,500);
    if(ERROS.vistos.has(msg))return;ERROS.vistos.add(msg);ERROS.n++;
    await sb.from('erros').insert({usuario:me.email,versao:typeof VERSAO==='string'?VERSAO:'',tela:typeof cur==='string'?cur:'',
      mensagem:msg,detalhe:String(detalhe||'').slice(0,2000),agente:navigator.userAgent.slice(0,200)});
  }catch(_){/* registrar erro nunca pode causar outro erro */}
}
window.addEventListener('error',e=>{
  const m=e&&e.message||'';if(!m||/ResizeObserver loop|^Script error\.?$/.test(m))return;
  anotarErro(m,`${e.filename||''}:${e.lineno||''}:${e.colno||''}\n${e.error&&e.error.stack||''}`);
});
window.addEventListener('unhandledrejection',e=>{
  const r=e&&e.reason;const m=r&&r.message||String(r||'');if(!m||/AbortError|Failed to fetch|NetworkError|Load failed/i.test(m))return;
  anotarErro('Falha: '+m,r&&r.stack||'');
});
// erros do banco ao gravar (ex.: "invalid input syntax for type uuid")
if(typeof erroGravar==='function'){
  const _erroGravar=erroGravar;
  erroGravar=function(e){
    const m=e&&(e.message||e.error_description)||String(e||'');
    if(!/Failed to fetch|NetworkError|Load failed/i.test(m))anotarErro('Ao gravar: '+m,JSON.stringify({code:e&&e.code,details:e&&e.details,hint:e&&e.hint}).slice(0,1500));
    return _erroGravar.apply(this,arguments);
  };
}
async function carregarErros(){
  if(typeof ehGestor!=='function'||!ehGestor()){ERROS.lista=[];return;}
  try{
    const desde=new Date(Date.now()-14*864e5).toISOString();
    const{data,error}=await sb.from('erros').select('id,quando,usuario,tela,mensagem,versao').gte('quando',desde).order('id',{ascending:false}).limit(50);
    ERROS.lista=error?[]:(data||[]);ERROS.semTabela=!!error;
  }catch(_){ERROS.lista=[];ERROS.semTabela=true;}
}
(window.HOOKS_CARREGAR=window.HOOKS_CARREGAR||[]).push(carregarErros);
// item na Saúde do sistema
if(typeof itensSaude==='function'){
  const _itens=itensSaude;
  itensSaude=function(){
    const it=_itens();if(ERROS.semTabela)return it;
    const l=ERROS.lista;
    it.push(l.length?{st:'warn',t:'Erros na tela da equipe',d:`${l.length} ${l.length===1?'erro anotado':'erros anotados'} nos últimos 14 dias. Veja abaixo e, se continuar, conte para a manutenção do sistema.`,erros:true}
      :{st:'ok',t:'Erros na tela da equipe',d:'Nenhum erro anotado nos últimos 14 dias.'});
    return it;
  };
}
if(typeof renderSaude==='function'){
  const _render=renderSaude;
  renderSaude=function(){
    _render();const box=$('#cfSaude');if(!box||!ERROS.lista.length)return;
    const det=document.createElement('details');det.className='erros-lista';
    det.innerHTML=`<summary>Ver os erros anotados (${ERROS.lista.length})</summary><div class="cklist">${ERROS.lista.slice(0,20).map(e=>`<div class="ckrow"><label style="cursor:default"><span>${esc(e.mensagem||'')}<span class="tag" style="display:block">${fmtDT(e.quando)} · ${esc(e.usuario||'')}${e.tela?' · tela '+esc(e.tela):''}${e.versao?' · versão '+esc(e.versao):''}</span></span></label></div>`).join('')}</div><button class="btn sm ghost" type="button" id="errosLimpar">Limpar a lista</button>`;
    box.appendChild(det);
    $('#errosLimpar').onclick=async()=>{const b=$('#errosLimpar');if(!b.dataset.armed){b.dataset.armed='1';b.textContent='Toque de novo para limpar';return;}
      const{error}=await sb.from('erros').delete().gte('id',0);if(error)return toast('Não foi possível limpar.');ERROS.lista=[];renderSaude();toast('Lista de erros limpa.');};
  };
}
