'use strict';
/* =====================================================================
   Assistente de organização (grátis, sem IA): olha os dados do próprio
   sistema e mostra o que precisa de atenção e o que está desarrumado,
   com atalho para resolver. Também tem o "Como faço…?" com respostas
   prontas sobre o uso do sistema.
   ===================================================================== */
const semAc=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const soDig=s=>String(s||'').replace(/\D/g,'');
const orgCli=id=>{const c=byId('clientes',id);return c&&c.nome?c.nome:'';};
const rotProc=p=>[orgCli(p.clienteId)||'Sem cliente',p.numero||p.area||''].filter(Boolean).join(' · ');
const rotPrazo=p=>{const pr=byId('processos',p.processoId);return [pr?orgCli(pr.clienteId)||pr.numero:'',p.descricao||'Prazo'].filter(Boolean).join(' · ');};
const somaDias=(iso,n)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const plural=(n,um,varios)=>`${n} ${n===1?um:varios}`;

function itensOrganizacao(){
  const it=[],hoje=hojeStr(),em7=somaDias(hoje,7);
  const add=(grupo,st,t,d,ex,acao)=>it.push({grupo,st,t,d,ex:ex||[],acao});
  const irPrazos=(f)=>()=>{UI.prazoF=f||'abertos';UI.resp='';go('prazos');};

  /* ---- prazos ---- */
  const ab=S.prazos.filter(p=>!p.cumprido).map(p=>({p,i:prazoInfo(p)}));
  const venc=ab.filter(x=>x.i.r&&x.i.dd<0).sort((a,b)=>a.i.dd-b.i.dd);
  const logo=ab.filter(x=>x.i.r&&x.i.dd>=0&&x.i.dd<=1);
  const exP=l=>l.slice(0,5).map(x=>({edit:'prazos',id:x.p.id,label:`${rotPrazo(x.p)} — ${x.i.txt.toLowerCase()}`}));
  if(venc.length)add('hoje','bad','Prazos vencidos sem marcar como cumpridos',`${plural(venc.length,'prazo venceu','prazos venceram')} e ainda ${venc.length===1?'está aberto':'estão abertos'}. Se já foi feito, toque em "Cumprido"; se não, resolva primeiro.`,exP(venc),{rot:'Ver prazos',ir:irPrazos()});
  else add('hoje','ok','Prazos vencidos','Nenhum prazo vencido em aberto.');
  if(logo.length)add('hoje','bad','Prazos que vencem hoje ou amanhã',plural(logo.length,'prazo','prazos')+' para resolver agora.',exP(logo),{rot:'Ver prazos',ir:irPrazos()});
  const semData=ab.filter(x=>!x.i.r);
  if(semData.length)add('hoje','warn','Prazos sem data de vencimento',`${plural(semData.length,'prazo está','prazos estão')} sem data, então o robô não consegue avisar. Abra e informe a data e os dias.`,exP(semData),{rot:'Ver prazos',ir:irPrazos()});
  if(typeof precisaConferir==='function'){
    const nc=S.prazos.filter(p=>precisaConferir(p)&&!p.auto);
    if(nc.length)add('hoje','warn','Prazos sem a segunda conferência',`${plural(nc.length,'prazo aberto ainda não foi conferido','prazos abertos ainda não foram conferidos')} por outra pessoa. Quem não lançou toca em "Conferir".`,nc.slice(0,5).map(p=>({edit:'prazos',id:p.id,label:rotPrazo(p)})),{rot:'Ver prazos',ir:irPrazos()});
    else if(ab.length&&!S.prazos.some(precisaConferir))add('hoje','ok','Conferência de prazos','Todos os prazos abertos foram conferidos.');
  }
  const semResp=ab.filter(x=>!x.p.responsavelId);
  if(semResp.length)add('hoje','warn','Prazos sem responsável',`${plural(semResp.length,'prazo não tem','prazos não têm')} responsável: o aviso do robô não chega a ninguém em especial.`,exP(semResp),{rot:'Ver prazos',ir:irPrazos()});

  /* ---- intimações e agenda ---- */
  const novas=S.intimacoes.filter(i=>(i.status||'nova')==='nova');
  if(novas.length)add('hoje','warn','Intimações novas para analisar',`${plural(novas.length,'intimação nova espera','intimações novas esperam')} alguém olhar: cadastre o prazo ou toque em "Ignorar".`,[],{rot:'Abrir intimações',ir:()=>{UI.intF='nova';go('intimacoes');}});
  else add('hoje','ok','Intimações novas','Nenhuma intimação nova esperando.');
  const ev=(S.eventos||[]).filter(e=>!e.concluido&&e.data>=hoje&&e.data<=em7&&EV_AGENDA_ORG.includes(e.tipo)).sort((a,b)=>(a.data+(a.hora||'')).localeCompare(b.data+(b.hora||'')));
  const semLink=ev.filter(e=>/virtual|h[ií]brid/i.test(e.modalidade||'')&&!String(e.link||'').trim());
  if(semLink.length)add('hoje','warn','Audiências virtuais sem link da sala',`${plural(semLink.length,'compromisso virtual nos próximos 7 dias está','compromissos virtuais nos próximos 7 dias estão')} sem o link da sala.`,semLink.slice(0,5).map(e=>({edit:'eventos',id:e.id,label:`${e.tipo} · ${fmtD(e.data)}${e.hora?' '+e.hora:''}`})),{rot:'Abrir agenda',ir:()=>go('inicio')});
  if(ev.length)add('hoje','ok','Próximos 7 dias',`${plural(ev.length,'compromisso','compromissos')} na agenda: ${ev.slice(0,3).map(e=>`${e.tipo} em ${fmtD(e.data)}`).join('; ')}${ev.length>3?'…':''}.`);

  /* ---- tarefas ---- */
  const atras=S.tarefas.filter(t=>t.coluna!=='concluido'&&t.dataLimite&&t.dataLimite<hoje);
  if(atras.length)add('hoje','warn','Tarefas atrasadas',`${plural(atras.length,'tarefa passou','tarefas passaram')} da data limite e não ${atras.length===1?'está concluída':'estão concluídas'}.`,atras.slice(0,5).map(t=>({edit:'tarefas',id:t.id,label:`${t.titulo||'Tarefa'} — até ${fmtD(t.dataLimite)}`})),{rot:'Ver tarefas',ir:()=>go('tarefas')});

  /* ---- cadastros ---- */
  const exPr=l=>l.slice(0,5).map(p=>({edit:'processos',id:p.id,label:rotProc(p)}));
  const exCl=l=>l.slice(0,5).map(c=>({edit:'clientes',id:c.id,label:c.nome||'(sem nome)'}));
  const prSemCli=S.processos.filter(p=>!p.clienteId||!byId('clientes',p.clienteId));
  if(prSemCli.length)add('cad','warn','Processos sem cliente',`${plural(prSemCli.length,'processo não está ligado','processos não estão ligados')} a um cliente. Sem isso, o cliente não aparece nos avisos nem nos documentos.`,exPr(prSemCli),{rot:'Ver processos',ir:()=>go('processos')});
  const prSemResp=S.processos.filter(p=>!p.responsavelId);
  if(prSemResp.length)add('cad','warn','Processos sem responsável',`${plural(prSemResp.length,'processo não tem','processos não têm')} advogado responsável.`,exPr(prSemResp),{rot:'Ver processos',ir:()=>go('processos')});
  const prSemNum=S.processos.filter(p=>!soDig(p.numero));
  if(prSemNum.length)add('cad','warn','Processos sem número',`${plural(prSemNum.length,'processo está','processos estão')} sem número CNJ ou protocolo: o robô não acha as movimentações.`,exPr(prSemNum),{rot:'Ver processos',ir:()=>go('processos')});
  const porNum={};S.processos.forEach(p=>{const n=soDig(p.numero);if(n.length>=15)(porNum[n]=porNum[n]||[]).push(p);});
  const dupP=Object.values(porNum).filter(l=>l.length>1);
  if(dupP.length)add('cad','warn','Processos cadastrados duas vezes',`${plural(dupP.length,'número aparece','números aparecem')} em mais de um cadastro. Junte as informações em um e exclua o outro.`,dupP.flat().slice(0,6).map(p=>({edit:'processos',id:p.id,label:rotProc(p)})),{rot:'Ver processos',ir:()=>go('processos')});
  const porCpf={},porNome={};S.clientes.forEach(c=>{const d=soDig(c.cpf);if(d.length===11)(porCpf[d]=porCpf[d]||[]).push(c);const n=semAc(c.nome).replace(/\s+/g,' ');if(n.length>5)(porNome[n]=porNome[n]||[]).push(c);});
  const dupC=[...Object.values(porCpf),...Object.values(porNome)].filter(l=>l.length>1);
  const dupCIds=[...new Set(dupC.flat().map(c=>c.id))];
  if(dupCIds.length)add('cad','warn','Clientes cadastrados duas vezes',`Há clientes com o mesmo nome ou CPF em mais de um cadastro (${dupCIds.length} cadastros).`,exCl(dupCIds.map(id=>byId('clientes',id))),{rot:'Ver clientes',ir:()=>go('clientes')});
  const clSemTel=S.clientes.filter(c=>soDig(c.telefone).length<10);
  if(clSemTel.length)add('cad','warn','Clientes sem telefone',`${plural(clSemTel.length,'cliente está','clientes estão')} sem telefone com DDD: não dá para mandar mensagem pelo WhatsApp.`,exCl(clSemTel),{rot:'Ver clientes',ir:()=>go('clientes')});
  const clSemCpf=S.clientes.filter(c=>soDig(c.cpf).length!==11);
  if(clSemCpf.length)add('cad','warn','Clientes sem CPF',`${plural(clSemCpf.length,'cliente está','clientes estão')} sem CPF: a procuração e o contrato saem incompletos.`,exCl(clSemCpf),{rot:'Ver clientes',ir:()=>go('clientes')});
  const clSemProc=S.clientes.filter(c=>!S.processos.some(p=>p.clienteId===c.id));
  if(clSemProc.length)add('cad','warn','Clientes sem processo',`${plural(clSemProc.length,'cliente não tem','clientes não têm')} processo cadastrado. Se já tem processo ou pedido no INSS, cadastre; se foi só atendimento, pode deixar.`,exCl(clSemProc),{rot:'Ver clientes',ir:()=>go('clientes')});
  if(!it.some(x=>x.grupo==='cad'))add('cad','ok','Cadastros','Clientes e processos sem pendências.');

  /* ---- processos da OAB ainda não cadastrados ---- */
  const cad=new Set(S.processos.map(p=>soDig(p.numero)).filter(Boolean));
  const faltam=new Set(S.intimacoes.filter(i=>!['excluida','ignorada'].includes(i.status)&&!i.processo_id&&soDig(i.numero).length>=15&&!cad.has(soDig(i.numero))).map(i=>soDig(i.numero)));
  if(faltam.size)add('cad','warn','Processos da OAB ainda não cadastrados',`${plural(faltam.size,'processo encontrado','processos encontrados')} no DJEN pelas OABs da equipe ainda não ${faltam.size===1?'está cadastrado':'estão cadastrados'} no sistema. Cadastre os que são do escritório e exclua da lista os arquivados.`,[],{rot:'Abrir Processos da OAB',ir:()=>{UI.intF='processos';go('intimacoes');}});

  /* ---- equipe ---- */
  const sem=(S.robo&&S.robo.semCanal)||[];
  if(sem.length)add('cad','warn','Pessoas que não recebem avisos',`${sem.join(', ')} ${sem.length===1?'não tem':'não têm'} Telegram nem e-mail no cadastro da Equipe.`,[],{rot:'Abrir Equipe',ir:()=>go('equipe')});
  const advSemOab=S.equipe.filter(m=>m.ativo!==false&&/advogad/i.test(m.funcao||'')&&!soDig(m.oab));
  if(advSemOab.length)add('cad','warn','Advogados sem OAB no cadastro',`${advSemOab.map(m=>m.nome).join(', ')}: sem a OAB, o robô não busca as intimações.`,advSemOab.slice(0,5).map(m=>({edit:'equipe',id:m.id,label:m.nome})),{rot:'Abrir Equipe',ir:()=>go('equipe')});
  return it;
}
const EV_AGENDA_ORG=['Audiência','Perícia judicial','Perícia administrativa (INSS)','Plenário do Júri','Sessão de julgamento','Reunião com cliente','Atendimento','Diligência','Visita ao cliente preso'];

/* ---------- "Como faço…?" ---------- */
const COMO_FACO=[
  ['Cadastrar um cliente novo','Clientes › + Novo cliente › preencha nome, CPF, telefone e endereço › Salvar. Também dá para cadastrar de dentro do processo: no campo Cliente, escolha "＋ Cadastrar cliente novo…".'],
  ['Cadastrar um processo','Processos › + Novo processo › número CNJ (ou protocolo do INSS), cliente, área e responsável › Salvar. Com o número, use "Completar pelo CNJ" para trazer vara e classe.'],
  ['Lançar um prazo a partir de uma intimação','Intimações › na publicação, toque em "Cadastrar" (cria o processo, se faltar) ou em "Lançar prazo". A data vem do DJEN; você só informa os dias.'],
  ['Lançar um prazo à mão','Prazos › + Novo prazo › escolha o processo, o que deve ser feito, a data, os dias e o responsável › Salvar. O sistema calcula o vencimento com feriados e suspensões.'],
  ['Conferir um prazo (dupla conferência)','Outra pessoa, que não lançou o prazo, abre Prazos e toca em "Conferir" depois de checar a data e os dias na publicação.'],
  ['Marcar um prazo como cumprido','Prazos › no prazo, toque em "Cumprido". Se errar, toque em "Reabrir".'],
  ['Buscar intimações agora','Intimações › escolha a OAB e o período › Buscar agora. As novas aparecem sozinhas em 1 a 3 minutos (buscas longas levam mais).'],
  ['Ver todos os processos de uma OAB','Intimações › aba "Processos da OAB". Lá dá para filtrar por matéria, situação e audiência, cadastrar os que faltam e excluir da lista os arquivados.'],
  ['Gerar procuração ou contrato','Documentos › + Procuração ou + Contrato › escolha o cliente › gere o PDF. Os dados do escritório vêm de Ajustes.'],
  ['Pedir documentos ao cliente pelo celular','No cadastro do cliente › "Pedir documentos pelo link" › mande o link pelo WhatsApp. O que ele enviar aparece no cadastro para aceitar ou recusar.'],
  ['Dar ao cliente um link para acompanhar o processo','No cadastro do cliente › "Acompanhamento pelo cliente" › crie o link e mande. Ele vê a fase e os próximos compromissos, sem dados sigilosos.'],
  ['Guardar a senha gov.br de um cliente','No cadastro do cliente, campo da senha gov.br. É preciso destrancar o cofre com a senha do cofre (criada em Ajustes).'],
  ['Colocar os prazos na agenda do celular','Ajustes (ou Minha conta) › Agenda no celular › Copiar link › adicione no Google Agenda ou no iPhone, como explicado ali.'],
  ['Receber os avisos no Telegram, e-mail ou celular','Equipe › seu cadastro › Telegram: ID do chat e e-mail. Para o celular: Ajustes › Receber avisos neste aparelho.'],
  ['Liberar acesso para um colega','Acessos (só gestores) › digite o e-mail › escolha Equipe ou Gestor › Liberar acesso. Ele entra pelo "Primeiro acesso" com esse e-mail. Quem você não quer liberar: "Excluir solicitação".'],
  ['Trocar de usuário no mesmo aparelho','Toque em Sair no topo e entre com o outro e-mail. Os outros aparelhos continuam conectados.'],
  ['Recuperar algo excluído','Histórico (só gestores) › encontre o item › Restaurar.'],
  ['Emitir recibo de honorários ou cobrar por Pix','Financeiro › na parcela, use o recibo em PDF ou o Pix copia e cola (a chave Pix vem de Ajustes).'],
  ['Fazer cópia de segurança agora','GitHub › Actions › Robô do escritório › Run workflow › marque "Fazer a cópia de segurança agora". Ela também é feita sozinha toda segunda.'],
  ['Testar se os avisos estão chegando','GitHub › Actions › Robô do escritório › Run workflow › marque "Só mandar uma mensagem de teste".'],
  ['Perdi o celular com o código de duas etapas','O outro gestor entra no Supabase › Authentication › Users › abre o seu usuário › remove o fator. Você entra só com a senha e ativa de novo.'],
];
function buscarComoFaco(q){
  const t=semAc(q).split(/\s+/).filter(w=>w.length>2);
  if(!t.length)return COMO_FACO;
  return COMO_FACO.map(x=>({x,n:t.filter(w=>semAc(x[0]+' '+x[1]).includes(w)).length})).filter(o=>o.n).sort((a,b)=>b.n-a.n).map(o=>o.x);
}
const htmlComoFaco=l=>l.length?l.map(([p,r])=>`<details class="cf"><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join(''):'<span class="hint">Não achei nada com essas palavras. Tente outras, como "prazo", "cliente", "procuração".</span>';

/* ---------- página ---------- */
const ORG_ACOES={};
function htmlOrganizacao(){
  const it=itensOrganizacao(),ic={ok:'✓',warn:'!',bad:'✕'};
  const pend=it.filter(x=>x.st!=='ok'),ok=it.filter(x=>x.st==='ok');
  const urg=pend.filter(x=>x.st==='bad').length;
  Object.keys(ORG_ACOES).forEach(k=>delete ORG_ACOES[k]);
  const card=(x,k)=>{if(x.acao)ORG_ACOES[k]=x.acao.ir;
    return `<div class="sd ${x.st}"><span class="sdi" aria-hidden="true">${ic[x.st]}</span><div style="flex:1;min-width:0"><b>${esc(x.t)}</b><span>${esc(x.d)}</span>
      ${x.ex.length?`<div class="orgex">${x.ex.map(e=>`<a href="#" data-edit="${esc(e.edit)}" data-id="${esc(e.id)}">${esc(e.label)}</a>`).join('')}</div>`:''}
      ${x.acao?`<div class="acts" style="margin:6px 0 0"><button class="btn sm" type="button" data-orgir="${k}">${esc(x.acao.rot)}</button></div>`:''}</div></div>`;};
  const grupo=(g,tit)=>{const l=pend.filter(x=>x.grupo===g);return l.length?`<h3 class="orgh">${tit}</h3><div class="saude">${l.map((x,i)=>card(x,g+i)).join('')}</div>`:'';};
  const resumo=!pend.length?'<div class="sd ok"><span class="sdi">✓</span><div><b>Tudo em ordem</b><span>Nenhuma pendência encontrada agora.</span></div></div>'
    :`<p class="hint" style="margin:0 0 4px">${plural(pend.length,'coisa precisa','coisas precisam')} de atenção${urg?`, ${plural(urg,'urgente','urgentes')}`:''}. Toque nos nomes para abrir o cadastro.</p>`;
  return `${resumo}${grupo('hoje','Para hoje')}${grupo('cad','Arrumar cadastros')}
    ${ok.length?`<details class="cf" style="margin-top:10px"><summary>Em ordem (${ok.length})</summary><div class="saude">${ok.map(x=>card(x,'ok')).join('')}</div></details>`:''}`;
}
const _iaTools=VIEWS.assistente&&VIEWS.assistente.tools,_iaBody=VIEWS.assistente&&VIEWS.assistente.body,_iaAfter=VIEWS.assistente&&VIEWS.assistente.after;
VIEWS.assistente={t:'Assistente',
  tools(){return `<div class="sub">O assistente olha os dados do sistema e mostra o que precisa de atenção. É grátis e nada sai do sistema.</div>`;},
  body(){
    return `<div class="rcard" style="margin-bottom:12px"><h3 style="margin-top:0">Organizar o escritório</h3>${htmlOrganizacao()}</div>
      <div class="rcard" style="margin-bottom:12px"><h3 style="margin-top:0">Como faço…?</h3>
        <input class="input" id="cfBusca" type="search" placeholder="Ex.: lançar prazo, procuração, senha gov.br" aria-label="Buscar ajuda" autocomplete="off">
        <div id="cfLista" style="margin-top:8px">${htmlComoFaco(COMO_FACO)}</div></div>
      ${_iaBody?`<details class="cf"><summary>Pedir ajuda à IA (opcional)</summary><div style="margin-top:10px">${_iaBody()}</div></details>`:''}`;},
  after(){
    const b=$('#cfBusca');if(b)b.oninput=()=>{$('#cfLista').innerHTML=htmlComoFaco(buscarComoFaco(b.value));};
    if(_iaAfter)_iaAfter();
  }};
document.addEventListener('click',e=>{const b=e.target.closest('[data-orgir]');if(!b)return;const f=ORG_ACOES[b.dataset.orgir];if(f){e.preventDefault();f();}});

/* faixa no Início */
if(VIEWS.inicio&&VIEWS.inicio.body){
  const _ini=VIEWS.inicio.body;
  VIEWS.inicio.body=function(){
    const h=_ini.apply(this,arguments);let n=0,u=0;
    try{const it=itensOrganizacao().filter(x=>x.st!=='ok');n=it.length;u=it.filter(x=>x.st==='bad').length;}catch(_){}
    if(!n)return h;
    return `<a class="banner orgban" href="#assistente" style="display:block;text-decoration:none;margin-bottom:12px"><b>Assistente:</b> ${plural(n,'coisa precisa','coisas precisam')} de atenção${u?` (${plural(u,'urgente','urgentes')})`:''}. Toque para ver.</a>`+h;
  };
}

/* =====================================================================
   Lançamentos automáticos do robô (audiências e prazos lidos das
   intimações): ficam marcados para conferir
   ===================================================================== */
const prazoAutoDe=hash=>S.prazos.find(p=>p.intimacaoHash===hash);
const eventoAutoDe=hash=>(S.eventos||[]).find(e=>e.intimacaoHash===hash);

// prazo: selo "Lançado pelo robô" enquanto ninguém conferiu
if(typeof chipConferencia==='function'){
  const _chip=chipConferencia;
  chipConferencia=function(p){const c=_chip(p);return p.auto&&!p.cumprido&&!p.conferidoPor?'<span class="chip c-warn" title="O robô leu a intimação e lançou este prazo. Confira a data e os dias.">Lançado pelo robô</span>'+c:c;};
}
// compromisso: ao salvar, a pessoa conferiu
if(FORMS.eventos){
  const _bsEv=FORMS.eventos.beforeSave;
  FORMS.eventos.beforeSave=function(v,id){const r=_bsEv?_bsEv.call(this,v,id):undefined;if(r===false)return false;const old=id?byId('eventos',id):null;if(old&&old.conferir){v.conferir=false;v.conferidoPor=meuEmail();}return r;};
}
// intimação: mostra o que o robô já lançou
if(typeof rowIntimacao==='function'){
  const _rowInt=rowIntimacao;
  rowIntimacao=function(it){
    const h=_rowInt(it),p=prazoAutoDe(it.hash),e=eventoAutoDe(it.hash);if(!p&&!e)return h;
    const ch=(p?`<span class="chip ${p.conferidoPor||p.cumprido?'c-ok':'c-warn'}">Prazo lançado: ${esc(String(p.descricao||'').split(' · ')[0])}${p.vencimento?' · '+fmtD(p.vencimento):''}</span>`:'')
      +(e?`<span class="chip ${e.conferir?'c-warn':'c-ok'}">${esc(e.tipo||'Compromisso')} na agenda · ${fmtD(e.data)}</span>`:'');
    return h.replace('<div class="chips">','<div class="chips">'+ch);
  };
}
// "Cadastrar" numa intimação que já tem prazo lançado pelo robô: abre esse prazo para conferir
if(typeof cadastrarIntimacao==='function'){
  const _cadInt=cadastrarIntimacao;
  cadastrarIntimacao=function(hash){
    const p=prazoAutoDe(hash);if(!p)return _cadInt(hash);
    const it=S.intimacoes.find(x=>x.hash===hash)||{};
    const fim=async()=>{await mudarIntimacao(hash,{status:'cadastrada',processo_id:p.processoId||null});};
    const abrir=()=>{openForm('prazos',p.id,null,async()=>{await fim();toast('Prazo salvo e intimação cadastrada.');});setTimeout(()=>toast('O robô já lançou este prazo. Confira a data e os dias, salve e depois toque em "Conferir".',6000),300);};
    if(p.processoId&&byId('processos',p.processoId))return abrir();
    const existente=S.processos.find(x=>digits(x.numero)&&digits(x.numero)===digits(it.numero||p.numero));
    const ligar=async pid=>{const novo=await salvar('prazos',p.id,{...p,processoId:pid,descricao:String(p.descricao||'').split(' · ')[0]});if(novo)Object.assign(p,{processoId:pid});abrir();};
    if(existente)return ligar(existente.id);
    const resp=byId('equipe',it.responsavel_id),cli=byId('clientes',it.cliente_id);
    openForm('processos',null,{numero:it.numero||p.numero||'',tribunal:it.tribunal||'',vara:it.orgao||'',area:guessArea(it),responsavelId:resp?resp.id:'',clienteId:cli?cli.id:''},
      novoId=>{toast('Processo salvo. Agora confira o prazo que o robô lançou.');setTimeout(()=>ligar(novoId),150);});
  };
}
// Assistente: compromissos lançados pelo robô para conferir
{
  const _itOrg=itensOrganizacao;
  itensOrganizacao=function(){
    const it=_itOrg(),hoje=hojeStr();
    const ev=(S.eventos||[]).filter(e=>e.conferir&&!e.concluido&&(e.data||'')>=hoje).sort((a,b)=>(a.data||'').localeCompare(b.data||''));
    if(ev.length)it.unshift({grupo:'hoje',st:'warn',t:'Audiências e perícias lançadas pelo robô',d:`${plural(ev.length,'compromisso foi cadastrado','compromissos foram cadastrados')} automaticamente a partir das intimações. Abra, confira data, hora e link, e salve.`,ex:ev.slice(0,5).map(e=>({edit:'eventos',id:e.id,label:`${e.tipo} · ${fmtD(e.data)}${e.hora?' '+e.hora:''} · ${String(e.titulo||'').split(' — ')[1]||''}`})),acao:null});
    const pa=S.prazos.filter(p=>p.auto&&!p.cumprido&&!p.conferidoPor);
    if(pa.length)it.unshift({grupo:'hoje',st:'warn',t:'Prazos lançados pelo robô',d:`${plural(pa.length,'prazo foi lançado','prazos foram lançados')} automaticamente. Confira se é do escritório, a data e os dias, e toque em "Conferir".`,ex:pa.slice(0,5).map(p=>({edit:'prazos',id:p.id,label:`${p.descricao||'Prazo'}${p.vencimento?' — vence '+fmtD(p.vencimento):''}`})),acao:{rot:'Ver prazos',ir:()=>{UI.prazoF='abertos';UI.resp='';go('prazos');}}});
    return it;
  };
}
