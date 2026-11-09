'use strict';
/* =====================================================================
   Documentos enviados pelo próprio cliente (link enviar.html)
   ===================================================================== */
S.envNovos=[];
async function carregarEnviosNovos(){
  const{data,error}=await sb.from('envios_arquivos').select('*').eq('status','novo').order('id',{ascending:false}).limit(200);
  S.envNovos=error?[]:(data||[]);
}
(window.HOOKS_CARREGAR=window.HOOKS_CARREGAR||[]).push(carregarEnviosNovos);
const urlEnvio=t=>new URL('enviar.html?t='+t,location.href.split('#')[0]).href;

/* caixa dentro do cadastro do cliente */
async function abrirEnviosCliente(){
  const box=$('#enviosBox');if(!box||!SH||SH.col!=='clientes')return;
  if(!SH.id){box.innerHTML='<div class="grouph" style="margin:0 0 6px">Documentos pelo link</div><span class="hint">Salve o cliente para poder enviar a ele um link e receber os documentos pelo celular.</span>';return;}
  if(!SH.env){SH.env={arqs:null,link:null};
    const[a,b]=await Promise.all([
      sb.from('envios_arquivos').select('*').eq('cliente_id',SH.id).order('id',{ascending:false}),
      sb.from('envios').select('*').eq('cliente_id',SH.id).eq('ativo',true).order('criado_em',{ascending:false}).limit(1)]);
    if(!SH||SH.col!=='clientes')return;
    SH.env.arqs=a.error?[]:(a.data||[]);const l=(b.data||[])[0];if(l&&new Date(l.expira)>new Date())SH.env.link=l;
    if(a.error)SH.env.erro=true;}
  renderEnviosCliente();
}
function renderEnviosCliente(){
  const box=$('#enviosBox');if(!box||!SH||!SH.env)return;const E=SH.env;
  if(E.erro){box.innerHTML='<div class="banner" style="margin:0">Para receber documentos pelo link, rode o arquivo banco/2-atualizacao.sql no Supabase.</div>';return;}
  const tel=$('#f_telefone')?$('#f_telefone').value:'';const wa=foneWa(tel);
  const arqs=E.arqs||[];
  const msg=E.link?`Olá, ${(($('#f_nome')||{}).value||'').split(' ')[0]}! Para adiantar seu atendimento, envie as fotos dos documentos por este link seguro, direto do celular:\n${urlEnvio(E.link.token)}\n\nO link vale até ${fmtDT(E.link.expira)}. Qualquer dúvida, é só chamar.\n${S.config.nome||NOME_PADRAO}`:'';
  box.innerHTML=`<div class="grouph" style="margin:0 0 8px">Documentos pelo link do cliente</div>
    ${E.link?`<div class="msgbox" style="margin-bottom:8px">${esc(urlEnvio(E.link.token))}</div><div class="acts" style="margin:0 0 10px">${wa?`<a class="btn sm pri" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Mandar no WhatsApp</a>`:''}<button class="btn sm" type="button" data-envcopiar>Copiar mensagem</button><button class="btn sm ghost" type="button" data-envnovo>Gerar novo link</button><button class="btn sm ghost" type="button" data-envdesativar>Desativar link</button></div><span class="hint">O link vale até ${fmtDT(E.link.expira)} e mostra ao cliente só os documentos que ainda faltam.</span>`
      :`<span class="hint">Gere um link e mande ao cliente: ele tira as fotos dos documentos pelo celular, sem precisar de senha, e elas chegam aqui para você conferir.</span><div class="acts"><button class="btn sm pri" type="button" data-envnovo>Pedir documentos pelo link</button></div>`}
    ${arqs.length?`<div class="cklist" style="margin-top:10px">${arqs.map(a=>`<div class="ckrow"><label style="cursor:default"><span>${esc(a.rotulo||a.item||'Documento')}<span class="tag" style="display:block">${fmtDT(a.criado_em)} · ${a.status==='novo'?'para conferir':a.status==='aceito'?'aceito':'recusado'}</span></span></label>
      <button class="btn sm" type="button" data-envver="${esc(a.caminho)}">Ver</button>${a.status==='novo'?`<button class="btn sm pri" type="button" data-envaceitar="${a.id}">Aceitar</button><button class="btn sm ghost" type="button" data-envrecusar="${a.id}">Recusar</button>`:''}</div>`).join('')}</div>`:''}`;
  box.dataset.msg=msg;
}
async function novoLinkEnvio(){
  const v=collect(SH.F.f);const ctx=ckCasoDe(v);
  const pend=checklistItens(ctx).filter(([k])=>!((SH.ck[k]&&SH.ck[k].ok)||ckAutoCliente(k))).filter(([k])=>!['procuracao','contrato'].includes(k)).map(([k,l])=>({k,l}));
  if(SH.env.link)await sb.from('envios').update({ativo:false}).eq('token',SH.env.link.token);
  const{data,error}=await sb.from('envios').insert({cliente_id:SH.id,itens:pend,criado_por:me&&me.email||''}).select('*').single();
  if(error)return erroGravar(error);
  SH.env.link=data;renderEnviosCliente();toast('Link criado. Mande ao cliente pelo WhatsApp.');
}
async function decidirEnvio(id,aceitar){
  const a=(SH.env.arqs||[]).find(x=>x.id===id);if(!a)return;
  const{error}=await sb.from('envios_arquivos').update({status:aceitar?'aceito':'recusado'}).eq('id',id);if(error)return erroGravar(error);
  a.status=aceitar?'aceito':'recusado';
  if(aceitar&&a.item&&a.item!=='outro'){SH.ck[a.item]={ok:true,arquivo:'envios:'+a.caminho};toast('Aceito e marcado no checklist. Toque em Salvar para gravar.');}
  else toast(aceitar?'Aceito.':'Recusado.');
  S.envNovos=S.envNovos.filter(x=>x.id!==id);
  if(SH.refresh)SH.refresh();renderEnviosCliente();
}
// liga ao formulário do cliente
FORMS.clientes.after=function(){if(SH&&SH.col==='clientes'){if(!SH.env)abrirEnviosCliente();else renderEnviosCliente();}};
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-envnovo],[data-envcopiar],[data-envdesativar],[data-envver],[data-envaceitar],[data-envrecusar]');if(!t||!SH||SH.col!=='clientes')return;
  e.preventDefault();e.stopPropagation();
  if('envnovo' in t.dataset)return novoLinkEnvio();
  if('envcopiar' in t.dataset)return copiar($('#enviosBox').dataset.msg||'');
  if('envdesativar' in t.dataset){sb.from('envios').update({ativo:false}).eq('token',SH.env.link.token).then(({error})=>{if(error)return erroGravar(error);SH.env.link=null;renderEnviosCliente();toast('Link desativado. O cliente não consegue mais enviar por ele.');});return;}
  if(t.dataset.envver)return abrirArquivo('envios:'+t.dataset.envver);
  if(t.dataset.envaceitar)return decidirEnvio(Number(t.dataset.envaceitar),true);
  if(t.dataset.envrecusar)return decidirEnvio(Number(t.dataset.envrecusar),false);
},true);

/* aviso no Início */
const INI_ENV=VIEWS.inicio.body;
VIEWS.inicio.body=function(){
  const h=INI_ENV();const l=S.envNovos||[];if(!l.length)return h;
  const porCli={};l.forEach(a=>{(porCli[a.cliente_id]=porCli[a.cliente_id]||[]).push(a);});
  const sec=`<div class="sec"><h2>Documentos enviados por clientes</h2><div class="list">${Object.entries(porCli).map(([cid,as])=>{const c=byId('clientes',cid);return `<div class="row click a-prev" data-edit="clientes" data-id="${esc(cid)}" role="button" tabindex="0"><div class="main"><div class="t">${esc(c?c.nome:'Cliente')}</div><div class="m">${as.length} ${as.length===1?'documento para conferir':'documentos para conferir'}: ${esc(as.map(a=>a.rotulo||a.item).slice(0,4).join(', '))}</div></div><div class="side"><span class="chip c-warn">Conferir</span></div></div>`;}).join('')}</div></div>`;
  const i=h.indexOf('<div class="sec">');return i<0?h+sec:h.slice(0,i)+sec+h.slice(i);
};
