'use strict';
/* =====================================================================
   Aba "Processos da OAB": um cartão por processo achado no DJEN,
   organizado por matéria, situação (andamento, sentença, arquivado),
   audiência e tempo de processo, com exclusão dos arquivados da lista
   ===================================================================== */
const CART={materia:'',situacao:'',audiencia:'',tempo:'',cadastro:'nao',agrupar:'materia',ordem:'recentes',oab:'',excluidos:false};
try{Object.assign(CART,JSON.parse(localStorage.getItem('carteira_filtros')||'{}'));}catch(_){}
const guardarCart=()=>{try{localStorage.setItem('carteira_filtros',JSON.stringify(CART));}catch(_){}};

const MATERIAS=['Criminal','Previdenciário','Trabalhista','Família','Cível','Fazenda Pública','Outros'];
const SITUACOES=[['andamento','Em andamento'],['sentenca','Sentença ou recurso'],['arquivado','Arquivado ou encerrado']];
const AUDIENCIAS=[['marcada','Audiência marcada'],['teve','Já teve audiência'],['sem','Sem audiência']];
const TEMPOS=[['1','Até 1 ano'],['3','1 a 3 anos'],['5','3 a 5 anos'],['mais','Mais de 5 anos']];
const RX_ARQ=/arquivamento definitivo|determino o arquivamento|arquivem-se|arquive-se|ao arquivo|autos arquivados|processo arquivado|baixa definitiva|baixem os autos/i;
// sentenças costumam dizer "após o trânsito em julgado, arquive-se": aí ainda não arquivou
const RX_DOC_SENT=/senten|ac[óo]rd|ementa/i;
const RX_DESARQ=/desarquiv/i;
const RX_SENT=/julgo (im)?procedente|julgo parcialmente|extingo o processo|recurso inominado|contrarraz|recurso de apela[çc][ãa]o|recurso ordin[áa]rio/i;
const RX_AUD=/audi[êe]ncia/i;

const textoDe=it=>[it.tipo,it.tipo_documento,it.texto].filter(Boolean).join(' ');
function materiaDe(it){
  const a=guessArea(it);if(a!=='Outro')return a;
  const s=[it.orgao,it.classe,it.tribunal].join(' ').toLowerCase();
  if(/fam[íi]lia|alimentos|div[óo]rcio|guarda|invent[áa]rio|sucess[õo]es|uni[ãa]o est[áa]vel/.test(s))return'Família';
  if(/fazenda|execu[çc][ãa]o fiscal|mandado de seguran|improbidade/.test(s))return'Fazenda Pública';
  if(/c[íi]vel|consumidor|juizado especial|procedimento comum|cumprimento de senten|execu[çc][ãa]o|monit[óo]ria|despejo|indeniza/.test(s))return'Cível';
  return'Outros';
}
// datas dd/mm/aaaa que aparecem depois da palavra "audiência"
function dataAudiencia(t){
  const m=String(t).match(/audi[êe]ncia[\s\S]{0,220}?(\d{2})\/(\d{2})\/(\d{4})/i);
  return m?`${m[3]}-${m[2]}-${m[1]}`:'';
}
// o banco já calcula f_arq, f_sent, f_aud e aud_data; sem eles (banco antigo ou demonstração) lê o texto
const ehArq=it=>it.f_arq!==undefined?!!it.f_arq:(!RX_DOC_SENT.test(it.tipo_documento||'')&&RX_ARQ.test(it.texto||'')&&!RX_DESARQ.test(it.texto||''));
const ehSent=it=>it.f_sent!==undefined?!!it.f_sent:(RX_DOC_SENT.test(it.tipo_documento||'')||RX_SENT.test(it.texto||''));
const temAud=it=>it.f_aud!==undefined?!!it.f_aud:RX_AUD.test(textoDe(it));
function analisar(g){
  const its=g.itens;const hoje=hojeStr();
  // situação: olha as publicações mais recentes primeiro
  let situacao='andamento';
  if(g.proc&&/arquiv|encerrad|baixad|extint/i.test(faseDe(g.proc)))situacao='arquivado';
  else if(its.slice(0,2).some(ehArq))situacao='arquivado';
  else if(its.slice(0,5).some(ehSent))situacao='sentenca';
  // audiência
  let audiencia='sem',audData='';
  for(const it of its){if(!temAud(it))continue;
    const d=it.f_aud!==undefined?(it.aud_data||''):dataAudiencia(textoDe(it));if(d&&d>=hoje){audiencia='marcada';audData=audData&&audData<d?audData:d;}
    else if(audiencia!=='marcada')audiencia='teve';}
  // tempo de processo pelo ano do número CNJ (NNNNNNN-DD.AAAA...)
  const ano=g.n.length===20?Number(g.n.slice(9,13)):0;const anoAtual=new Date().getFullYear();
  const idade=ano&&ano<=anoAtual&&ano>1990?anoAtual-ano:null;
  const tempo=idade===null?'':idade<=1?'1':idade<=3?'3':idade<=5?'5':'mais';
  const ult=g.ult.data_disponibilizacao||'';
  const parado=ult?Math.floor((new Date(hoje)-new Date(ult))/864e5):0;
  return{situacao,audiencia,audData,ano,idade,tempo,parado,materia:materiaDe(g.ult)};
}
function gruposCarteira(){
  const grupos=new Map();
  for(const it of S.intimacoes){const n=digits(it.numero);if(n.length<15)continue;
    const g=grupos.get(n)||{n,itens:[],oabs:new Set(),excluido:true};g.itens.push(it);if(it.oab)g.oabs.add(String(it.oab).replace(/\s+/g,' ').replace(/ 0+/,' '));
    if(it.status!=='excluida')g.excluido=false;grupos.set(n,g);}
  const porNum=new Map(S.processos.map(p=>[digits(p.numero),p]).filter(([k])=>k));
  return[...grupos.values()].map(g=>{
    g.itens.sort((a,b)=>String(b.data_disponibilizacao).localeCompare(String(a.data_disponibilizacao)));
    if(!g.excluido)g.itens=g.itens.filter(i=>i.status!=='excluida');
    g.ult=g.itens[0];g.proc=porNum.get(g.n);Object.assign(g,analisar(g));return g;});
}
const rotulo=(lista,v)=>(lista.find(x=>x[0]===v)||[,''])[1];
const tempoTxt=d=>d<1?'hoje':d<31?`há ${d} ${d===1?'dia':'dias'}`:d<365?`há ${Math.round(d/30)} ${Math.round(d/30)===1?'mês':'meses'}`:`há ${(d/365).toFixed(1).replace('.0','').replace('.',',')} ${d<730?'ano':'anos'}`;

function processosDaOab(){
  const todos=gruposCarteira();
  const base=todos.filter(g=>CART.excluidos?g.excluido:!g.excluido).filter(g=>!CART.oab||g.oabs.has(CART.oab));
  const conta=(f)=>base.filter(f).length;
  let l=base.filter(g=>(!CART.materia||g.materia===CART.materia)&&(!CART.situacao||g.situacao===CART.situacao)&&(!CART.audiencia||g.audiencia===CART.audiencia)&&(!CART.tempo||g.tempo===CART.tempo)
    &&(CART.cadastro==='todos'||(CART.cadastro==='nao'?!g.proc:!!g.proc)));
  const ord={recentes:(a,b)=>String(b.ult.data_disponibilizacao).localeCompare(String(a.ult.data_disponibilizacao)),
    antigos:(a,b)=>(a.ano||9999)-(b.ano||9999),parados:(a,b)=>b.parado-a.parado,
    audiencia:(a,b)=>(a.audData||'9999').localeCompare(b.audData||'9999')}[CART.ordem]||(()=>0);
  l.sort(ord);
  const oabs=oabsDaEquipe();
  const sel=(id,lista,val,todosTxt)=>`<select class="input" id="${id}" aria-label="${esc(todosTxt)}"><option value="">${esc(todosTxt)}</option>${lista.map(([v,t])=>`<option value="${esc(v)}" ${v===val?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
  const arquivadosVisiveis=l.filter(g=>g.situacao==='arquivado'&&!g.excluido);
  const resumo=`<div class="cart-resumo">${SITUACOES.map(([v,t])=>`<button type="button" class="cart-chip ${CART.situacao===v?'on':''}" data-cartsit="${v}"><b>${conta(g=>g.situacao===v)}</b>${esc(t)}</button>`).join('')}${AUDIENCIAS.slice(0,1).map(([v,t])=>`<button type="button" class="cart-chip ${CART.audiencia===v?'on':''}" data-cartaud="${v}"><b>${conta(g=>g.audiencia===v)}</b>${esc(t)}</button>`).join('')}</div>`;
  const ativos=['materia','situacao','audiencia','tempo','oab'].filter(k=>CART[k]).length;
  const filtros=`<details class="cart-mais" ${UI.cartAberto??(innerWidth>620)?'open':''}><summary>Filtros, agrupamento e ordem${ativos?` · ${ativos} ${ativos===1?'filtro ativo':'filtros ativos'}`:''}</summary><div class="cart-filtros">
    ${sel('cartMat',MATERIAS.map(m=>[m,`${m} (${conta(g=>g.materia===m)})`]).filter(([m])=>conta(g=>g.materia===m)),CART.materia,'Todas as matérias')}
    ${sel('cartSit',SITUACOES,CART.situacao,'Situação: todas')}
    ${sel('cartAud',AUDIENCIAS,CART.audiencia,'Audiência: todas')}
    ${sel('cartTempo',TEMPOS,CART.tempo,'Tempo: qualquer')}
    <select class="input" id="cartCad" aria-label="Cadastro"><option value="nao" ${CART.cadastro==='nao'?'selected':''}>Ainda não cadastrados</option><option value="sim" ${CART.cadastro==='sim'?'selected':''}>Já cadastrados</option><option value="todos" ${CART.cadastro==='todos'?'selected':''}>Cadastro: todos</option></select>
    ${oabs.length>1?sel('cartOab',oabs.map(o=>[o.oab,`${o.oab} · ${o.nome.split(' ')[0]}`]),CART.oab,'Todas as OABs'):''}
    <select class="input" id="cartAgr" aria-label="Agrupar"><option value="materia" ${CART.agrupar==='materia'?'selected':''}>Agrupar por matéria</option><option value="situacao" ${CART.agrupar==='situacao'?'selected':''}>Agrupar por situação</option><option value="tempo" ${CART.agrupar==='tempo'?'selected':''}>Agrupar por tempo de processo</option><option value="audiencia" ${CART.agrupar==='audiencia'?'selected':''}>Agrupar por audiência</option><option value="" ${!CART.agrupar?'selected':''}>Sem agrupar</option></select>
    <select class="input" id="cartOrd" aria-label="Ordem"><option value="recentes" ${CART.ordem==='recentes'?'selected':''}>Publicação mais recente</option><option value="antigos" ${CART.ordem==='antigos'?'selected':''}>Processos mais antigos</option><option value="parados" ${CART.ordem==='parados'?'selected':''}>Mais tempo sem publicação</option><option value="audiencia" ${CART.ordem==='audiencia'?'selected':''}>Próxima audiência</option></select>
  </div></details>
  <div class="cart-acoes"><span class="hint">${l.length} de ${base.length} ${base.length===1?'processo':'processos'}${CART.excluidos?' excluídos da lista':''}. A matéria, a situação e a audiência são lidas do texto das publicações: confira antes de decidir.</span>
    ${(CART.materia||CART.situacao||CART.audiencia||CART.tempo||CART.oab)?'<button class="btn sm ghost" type="button" id="cartLimpar">Limpar filtros</button>':''}
    ${!CART.excluidos&&arquivadosVisiveis.length?`<button class="btn sm danger" type="button" id="cartExclArq">${arquivadosVisiveis.length===1?'Excluir da lista o arquivado':`Excluir da lista os ${arquivadosVisiveis.length} arquivados`}</button>`:''}
    <label class="chk"><input type="checkbox" id="cartExcl" ${CART.excluidos?'checked':''}>Ver excluídos (${todos.filter(g=>g.excluido).length})</label></div>`;
  const topo=`<div class="carteira">${resumo}${filtros}`;
  if(!base.length)return topo+vazio(CART.excluidos?'Nenhum processo excluído':'Nenhum processo ainda',CART.excluidos?'Os processos que você excluir da lista aparecem aqui e podem voltar.':'Faça uma busca de "Último ano" ou "Últimos 2 anos" para listar os processos da OAB.')+'</div>';
  if(!l.length)return topo+vazio('Nenhum processo com esses filtros','Tente outra combinação ou toque em "Limpar filtros".')+'</div>';
  const chave={materia:g=>g.materia,situacao:g=>rotulo(SITUACOES,g.situacao),tempo:g=>rotulo(TEMPOS,g.tempo)||'Número sem ano',audiencia:g=>rotulo(AUDIENCIAS,g.audiencia)}[CART.agrupar];
  const ordemSec={materia:MATERIAS,situacao:SITUACOES.map(x=>x[1]),tempo:[...TEMPOS.map(x=>x[1]),'Número sem ano'],audiencia:AUDIENCIAS.map(x=>x[1])}[CART.agrupar]||[];
  const mostra=l.slice(0,400);
  let corpo;
  if(chave){
    const secs=new Map();mostra.forEach(g=>{const k=chave(g);if(!secs.has(k))secs.set(k,[]);secs.get(k).push(g);});
    corpo=[...secs.entries()].sort((a,b)=>ordemSec.indexOf(a[0])-ordemSec.indexOf(b[0])).map(([k,gs])=>`<details class="cart-sec" open><summary><span>${esc(k)}</span><span class="n">${gs.length}</span></summary><div class="list">${gs.map(cartaoProcesso).join('')}</div></details>`).join('');
  }else corpo=`<div class="list">${mostra.map(cartaoProcesso).join('')}</div>`;
  return topo+corpo+(l.length>400?`<p class="hint">Mostrando 400 de ${l.length}. Use os filtros para ver os demais.</p>`:'')+'</div>';
}
function cartaoProcesso(g){
  const it=g.ult;const area=g.materia;const cls=area==='Família'||area==='Cível'||area==='Fazenda Pública'||area==='Outros'?'adm':areaCls(area);
  const sitChip=g.situacao==='arquivado'?'<span class="chip c-mute">Arquivado</span>':g.situacao==='sentenca'?'<span class="chip c-warn">Sentença ou recurso</span>':'<span class="chip c-ok">Em andamento</span>';
  const audChip=g.audiencia==='marcada'?`<span class="chip c-warn">Audiência ${g.audData?fmtD(g.audData):'marcada'}</span>`:g.audiencia==='teve'?'<span class="chip c-mute">Já teve audiência</span>':'';
  return `<div class="row a-${cls}"><div class="main">
    <div class="chips">${g.proc?'<span class="chip c-ok">Já cadastrado</span>':''}${sitChip}${audChip}<span class="chip c-mute">${esc(area)}</span>${it.tribunal?`<span class="chip c-mute">${esc(it.tribunal)}</span>`:''}</div>
    <div class="t mono">${esc(it.numero)}</div>
    <div class="m">${esc(it.classe||'')}${it.orgao?(it.classe?' · ':'')+esc(it.orgao):''}</div>
    ${it.partes?`<div class="m">Partes: ${esc(String(it.partes).slice(0,200))}</div>`:''}
    <div class="m">${g.ano?`Processo de ${g.ano}${g.idade!==null?` (${g.idade<1?'menos de 1 ano':g.idade+(g.idade===1?' ano':' anos')})`:''} · `:''}${g.itens.length} ${g.itens.length===1?'publicação':'publicações'} · última ${tempoTxt(g.parado)} (${fmtD(it.data_disponibilizacao)})${it.tipo_documento?' · '+esc(it.tipo_documento):''}</div>
    <div class="acts">${g.excluido?`<button class="btn sm" type="button" data-cartrest="${esc(g.n)}">Voltar para a lista</button>`
      :`${g.proc?`<button class="btn sm" type="button" data-edit="processos" data-id="${esc(g.proc.id)}">Abrir processo</button>`:`<button class="btn sm pri" type="button" data-cadproc="${esc(g.n)}">Cadastrar processo</button>`}<button class="btn sm ghost" type="button" data-cartver="${esc(g.n)}">Ver publicações</button><button class="btn sm ghost" type="button" data-cartexcl="${esc(g.n)}">Excluir da lista</button>`}</div>
  </div></div>`;
}

/* ---------- ações ---------- */
async function marcarProcessos(nums,excluir){
  const set=new Set(nums);const its=S.intimacoes.filter(i=>set.has(digits(i.numero)));
  const corte=new Date(Date.now()-7*864e5).toISOString().slice(0,10);
  const grupos=excluir?[['excluida',its.filter(i=>i.status!=='excluida')]]
    :[['cadastrada',its.filter(i=>i.status==='excluida'&&i.processo_id)],['antiga',its.filter(i=>i.status==='excluida'&&!i.processo_id&&String(i.data_disponibilizacao)<corte)],['nova',its.filter(i=>i.status==='excluida'&&!i.processo_id&&String(i.data_disponibilizacao)>=corte)]];
  for(const[st,l] of grupos){const hs=l.map(i=>i.hash);
    for(let k=0;k<hs.length;k+=100){const{error}=await sb.from('intimacoes').update({status:st}).in('hash',hs.slice(k,k+100));if(error){erroGravar(error);return false;}}
    l.forEach(i=>i.status=st);}
  return true;
}
async function verPublicacoes(n){
  if(S.intLeve&&typeof carregarTextos==='function'){const hs=S.intimacoes.filter(i=>digits(i.numero)===n).map(i=>i.hash);toast('Carregando publicações…');await carregarTextos(hs);}
  const its=S.intimacoes.filter(i=>digits(i.numero)===n).sort((a,b)=>String(b.data_disponibilizacao).localeCompare(String(a.data_disponibilizacao)));if(!its.length)return;
  const sh=$('#sheet');SH={col:'__pubs'};
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="pbT" style="max-width:820px"><div class="ph"><h3 id="pbT" class="mono" style="font-size:16px">${esc(its[0].numero)}</h3><button class="btn ghost sm" id="pbX" type="button">Fechar</button></div>
    <div class="pb" style="display:block"><div class="pub-l">${its.map(i=>`<div class="pub-i"><div class="pub-d">${fmtD(i.data_disponibilizacao)}</div><div><b>${esc(i.tipo_documento||i.tipo||'Publicação')}</b>${i.orgao?`<div class="m">${esc(i.orgao)}</div>`:''}<div class="pub-txt">${esc(String(i.texto||'(sem texto)').slice(0,1500))}${String(i.texto||'').length>1500?'…':''}</div>${i.link?`<a class="btn sm ghost" href="${esc(i.link)}" target="_blank" rel="noopener">Abrir no DJEN</a>`:''}</div></div>`).join('')}</div></div></div>`;
  sh.hidden=false;$('#pbX').onclick=closeForm;
}
function cadastrarProcessoDaOab(n){
  const its=S.intimacoes.filter(i=>digits(i.numero)===n).sort((a,b)=>String(b.data_disponibilizacao).localeCompare(String(a.data_disponibilizacao)));const it=its[0];if(!it)return;
  const resp=byId('equipe',it.responsavel_id),cli=byId('clientes',it.cliente_id);
  const area=guessArea(it);
  openForm('processos',null,{numero:it.numero||'',tribunal:it.tribunal||'',vara:it.orgao||'',area:area==='Outro'?'Outro':area,responsavelId:resp?resp.id:'',clienteId:cli?cli.id:''},async novoId=>{
    const antigas=its.filter(i=>i.status==='antiga').map(i=>i.hash);
    for(let k=0;k<antigas.length;k+=100){await sb.from('intimacoes').update({status:'cadastrada',processo_id:novoId}).in('hash',antigas.slice(k,k+100));}
    await carregarIntimacoes().catch(()=>{});body_();
    toast(its.some(i=>i.status==='nova')?'Processo cadastrado. As intimações novas dele continuam em "Novas" para você lançar o prazo.':'Processo cadastrado.');
  });
}
const FILTRO_ID={cartMat:'materia',cartSit:'situacao',cartAud:'audiencia',cartTempo:'tempo',cartCad:'cadastro',cartOab:'oab',cartAgr:'agrupar',cartOrd:'ordem'};
document.addEventListener('change',e=>{
  const k=FILTRO_ID[e.target.id];if(k){CART[k]=e.target.value;guardarCart();body_();return;}
  if(e.target.id==='cartExcl'){CART.excluidos=e.target.checked;guardarCart();body_();}
});
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-cadproc],[data-cartexcl],[data-cartrest],[data-cartver],[data-cartsit],[data-cartaud],#cartLimpar,#cartExclArq');if(!t)return;
  e.preventDefault();
  if(t.dataset.cadproc)return cadastrarProcessoDaOab(t.dataset.cadproc);
  if(t.dataset.cartver)return verPublicacoes(t.dataset.cartver);
  if(t.dataset.cartsit){CART.situacao=CART.situacao===t.dataset.cartsit?'':t.dataset.cartsit;guardarCart();return body_();}
  if(t.dataset.cartaud){CART.audiencia=CART.audiencia===t.dataset.cartaud?'':t.dataset.cartaud;guardarCart();return body_();}
  if(t.id==='cartLimpar'){Object.assign(CART,{materia:'',situacao:'',audiencia:'',tempo:'',oab:''});guardarCart();return body_();}
  if(t.dataset.cartexcl){
    if(!t.dataset.armed){t.dataset.armed='1';t.textContent='Toque de novo para excluir';return;}
    if(await marcarProcessos([t.dataset.cartexcl],true)){body_();toast('Processo excluído da lista. Ele fica em "Ver excluídos" e pode voltar.');}
    return;
  }
  if(t.dataset.cartrest){if(await marcarProcessos([t.dataset.cartrest],false)){body_();toast('Processo voltou para a lista.');}return;}
  if(t.id==='cartExclArq'){
    const nums=gruposCarteira().filter(g=>!g.excluido&&g.situacao==='arquivado'&&(!CART.materia||g.materia===CART.materia)&&(!CART.audiencia||g.audiencia===CART.audiencia)&&(!CART.tempo||g.tempo===CART.tempo)&&(!CART.oab||g.oabs.has(CART.oab))&&(CART.cadastro==='todos'||(CART.cadastro==='nao'?!g.proc:!!g.proc))).map(g=>g.n);
    if(!t.dataset.armed){t.dataset.armed='1';t.textContent=`Confirmar: excluir ${nums.length} da lista`;return;}
    t.disabled=true;if(await marcarProcessos(nums,true)){body_();toast(`${nums.length} ${nums.length===1?'processo arquivado excluído':'processos arquivados excluídos'} da lista. Ficam em "Ver excluídos".`);}
  }
});
document.addEventListener('toggle',e=>{if(e.target.classList&&e.target.classList.contains('cart-mais'))UI.cartAberto=e.target.open;},true);
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-inttxt]');if(!b)return;e.preventDefault();b.disabled=true;b.textContent='Carregando…';
  if(await carregarTextos([b.dataset.inttxt]))body_();else{b.disabled=false;b.textContent='Não carregou. Tocar de novo';}
});
