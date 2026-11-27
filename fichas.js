'use strict';
/* =====================================================================
   Ficha de cadastro pelo cliente (cadastro.html): o escritório manda um
   link, o cliente preenche os dados e escolhe uma palavra-chave de
   segurança (contra o golpe do falso advogado). Ao enviar, o sistema
   cadastra ou atualiza o cliente e liga ao processo do link.
   ===================================================================== */
const urlFicha=t=>new URL('cadastro.html?t='+t,location.href.split('#')[0]).href;
const msgFicha=(t,nome)=>`Olá${nome?', '+nome:''}! Para deixarmos seu cadastro completo, preencha seus dados por este link (leva uns 3 minutos):\n${urlFicha(t)}\n\nNo final você escolhe uma *palavra-chave de segurança*. Sempre que alguém disser que fala em nome do escritório, peça essa palavra. Se não souber, não passe dados nem faça pagamento.\n\n${S.config.nome||NOME_PADRAO}`;

/* campos novos nos formulários */
(function(){
  const fc=FORMS.clientes.f,fp=FORMS.processos.f;
  if(!fc.some(x=>x.k==='palavraChave')){
    const i=fc.findIndex(x=>x.g==='Documentos pessoais');
    fc.splice(i<0?fc.length:i,0,{g:'Palavra-chave de segurança'},
      {k:'palavraChave',l:'Palavra-chave combinada com o cliente',t:'text',half:1,hint:'Diga essa palavra quando falar com o cliente por um número novo. O escritório nunca deve pedir pagamento sem ela.'},
      {k:'_ficha',t:'html',id:'fichaBoxCli'});
  }
  if(!fp.some(x=>x.k==='_ficha')){const i=fp.findIndex(x=>x.k==='_cnj');fp.splice(i<0?fp.length:i+1,0,{k:'_ficha',t:'html',id:'fichaBoxProc'});}
})();

async function carregarFicha(campo,id){
  try{const{data,error}=await sb.from('fichas').select('*').eq(campo,id).order('criado_em',{ascending:false}).limit(1);
    if(error)return{erro:true};return(data||[])[0]||null;}
  catch(e){console.error(e);return null;}
}
function htmlFicha(f,ctx){
  const head='<div class="grouph" style="margin:0 0 8px">Ficha de cadastro pelo cliente</div>';
  if(f&&f.erro)return head+'<div class="banner" style="margin:0">Para usar a ficha, rode o arquivo banco/2-atualizacao.sql no Supabase.</div>';
  const ativo=f&&f.ativo&&!f.usado_em&&new Date(f.expira)>new Date();
  if(f&&f.usado_em&&!ativo)return head+`<span class="hint">O cliente preencheu a ficha em ${fmtD(f.usado_em.slice(0,10))}.</span><div class="acts"><button class="btn sm" type="button" data-fichanova>Gerar outro link</button></div>`;
  if(ativo)return head+`<div class="msgbox" style="margin-bottom:8px">${esc(urlFicha(f.token))}</div>
    <div class="acts" style="margin:0 0 6px">${ctx.wa?`<a class="btn sm pri" href="https://wa.me/${ctx.wa}?text=${encodeURIComponent(msgFicha(f.token,ctx.nome))}" target="_blank" rel="noopener">Mandar no WhatsApp</a>`:''}<button class="btn sm" type="button" data-fichacopiar>Copiar mensagem</button><button class="btn sm ghost" type="button" data-fichadesativar>Desativar link</button></div>
    <span class="hint">Aguardando o cliente. O link vale até ${fmtD(f.expira.slice(0,10))} e só pode ser usado uma vez.</span>`;
  return head+`<span class="hint">Mande um link para o cliente preencher os próprios dados (qualificação completa e endereço) e escolher uma palavra-chave contra o golpe do falso advogado. Ao enviar, ${ctx.proc?'ele é cadastrado e ligado a este processo':'o cadastro dele é atualizado'}.</span><div class="acts"><button class="btn sm pri" type="button" data-fichanova>Gerar link da ficha</button></div>`;
}
function ctxFicha(){
  if(!SH)return null;
  if(SH.col==='clientes')return{campo:'cliente_id',box:'#fichaBoxCli',nome:(($('#f_nome')||{}).value||'').split(' ')[0],wa:foneWa(($('#f_telefone')||{}).value||''),proc:false};
  if(SH.col==='processos'){const c=byId('clientes',($('#f_clienteId')||{}).value||(byId('processos',SH.id)||{}).clienteId);
    return{campo:'processo_id',box:'#fichaBoxProc',nome:c?String(c.nome||'').split(' ')[0]:'',wa:c?foneWa(c.telefone):'',proc:true,clienteId:c?c.id:null};}
  return null;
}
async function mostrarFicha(){
  const ctx=ctxFicha();if(!ctx)return;const box=$(ctx.box);if(!box)return;
  if(!SH.id){box.innerHTML='<div class="grouph" style="margin:0 0 6px">Ficha de cadastro pelo cliente</div><span class="hint">Salve primeiro para poder mandar o link da ficha.</span>';return;}
  if(SH.ficha===undefined){SH.ficha=null;const col=SH.col,id=SH.id;const f=await carregarFicha(ctx.campo,id);if(!SH||SH.col!==col||SH.id!==id)return;SH.ficha=f;}
  box.innerHTML=htmlFicha(SH.ficha,ctx);
}
['clientes','processos'].forEach(col=>{const a=FORMS[col].after;FORMS[col].after=function(v){if(a)a.call(this,v);mostrarFicha();};});

/* cliente que preencheu a ficha: aviso para conferir; ao salvar, fica conferido */
{
  const a=FORMS.clientes.after;
  FORMS.clientes.after=function(v){if(a)a.call(this,v);
    const c=SH&&SH.id?byId('clientes',SH.id):null;const box=$('#fichaBoxCli');
    if(c&&c.conferirCadastro&&box&&!box.previousElementSibling?.classList?.contains('fichaconf')){
      const b=document.createElement('div');b.className='banner warn fichaconf';b.style.margin='0 0 10px';
      const em=c.cadastroPeloCliente&&c.cadastroPeloCliente.em?fmtD(String(c.cadastroPeloCliente.em).slice(0,10)):'';
      b.textContent=`Dados preenchidos pelo próprio cliente pela ficha${em?' em '+em:''}. Confira e toque em Salvar: o aviso some.`;box.before(b);}
  };
  const bs=FORMS.clientes.beforeSave;
  FORMS.clientes.beforeSave=function(v,id){const r=bs?bs.call(this,v,id):undefined;if(r===false)return false;const old=id?byId('clientes',id):null;if(old&&old.conferirCadastro){v.conferirCadastro=false;v.cadastroConferidoPor=meuEmail();}return r;};
}

document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-fichanova],[data-fichacopiar],[data-fichadesativar]');if(!t||!SH)return;
  const ctx=ctxFicha();if(!ctx)return;e.preventDefault();e.stopPropagation();
  if('fichacopiar' in t.dataset)return copiar(msgFicha(SH.ficha.token,ctx.nome));
  if('fichanova' in t.dataset){t.disabled=true;
    const reg={criado_por:meuEmail()};if(ctx.campo==='cliente_id')reg.cliente_id=SH.id;else{reg.processo_id=SH.id;if(ctx.clienteId)reg.cliente_id=ctx.clienteId;}
    const{data,error}=await sb.from('fichas').insert(reg).select('*').single();t.disabled=false;if(error)return erroGravar(error);
    SH.ficha=data;mostrarFicha();toast('Link criado. Mande ao cliente pelo WhatsApp.');return;}
  if('fichadesativar' in t.dataset){if(!t.dataset.armed){t.dataset.armed='1';t.textContent='Toque de novo para desativar';return;}
    const{error}=await sb.from('fichas').update({ativo:false}).eq('token',SH.ficha.token);if(error)return erroGravar(error);SH.ficha={...SH.ficha,ativo:false};mostrarFicha();toast('Link desativado.');}
},true);

/* Clientes: ficha para cliente novo (sem processo ainda) */
{
  const tl=VIEWS.clientes.tools;
  VIEWS.clientes.tools=function(){return tl().replace('</div>','<button class="btn" type="button" data-fichacli>Ficha para cliente novo</button></div>');};
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-fichacli]');if(!b)return;e.preventDefault();b.disabled=true;
    const{data,error}=await sb.from('fichas').insert({criado_por:meuEmail()}).select('*').single();b.disabled=false;if(error)return erroGravar(error);
    const sh=$('#sheet');SH={col:'__ficha'};
    sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="fichaT" style="max-width:560px"><div class="ph"><h3 id="fichaT">Ficha para cliente novo</h3><button class="btn ghost sm" type="button" data-fichafechar>Fechar</button></div>
      <div class="pb" style="display:block"><p class="hint" style="margin:0 0 10px">Mande este link ao cliente. Quando ele terminar, o cadastro aparece em Clientes, marcado para conferir. Vale 15 dias e só pode ser usado uma vez.</p>
      <div class="msgbox" style="margin-bottom:10px">${esc(urlFicha(data.token))}</div>
      <div class="fld"><span class="lab">WhatsApp do cliente (opcional)</span><input class="input" id="fichaFone" type="tel" placeholder="(91) 90000-0000" autocomplete="off"></div>
      <div class="acts"><button class="btn pri" type="button" data-fichawa>Mandar no WhatsApp</button><button class="btn" type="button" data-fichacp>Copiar mensagem</button></div></div></div>`;
    sh.hidden=false;sh.dataset.token=data.token;
  });
  document.addEventListener('click',e=>{
    const sh=$('#sheet');if(!sh||!SH||SH.col!=='__ficha')return;
    if(e.target.closest('[data-fichafechar]')){closeForm();return;}
    if(e.target.closest('[data-fichacp]')){copiar(msgFicha(sh.dataset.token,''));return;}
    if(e.target.closest('[data-fichawa]')){const w=foneWa(($('#fichaFone')||{}).value||'');window.open(`https://wa.me/${w}?text=${encodeURIComponent(msgFicha(sh.dataset.token,''))}`,'_blank','noopener');}
  });
}

/* Assistente: fichas preenchidas para conferir */
if(typeof itensOrganizacao==='function'){
  const _it=itensOrganizacao;
  itensOrganizacao=function(){const it=_it();const l=S.clientes.filter(c=>c.conferirCadastro);
    if(l.length)it.unshift({grupo:'hoje',st:'warn',t:'Fichas preenchidas pelo cliente',d:`${l.length===1?'1 cliente preencheu':l.length+' clientes preencheram'} os próprios dados pela ficha. Abra, confira e salve.`,ex:l.slice(0,5).map(c=>({edit:'clientes',id:c.id,label:c.nome||'(sem nome)'})),acao:null});
    return it;};
}
