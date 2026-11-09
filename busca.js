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

const BUSCA={inicio:0,timer:null,msg:'',limite:7};
const PERIODOS=[[3,'Recentes (3 dias)'],[30,'Últimos 30 dias'],[90,'Últimos 90 dias'],[365,'Último ano'],[730,'Últimos 2 anos']];
const lerPref=(k,d)=>{try{return localStorage.getItem('busca_'+k)??d;}catch(_){return d;}};
const gravarPref=(k,v)=>{try{localStorage.setItem('busca_'+k,v);}catch(_){}};
const oabsDaEquipe=()=>S.equipe.filter(m=>m.ativo!==false&&m.oab&&parseOab(m.oab).uf).map(m=>{const o=parseOab(m.oab);return{oab:o.uf+' '+String(parseInt(o.num,10)),nome:m.nome};});
const quandoFoi=iso=>{if(!iso)return'';const d=new Date(iso),h=new Date();const mesmoDia=d.toDateString()===h.toDateString();
  const hm=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});return mesmoDia?'hoje às '+hm:fmtD(d.toISOString().slice(0,10))+' às '+hm;};
function textoUltimaBusca(){
  const r=S.robo||{};if(!r.ultimaExecucao)return'O robô ainda não rodou nenhuma vez.';
  const djen=r.djen==='falhou'?' · o DJEN não respondeu':r.djen==='sem OAB cadastrada'?' · nenhuma OAB cadastrada na Equipe':'';
  const per=r.periodo_dias>3?` (${PERIODOS.find(p=>p[0]===r.periodo_dias)?.[1].toLowerCase()||r.periodo_dias+' dias'}${r.oab?', OAB '+r.oab:''})`:r.oab?` (OAB ${r.oab})`:'';
  const ant=r.antigas?` · ${r.antigas} ${r.antigas===1?'antiga':'antigas'} em "Processos da OAB"`:'';
  return `Última busca ${quandoFoi(r.ultimaExecucao)}${per}${typeof r.novas==='number'?` · ${r.novas} ${r.novas===1?'nova':'novas'}`:''}${ant}${djen}`;
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
  if(Date.now()-BUSCA.inicio>BUSCA.limite*60000){BUSCA.inicio=0;clearInterval(BUSCA.timer);BUSCA.erro=true;BUSCA.msg='A busca está demorando mais que o normal. Veja em GitHub › Actions se o robô rodou.';}
  pintarBusca();
}
async function buscarAgora(){
  if(BUSCA.inicio)return;
  const bt=$('#btnBuscar');if(bt){bt.disabled=true;bt.textContent='Pedindo…';}
  let res=null,status=0;
  try{
    const oab=($('#buscaOab')||{}).value||'',dias=Number(($('#buscaDias')||{}).value||3);
    gravarPref('oab',oab);gravarPref('dias',String(dias));BUSCA.limite=dias>=90?25:dias>=30?12:7;BUSCA.dias=dias;
    const{data,error}=await sb.functions.invoke('buscar-intimacoes',{body:{oab,dias}});
    if(error){status=error.context&&error.context.status||0;try{res=await error.context.json();}catch(_){res={erro:'rede'};}}
    else res=data;
  }catch(e){res={erro:'rede'};}
  if(res&&res.ok){
    BUSCA.inicio=res.jaRodando&&res.desde?new Date(res.desde).getTime():Date.now();BUSCA.erro=false;
    BUSCA.msg=res.jaRodando?'O robô já está buscando agora. As novas aparecem aqui sozinhas.':BUSCA.dias>=90?'Busca longa no DJEN: pode levar de 5 a 20 minutos. Pode sair desta tela; o resultado fica guardado.':BUSCA.dias>=30?'Buscando no DJEN. Leva de 2 a 8 minutos; os resultados aparecem aqui sozinhos.':'Buscando no DJEN. Leva de 1 a 3 minutos; as novas aparecem aqui sozinhas.';
    clearInterval(BUSCA.timer);BUSCA.timer=setInterval(async()=>{try{await carregarStatusRobo();}catch(_){}verBuscaTerminou();},15000);
    pintarBusca();return;
  }
  BUSCA.erro=true;
  const e=res&&res.erro;
  BUSCA.msg=e==='sem_token'||e==='token_invalido'?'O botão ainda não está ligado ao GitHub: falta o token (veja o passo a passo, "Botão Buscar agora").'
    :e==='sem_permissao_actions'?'O token do GitHub não tem permissão para rodar o robô: em Permissions › Actions, escolha "Read and write" e gere de novo.'
    :e==='workflow'?'O GitHub não aceitou o pedido do robô (arquivo robo.yml). Avise o suporte do sistema.'
    :e==='oab_invalida'?'OAB inválida. Confira o cadastro na Equipe (ex.: PA 012345).'
    :e==='sem_permissao'?'Seu login não tem permissão para buscar.'
    :e==='rede'&&!status?'Não foi possível pedir a busca (sem internet ou a função não está instalada).'
    :`O GitHub recusou o pedido agora${res&&res.status?' (código '+res.status+')':''}. Tente de novo em alguns minutos.`;
  pintarBusca();
}
const TOOLS_INT=VIEWS.intimacoes.tools,BIND_INT=VIEWS.intimacoes.bind;
VIEWS.intimacoes.tools=function(){
  const oabs=oabsDaEquipe(),oabSel=lerPref('oab',''),diasSel=Number(lerPref('dias','3'));
  const selOab=`<select class="input" id="buscaOab" aria-label="OAB"><option value="">Todas as OABs</option>${oabs.map(o=>`<option value="${esc(o.oab)}" ${o.oab===oabSel?'selected':''}>${esc(o.oab)} · ${esc(o.nome.split(' ')[0])}</option>`).join('')}</select>`;
  const selDias=`<select class="input" id="buscaDias" aria-label="Período">${PERIODOS.map(([d,l])=>`<option value="${d}" ${d===diasSel?'selected':''}>${l}</option>`).join('')}</select>`;
  return TOOLS_INT().replace('</div></div>',`</div><div class="busca"><div class="busca-sel">${selOab}${selDias}</div><button class="btn pri" id="btnBuscar" type="button">Buscar agora</button><span class="hint" id="buscaSt" aria-live="polite"></span></div></div>`);
};
VIEWS.intimacoes.bind=function(){if(BIND_INT)BIND_INT();$('#btnBuscar').onclick=buscarAgora;pintarBusca();};

/* ---------- aba "Processos da OAB": um cartão por processo achado no DJEN ---------- */
UI.procOab=UI.procOab||'';UI.procSo=UI.procSo??true;
function processosDaOab(){
  const grupos=new Map();
  for(const it of S.intimacoes){const n=digits(it.numero);if(n.length<15)continue;
    if(UI.procOab&&String(it.oab||'').replace(/\s+/g,' ').replace(/ 0+/,' ')!==UI.procOab)continue;
    const g=grupos.get(n)||{n,itens:[],oabs:new Set()};g.itens.push(it);if(it.oab)g.oabs.add(it.oab);grupos.set(n,g);}
  const porNum=new Map(S.processos.map(p=>[digits(p.numero),p]).filter(([k])=>k));
  let l=[...grupos.values()].map(g=>{g.itens.sort((a,b)=>String(b.data_disponibilizacao).localeCompare(String(a.data_disponibilizacao)));g.ult=g.itens[0];g.proc=porNum.get(g.n);return g;});
  const total=l.length,falta=l.filter(g=>!g.proc).length;
  if(UI.procSo)l=l.filter(g=>!g.proc);
  l.sort((a,b)=>(!!a.proc-!!b.proc)||String(b.ult.data_disponibilizacao).localeCompare(String(a.ult.data_disponibilizacao)));
  const oabs=oabsDaEquipe();
  const topo=`<div class="tools" style="margin-bottom:12px"><select class="input" id="procOab" aria-label="Filtrar por OAB" style="max-width:220px"><option value="">Todas as OABs</option>${oabs.map(o=>`<option value="${esc(o.oab)}" ${o.oab===UI.procOab?'selected':''}>${esc(o.oab)} · ${esc(o.nome.split(' ')[0])}</option>`).join('')}</select><label class="chk"><input type="checkbox" id="procSo" ${UI.procSo?'checked':''}>Só os que ainda não estão cadastrados</label></div>
    <p class="hint" style="margin:0 0 12px">${total} ${total===1?'processo aparece':'processos aparecem'} nas comunicações do DJEN já buscadas · <b>${falta}</b> ainda não ${falta===1?'está cadastrado':'estão cadastrados'} no sistema. Para trazer processos mais antigos, escolha "Último ano" ou "Últimos 2 anos" e toque em Buscar agora. O DJEN só mostra processos que tiveram alguma publicação no período.</p>`;
  if(!l.length)return topo+vazio(total?'Todos já estão cadastrados':'Nenhum processo ainda',total?'Desmarque o filtro para ver todos.':'Faça uma busca com um período maior para listar os processos da OAB.');
  const mostra=l.slice(0,300);
  return topo+`<div class="list">${mostra.map(g=>{const it=g.ult,area=guessArea(it);
    return `<div class="row a-${areaCls(area)}"><div class="main">
      <div class="chips">${g.proc?'<span class="chip c-ok">Já cadastrado</span>':'<span class="chip c-warn">Não cadastrado</span>'}${it.tribunal?`<span class="chip c-mute">${esc(it.tribunal)}</span>`:''}${area!=='Outro'?areaChip(area):''}</div>
      <div class="t mono">${esc(it.numero)}</div>
      <div class="m">${esc(it.classe||'')}${it.orgao?(it.classe?' · ':'')+esc(it.orgao):''}</div>
      ${it.partes?`<div class="m">Partes: ${esc(String(it.partes).slice(0,220))}</div>`:''}
      <div class="m">${g.itens.length} ${g.itens.length===1?'comunicação':'comunicações'} · última em ${fmtDS(it.data_disponibilizacao)}${g.oabs.size?' · OAB '+esc([...g.oabs].join(', ')):''}</div>
      <div class="acts">${g.proc?`<button class="btn sm" type="button" data-edit="processos" data-id="${esc(g.proc.id)}">Abrir processo</button>`:`<button class="btn sm pri" type="button" data-cadproc="${esc(g.n)}">Cadastrar processo</button>`}</div>
    </div></div>`;}).join('')}</div>${l.length>300?`<p class="hint">Mostrando 300 de ${l.length}. Use o filtro de OAB para ver os demais.</p>`:''}`;
}
function cadastrarProcessoDaOab(n){
  const its=S.intimacoes.filter(i=>digits(i.numero)===n).sort((a,b)=>String(b.data_disponibilizacao).localeCompare(String(a.data_disponibilizacao)));const it=its[0];if(!it)return;
  const resp=byId('equipe',it.responsavel_id),cli=byId('clientes',it.cliente_id);
  openForm('processos',null,{numero:it.numero||'',tribunal:it.tribunal||'',vara:it.orgao||'',area:guessArea(it),responsavelId:resp?resp.id:'',clienteId:cli?cli.id:''},async novoId=>{
    const antigas=its.filter(i=>i.status==='antiga').map(i=>i.hash);
    for(let k=0;k<antigas.length;k+=100){await sb.from('intimacoes').update({status:'cadastrada',processo_id:novoId}).in('hash',antigas.slice(k,k+100));}
    await carregarIntimacoes().catch(()=>{});body_();
    toast(its.some(i=>i.status==='nova')?'Processo cadastrado. As intimações novas dele continuam em "Novas" para você lançar o prazo.':'Processo cadastrado.');
  });
}
document.addEventListener('change',e=>{
  if(e.target.id==='procOab'){UI.procOab=e.target.value;body_();}
  if(e.target.id==='procSo'){UI.procSo=e.target.checked;body_();}
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-cadproc]');if(b){e.preventDefault();cadastrarProcessoDaOab(b.dataset.cadproc);}});
/* a lista de OABs depende da Equipe, que pode carregar depois da tela */
function preencherOabsBusca(){
  const s=$('#buscaOab');if(!s)return;const oabs=oabsDaEquipe();if(s.options.length-1===oabs.length)return;
  const atual=s.value||lerPref('oab','');
  s.innerHTML=`<option value="">Todas as OABs</option>${oabs.map(o=>`<option value="${esc(o.oab)}">${esc(o.oab)} · ${esc(o.nome.split(' ')[0])}</option>`).join('')}`;
  if([...s.options].some(o=>o.value===atual))s.value=atual;
}
const AFTER_INT=VIEWS.intimacoes.after;
VIEWS.intimacoes.after=function(){if(AFTER_INT)AFTER_INT();preencherOabsBusca();};
