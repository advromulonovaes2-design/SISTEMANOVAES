'use strict';
/* =====================================================================
   Saúde do sistema (só gestores): o robô está rodando? o DJEN responde?
   os avisos têm para onde ir? há cópia de segurança? duas etapas?
   ===================================================================== */
const horasDesde=iso=>iso?(Date.now()-new Date(iso).getTime())/3600e3:Infinity;
function itensSaude(){
  const r=S.robo||{},c=S.config||{},it=[];
  const add=(st,t,d)=>it.push({st,t,d});
  // robô automático: dias úteis às 7h e 16h; no fim de semana não roda
  const lim=[0,1].includes(new Date().getDay())?80:30;
  const hr=horasDesde(r.ultimaRotina);
  if(!r.ultimaRotina)add('warn','Robô automático','Ainda não rodou sozinho. Ele roda de segunda a sexta às 7h e às 16h; confira GitHub › Actions se passar desses horários.');
  else if(hr>lim)add('bad','Robô automático',`Não roda desde ${fmtDT(r.ultimaRotina)}. Abra GitHub › Actions: o GitHub pausa o robô depois de 60 dias sem mudanças no repositório, e é só reativar.`);
  else add('ok','Robô automático',`Rodou ${quandoFoi(r.ultimaRotina)}.`);
  if(r.djen==='falhou')add(Number(r.falhasSeguidas)>=2?'bad':'warn','Acesso ao DJEN',`A última consulta falhou${r.falhasSeguidas>1?` (${r.falhasSeguidas} vezes seguidas)`:''}. Confira as intimações em comunica.pje.jus.br até voltar.`);
  else if(r.djen==='sem OAB cadastrada')add('warn','Acesso ao DJEN','Nenhuma OAB cadastrada na Equipe.');
  else if(r.djen)add('ok','Acesso ao DJEN',`Respondendo${r.consultas?` (${r.consultas} ${r.consultas===1?'consulta':'consultas'} na última busca)`:''}.`);
  const k=r.canais||{};
  const canais=[k.telegram?'Telegram':'',k.gmail?'E-mail':'',k.push?'Celular':''].filter(Boolean);
  if(!r.canais)add('warn','Avisos de prazos','O robô ainda não informou os canais. Aparece depois da próxima rodada.');
  else if(!canais.length)add('bad','Avisos de prazos','Nenhum canal ligado: os avisos de prazo não chegam a ninguém. Configure Telegram, Gmail ou notificação no celular (passo a passo, itens 6, 7 e 12).');
  else add((r.semCanal||[]).length?'warn':'ok','Avisos de prazos',`Ligados: ${canais.join(', ')}.${(r.semCanal||[]).length?` Sem nenhum canal: ${r.semCanal.join(', ')}.`:''}`);
  if(!r.ultimoBackup)add('warn','Cópia de segurança','Ainda não foi feita. O robô faz toda segunda de manhã; dá para fazer agora em GitHub › Actions › Run workflow › "Fazer a cópia de segurança agora".');
  else if(horasDesde(r.ultimoBackup)>8*24)add('warn','Cópia de segurança',`A última é de ${fmtDT(r.ultimoBackup)}.`);
  else add('ok','Cópia de segurança',`Última em ${fmtDT(r.ultimoBackup)}${r.backupTamanho?' ('+r.backupTamanho+')':''}${k.gmail?', também enviada por e-mail':''}.`);
  const lib=(S.acessos||[]).filter(a=>a.liberado);
  if(lib.length){const sem=lib.filter(a=>!a.duas_etapas),gs=sem.filter(a=>a.gestor);
    add(gs.length?'bad':sem.length?'warn':'ok','Verificação em duas etapas',sem.length?`${lib.length-sem.length} de ${lib.length} ativaram. Faltam: ${sem.map(a=>nomeDe(a.email).split(' ')[0]).join(', ')}.`:`Todos os ${lib.length} ativaram${c.mfaObrigatorio?' e o escritório exige':''}.`);}
  const falta=[['nome','nome'],['endereco','endereço'],['cidade','cidade'],['chavePix','chave Pix']].filter(([x])=>!String(c[x]||'').trim()).map(x=>x[1]);
  add(falta.length?'warn':'ok','Dados do escritório',falta.length?`Faltam: ${falta.join(', ')}. Eles vão na procuração, no contrato e no Pix.`:'Preenchidos.');
  add(typeof cofreCriado==='function'&&cofreCriado()?'ok':'warn','Cofre das senhas gov.br',typeof cofreCriado==='function'&&cofreCriado()?'Criado.':'Ainda não criado (logo abaixo, em Cofre de senhas gov.br).');
  const nc=S.prazos.filter(p=>typeof precisaConferir==='function'&&precisaConferir(p)).length;
  add(nc?'warn':'ok','Conferência de prazos',nc?`${nc} ${nc===1?'prazo aberto ainda não foi conferido':'prazos abertos ainda não foram conferidos'} por uma segunda pessoa.`:'Todos os prazos abertos foram conferidos.');
  const pend=(S.acessos||[]).filter(a=>!a.liberado).length;
  if(pend)add('warn','Contas aguardando liberação',`${pend} ${pend===1?'pessoa criou conta':'pessoas criaram conta'} e espera${pend===1?'':'m'} liberação na aba Acessos.`);
  return it;
}
function renderSaude(){
  const box=$('#cfSaude');if(!box)return;const it=itensSaude();
  const ic={ok:'✓',warn:'!',bad:'✕'};
  box.innerHTML=`<div class="saude">${it.map(x=>`<div class="sd ${x.st}"><span class="sdi" aria-hidden="true">${ic[x.st]}</span><div><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div></div>`).join('')}</div>`;
}
const CFG_SAUDE=openConfig;
openConfig=function(){
  CFG_SAUDE();
  if(!ehGestor())return;
  const pb=document.querySelector('#sheet .pb');if(!pb||$('#cfSaude'))return;
  pb.insertAdjacentHTML('afterbegin','<div class="grouph" style="margin-top:0">Saúde do sistema</div><div class="fld" id="cfSaude"></div>');
  renderSaude();
};
/* faixa no Início quando algo grave acontece (só gestores) */
const INI_SAUDE=VIEWS.inicio.body;
VIEWS.inicio.body=function(){
  const h=INI_SAUDE();if(!ehGestor())return h;
  const graves=itensSaude().filter(x=>x.st==='bad');if(!graves.length)return h;
  return `<button class="banner saude-banner" data-cfg type="button"><b>Atenção:</b> ${esc(graves.map(x=>x.t).join(' · '))}. Toque para ver em Ajustes › Saúde do sistema.</button>`+h;
};
