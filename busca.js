'use strict';
/* =====================================================================
   Botão "Buscar agora" na aba Intimações: pede ao robô uma busca no DJEN
   na hora (além das buscas automáticas de segunda a sexta)
   ===================================================================== */
S.robo={};
async function carregarStatusRobo(){
  const{data}=await sb.from('config').select('dados').eq('id','robo').maybeSingle();
  S.robo=(data&&data.dados)||{};
}
(window.HOOKS_CARREGAR=window.HOOKS_CARREGAR||[]).push(carregarStatusRobo);
if(typeof TAB_RECARGA==='object'){const antes=TAB_RECARGA.config;TAB_RECARGA.config=async()=>{await Promise.all([antes&&antes(),carregarStatusRobo()]);verBuscaTerminou();};}

const BUSCA={inicio:0,timer:null,msg:''};
const quandoFoi=iso=>{if(!iso)return'';const d=new Date(iso),h=new Date();const mesmoDia=d.toDateString()===h.toDateString();
  const hm=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});return mesmoDia?'hoje às '+hm:fmtD(d.toISOString().slice(0,10))+' às '+hm;};
function textoUltimaBusca(){
  const r=S.robo||{};if(!r.ultimaExecucao)return'O robô ainda não rodou nenhuma vez.';
  const djen=r.djen==='falhou'?' · o DJEN não respondeu':r.djen==='sem OAB cadastrada'?' · nenhuma OAB cadastrada na Equipe':'';
  return `Última busca ${quandoFoi(r.ultimaExecucao)}${typeof r.novas==='number'?` · ${r.novas} ${r.novas===1?'nova':'novas'}`:''}${djen}`;
}
function pintarBusca(){
  const st=$('#buscaSt'),bt=$('#btnBuscar');if(!st||!bt)return;
  const ativo=!!BUSCA.inicio;
  bt.disabled=ativo;bt.textContent=ativo?'Buscando…':'Buscar agora';
  st.textContent=BUSCA.msg||textoUltimaBusca();st.classList.toggle('warn',!!BUSCA.erro);
}
function verBuscaTerminou(){
  if(!BUSCA.inicio)return pintarBusca();
  const fim=S.robo&&S.robo.ultimaExecucao?new Date(S.robo.ultimaExecucao).getTime():0;
  if(fim>=BUSCA.inicio-5000){
    const n=S.robo.novas||0;BUSCA.inicio=0;BUSCA.msg='';BUSCA.erro=false;clearInterval(BUSCA.timer);
    carregarIntimacoes().catch(()=>{}).then(()=>{if(cur==='intimacoes'&&podeAtualizar())body_();pintarBusca();});
    toast(S.robo.djen==='falhou'?'O DJEN não respondeu nesta busca. Tente de novo daqui a pouco.':n?`Busca concluída: ${n} ${n===1?'intimação nova':'intimações novas'}.`:'Busca concluída: nenhuma intimação nova.');
    return;
  }
  if(Date.now()-BUSCA.inicio>7*60000){BUSCA.inicio=0;clearInterval(BUSCA.timer);BUSCA.erro=true;BUSCA.msg='A busca está demorando mais que o normal. Veja em GitHub › Actions se o robô rodou.';}
  pintarBusca();
}
async function buscarAgora(){
  if(BUSCA.inicio)return;
  const bt=$('#btnBuscar');if(bt){bt.disabled=true;bt.textContent='Pedindo…';}
  let res=null,status=0;
  try{
    const{data,error}=await sb.functions.invoke('buscar-intimacoes',{body:{}});
    if(error){status=error.context&&error.context.status||0;try{res=await error.context.json();}catch(_){res={erro:'rede'};}}
    else res=data;
  }catch(e){res={erro:'rede'};}
  if(res&&res.ok){
    BUSCA.inicio=res.jaRodando&&res.desde?new Date(res.desde).getTime():Date.now();BUSCA.erro=false;
    BUSCA.msg=res.jaRodando?'O robô já está buscando agora. As novas aparecem aqui sozinhas.':'Buscando no DJEN pelas OABs da equipe. Leva de 1 a 3 minutos; as novas aparecem aqui sozinhas.';
    clearInterval(BUSCA.timer);BUSCA.timer=setInterval(async()=>{try{await carregarStatusRobo();}catch(_){}verBuscaTerminou();},15000);
    pintarBusca();return;
  }
  BUSCA.erro=true;
  const e=res&&res.erro;
  BUSCA.msg=e==='sem_token'||e==='token_invalido'?'O botão ainda não está ligado ao GitHub: falta o token (veja o passo a passo, "Botão Buscar agora").'
    :e==='sem_permissao_actions'?'O token do GitHub não tem permissão para rodar o robô: em Permissions › Actions, escolha "Read and write" e gere de novo.'
    :e==='workflow'?'O GitHub não aceitou o pedido do robô (arquivo robo.yml). Avise o suporte do sistema.'
    :e==='sem_permissao'?'Seu login não tem permissão para buscar.'
    :e==='rede'&&!status?'Não foi possível pedir a busca (sem internet ou a função não está instalada).'
    :`O GitHub recusou o pedido agora${res&&res.status?' (código '+res.status+')':''}. Tente de novo em alguns minutos.`;
  pintarBusca();
}
const TOOLS_INT=VIEWS.intimacoes.tools,BIND_INT=VIEWS.intimacoes.bind;
VIEWS.intimacoes.tools=function(){
  return TOOLS_INT().replace('</div></div>',`</div><div class="busca"><span class="hint" id="buscaSt" aria-live="polite"></span><button class="btn pri" id="btnBuscar" type="button">Buscar agora</button></div></div>`);
};
VIEWS.intimacoes.bind=function(){if(BIND_INT)BIND_INT();$('#btnBuscar').onclick=buscarAgora;pintarBusca();};
