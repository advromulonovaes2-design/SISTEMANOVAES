'use strict';
/* =====================================================================
   Agenda no celular: link secreto de cada pessoa para assinar no
   Google Agenda, no calendário do iPhone ou no Outlook
   ===================================================================== */
const urlAgenda=(t,todos)=>`${String((window.CONFIG||{}).SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'')}/functions/v1/agenda?t=${t}${todos?'&escopo=todos':''}`;
async function renderAgendaLink(novo){
  const box=$('#cfAgenda');if(!box)return;
  box.innerHTML='<span class="hint">Carregando…</span>';
  const{data:t,error}=await sb.rpc('meu_link_agenda',{p_novo:!!novo});
  if(!$('#cfAgenda'))return;
  if(error||!t){box.innerHTML=`<span class="hint">${error&&/function|schema/i.test(error.message||'')?'Para usar, rode o arquivo banco/2-atualizacao.sql no Supabase.':'Não foi possível gerar o link agora.'}</span>`;return;}
  const meus=urlAgenda(t,false),todos=urlAgenda(t,true);
  box.innerHTML=`<span class="hint">Seus prazos, audiências e perícias aparecem sozinhos na agenda do celular e se atualizam de hora em hora. O link é só seu: quem tiver o link vê nomes de clientes e números de processos, então não compartilhe.</span>
    <div class="acts" style="margin:4px 0 0"><button class="btn sm pri" type="button" data-aglink="${esc(meus)}">Copiar link: só os meus</button><button class="btn sm" type="button" data-aglink="${esc(todos)}">Copiar link: escritório todo</button><a class="btn sm" href="${esc(meus.replace(/^https:/,'webcal:'))}">Abrir no iPhone / Mac</a></div>
    <details><summary class="hint" style="cursor:pointer">Como colocar no Google Agenda (Android)</summary><span class="hint">No computador, abra <b>calendar.google.com</b> › à esquerda, em <b>Outras agendas</b>, toque no <b>+</b> › <b>Do URL</b> › cole o link copiado › <b>Adicionar agenda</b>. Em poucos minutos ela aparece também no celular. O Google atualiza a agenda algumas vezes por dia, não na hora.</span></details>
    <details><summary class="hint" style="cursor:pointer">iPhone sem o botão acima</summary><span class="hint">Ajustes › Calendário › Contas › Adicionar Conta › Outra › <b>Adicionar Calendário Assinado</b> › cole o link.</span></details>
    <div><button class="btn sm ghost" type="button" id="agNovo">Gerar link novo (o antigo para de funcionar)</button></div>`;
  box.querySelectorAll('[data-aglink]').forEach(b=>b.onclick=()=>copiar(b.dataset.aglink));
  const n=$('#agNovo');n.onclick=()=>{if(!n.dataset.armed){n.dataset.armed='1';n.textContent='Toque de novo para trocar o link';return;}renderAgendaLink(true).then(()=>toast('Link novo gerado. Assine de novo na agenda do celular.'));};
}
function inserirAgendaLink(){
  const push=$('#cfPush');if(!push||$('#cfAgenda'))return;
  push.insertAdjacentHTML('afterend','<div class="grouph">Agenda no celular</div><div class="fld" id="cfAgenda"></div>');
  renderAgendaLink(false);
}
const CFG_AGENDA=openConfig;
openConfig=function(){CFG_AGENDA();inserirAgendaLink();};
if(typeof openMinhaConta==='function'){const MC=openMinhaConta;openMinhaConta=function(){MC();inserirAgendaLink();};}
