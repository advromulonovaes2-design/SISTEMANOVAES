'use strict';
/* =====================================================================
   Acompanhamento pelo cliente: link (acompanhar.html) em que o cliente
   vê a fase dos processos dele e os próximos compromissos
   ===================================================================== */
const urlAcomp=t=>new URL('acompanhar.html?t='+t,location.href.split('#')[0]).href;
async function abrirAcompCliente(){
  const box=$('#acompBox');if(!box||!SH||SH.col!=='clientes')return;
  if(!SH.id){box.innerHTML='<div class="grouph" style="margin:0 0 6px">Acompanhamento pelo cliente</div><span class="hint">Salve o cliente para poder mandar o link de acompanhamento.</span>';return;}
  if(SH.acomp===undefined){SH.acomp=null;
    const{data,error}=await sb.from('acompanhamentos').select('*').eq('cliente_id',SH.id).eq('ativo',true).order('criado_em',{ascending:false}).limit(1);
    if(!SH||SH.col!=='clientes')return;
    SH.acomp=error?{erro:true}:((data||[])[0]||null);}
  renderAcompCliente();
}
function renderAcompCliente(){
  const box=$('#acompBox');if(!box||!SH)return;const a=SH.acomp;
  if(a&&a.erro){box.innerHTML='<div class="banner" style="margin:0">Para mandar o link de acompanhamento, rode o arquivo banco/2-atualizacao.sql no Supabase.</div>';return;}
  const nome=(($('#f_nome')||{}).value||'').split(' ')[0];const wa=foneWa(($('#f_telefone')||{}).value||'');
  const msg=a?`Olá, ${nome}! Por este link você acompanha a fase do seu processo e as próximas audiências e perícias, a qualquer hora:\n${urlAcomp(a.token)}\n\nQualquer dúvida, é só chamar.\n${S.config.nome||NOME_PADRAO}`:'';
  box.innerHTML=`<div class="grouph" style="margin:0 0 8px">Acompanhamento pelo cliente</div>
    ${a?`<div class="msgbox" style="margin-bottom:8px">${esc(urlAcomp(a.token))}</div><div class="acts" style="margin:0 0 6px">${wa?`<a class="btn sm pri" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Mandar no WhatsApp</a>`:''}<button class="btn sm" type="button" data-acpcopiar>Copiar mensagem</button><button class="btn sm ghost" type="button" data-acpdesativar>Desativar link</button></div>
      <span class="hint">O cliente vê só a fase, a última movimentação e as próximas audiências e perícias dos processos dele. Não vê prazos, valores, documentos nem anotações.</span>`
    :`<span class="hint">Mande ao cliente um link em que ele vê, sem senha, a fase dos processos dele e as próximas audiências e perícias. Diminui as ligações de "como está meu processo?".</span><div class="acts"><button class="btn sm pri" type="button" data-acpnovo>Criar link de acompanhamento</button></div>`}`;
  box.dataset.msg=msg;
}
const AFTER_CLI_ACP=FORMS.clientes.after;
FORMS.clientes.after=function(v){if(AFTER_CLI_ACP)AFTER_CLI_ACP(v);if(SH&&SH.col==='clientes'){if(SH.acomp===undefined)abrirAcompCliente();else renderAcompCliente();}};
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-acpnovo],[data-acpcopiar],[data-acpdesativar]');if(!t||!SH||SH.col!=='clientes')return;
  e.preventDefault();e.stopPropagation();
  if('acpcopiar' in t.dataset)return copiar($('#acompBox').dataset.msg||'');
  if('acpnovo' in t.dataset){const{data,error}=await sb.from('acompanhamentos').insert({cliente_id:SH.id,criado_por:meuEmail()}).select('*').single();if(error)return erroGravar(error);SH.acomp=data;renderAcompCliente();toast('Link criado. Mande ao cliente pelo WhatsApp.');return;}
  if('acpdesativar' in t.dataset){if(!t.dataset.armed){t.dataset.armed='1';t.textContent='Toque de novo para desativar';return;}
    const{error}=await sb.from('acompanhamentos').update({ativo:false}).eq('token',SH.acomp.token);if(error)return erroGravar(error);SH.acomp=null;renderAcompCliente();toast('Link desativado.');}
},true);
