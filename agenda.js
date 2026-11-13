'use strict';
/* =====================================================================
   Calendário (aba Prazos) e compromissos: audiências, perícias, plenários…
   ===================================================================== */
(function(){
  const css=`
  .cal-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
  .cal-head h2{font-family:var(--f-display);font-size:22px;font-weight:600;min-width:170px}
  .cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border:1px solid var(--line);border-radius:var(--r);overflow:hidden;background:var(--line);gap:1px}
  .cal-dow{background:var(--sunk);font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);text-align:center;padding:6px 0}
  .cal-cell{background:var(--surface);min-height:104px;padding:4px 5px 6px;display:flex;flex-direction:column;gap:3px;cursor:pointer;min-width:0;text-align:left;border:0;font:inherit;color:inherit}
  .cal-cell.fora{background:var(--bg);color:var(--muted)}
  .cal-cell.feriado .cal-n{color:var(--danger)}
  .cal-cell.recesso{background:repeating-linear-gradient(135deg,var(--surface),var(--surface) 6px,var(--sunk) 6px,var(--sunk) 8px)}
  .cal-cell.sel{outline:2px solid var(--accent);outline-offset:-2px;z-index:1}
  .cal-cell.over{outline:2px dashed var(--accent);outline-offset:-2px}
  .cal-n{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;display:flex;justify-content:space-between;gap:4px}
  .cal-n .hj{background:var(--accent);color:var(--accent-ink);border-radius:999px;padding:0 7px}
  .cal-n small{font-weight:500;color:var(--danger);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cal-it{font-size:11.5px;line-height:1.3;border-radius:5px;padding:2px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;border-left:3px solid currentColor}
  .cal-it[draggable="true"]{cursor:grab}
  .k-prazo{background:var(--warn-soft);color:var(--warn)} .k-venc{background:var(--danger-soft);color:var(--danger)} .k-ok{background:var(--ok-soft);color:var(--ok);text-decoration:line-through}
  .k-aud{background:var(--accent-soft);color:var(--accent)} .k-per{background:var(--prev-soft);color:var(--prev)} .k-jur{background:var(--crim-soft);color:var(--crim)} .k-out{background:var(--adm-soft);color:var(--adm)}
  .cal-mais{font-size:11px;color:var(--muted);padding-left:4px}
  .cal-dots{display:none;gap:3px;flex-wrap:wrap}
  .cal-dots i{width:7px;height:7px;border-radius:50%;background:currentColor;display:block}
  @media (max-width:699px){.cal-cell{min-height:58px;align-items:center}.cal-it,.cal-mais,.cal-n small{display:none}.cal-dots{display:flex}.cal-n{justify-content:center}}
  .cal-leg{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;color:var(--muted);margin:10px 0 18px}
  .cal-leg span{display:inline-flex;align-items:center;gap:5px}.cal-leg i{width:10px;height:10px;border-radius:3px;display:inline-block}
  .ev-hora{flex:none;width:54px;text-align:center;font-family:var(--f-mono);font-size:13px;font-weight:500;padding-top:2px;margin-left:4px}`;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
})();

const EV_AGENDA=['Audiência','Perícia judicial','Perícia administrativa (INSS)','Plenário do Júri','Sessão de julgamento','Reunião com cliente','Atendimento','Diligência','Visita ao cliente preso','Outro compromisso'];
const evClasse=t=>/Plenário|Júri/.test(t||'')?'k-jur':/Perícia/.test(t||'')?'k-per':/Audiência|Sessão/.test(t||'')?'k-aud':'k-out';
const ehCompromisso=e=>EV_AGENDA.includes(e.tipo)||!!e.hora;
/* links: só abre endereços http(s); completa o https:// se a pessoa colar sem */
/* link colado do WhatsApp ou de PDF costuma vir quebrado em duas linhas: tira espaços e quebras */
function normLink(u){u=String(u||'').trim().replace(/^[<"'(]+|[>"')]+$/g,'').replace(/\s+/g,'');if(!u)return'';if(!/^[a-z][a-z0-9+.-]*:/i.test(u))u='https://'+u.replace(/^\/+/,'');return u;}
function linkSeguro(u){u=normLink(u);return /^https?:\/\/[^\s]+$/i.test(u)?u:'';}
const MODALIDADES=['Presencial','Telepresencial (virtual)','Semipresencial (híbrida)'];
const ehVirtual=m=>!!m&&m!=='Presencial';
const usaFormato=f=>/Audiência|Perícia|Plenário|Sessão|Reunião|Atendimento|Outro compromisso/i.test(f.tipo||'');
function botoesLink(link,info){const l=linkSeguro(link);if(!l)return'';return `<a class="btn sm pri" href="${esc(l)}" target="_blank" rel="noopener noreferrer">Entrar na sala virtual</a><button class="btn sm" type="button" data-copiarlink="${esc(l+(info?'\n'+info:''))}">Copiar link</button>`;}

FORMS.eventos={t:'Compromisso',f:[
  {k:'titulo',l:'Título',t:'text',req:1,ph:'Audiência de instrução, perícia médica…'},
  {k:'tipo',l:'Tipo',t:'select',o:EV_AGENDA,half:1},
  {k:'data',l:'Data',t:'date',req:1,half:1},
  {k:'hora',l:'Hora',t:'time',half:1},{k:'horaFim',l:'Até',t:'time',half:1},
  {k:'modalidade',l:'Formato',t:'select',o:MODALIDADES,show:usaFormato},
  {k:'local',l:'Local',t:'text',ph:'Fórum Criminal, sala 3',show:f=>!usaFormato(f)||f.modalidade!=='Telepresencial (virtual)'},
  {k:'link',l:'Link da sala virtual',t:'url',ph:'https://…',show:f=>usaFormato(f)&&ehVirtual(f.modalidade),hint:'Zoom, Teams, Google Meet, Webex, Balcão Virtual… Cole o link completo enviado pelo juízo.'},
  {k:'linkInfo',l:'ID, senha ou instruções da sala',t:'text',show:f=>usaFormato(f)&&ehVirtual(f.modalidade),ph:'ID 123 456 789 · senha 1234 · entrar 15 min antes'},
  {k:'processoId',l:'Processo',t:'ref',col:'processos',lab:procLabel},
  {k:'responsavelId',l:'Responsável',t:'ref',col:'equipe',lab:m=>m.nome,half:1},
  {k:'valor',l:'Valor (R$)',t:'number',half:1,show:f=>/recebid|RPV|precat|Atrasados|Parcela|Honorários/i.test(f.tipo||'')},
  {k:'descricao',l:'Anotações',t:'area'},
  {k:'concluido',l:'Já aconteceu / concluído',t:'check'}],
  beforeSave(v,id){if(v.link){v.link=normLink(v.link);if(!linkSeguro(v.link)){toast('O link da sala precisa começar com https://');return false;}}const pr=byId('processos',v.processoId);if(pr)v.clienteId=pr.clienteId||'';const pre=SH&&SH.preset;if(!id&&pre){if(pre.juriId)v.juriId=pre.juriId;if(pre.clienteId&&!v.clienteId)v.clienteId=pre.clienteId;}}
};
/* abre o formulário de evento com a lista de tipos certa para cada módulo */
function abrirEvento(id,preset,tipos,onSaved){
  const ev=id?byId('eventos',id):null;const lista=[...(tipos||EV_AGENDA)];
  const atual=ev?ev.tipo:(preset&&preset.tipo);if(atual&&!lista.includes(atual))lista.unshift(atual);
  FORMS.eventos.f.find(x=>x.k==='tipo').o=lista;
  FORMS.eventos.t=tipos&&tipos!==EV_AGENDA?'Evento da linha do tempo':'Compromisso';
  openForm('eventos',id,preset,onSaved);
}

/* ---------- itens do calendário ---------- */
function itensCalendario(){
  const it=[];const fr=UI.respCal;
  S.prazos.forEach(p=>{if(fr&&p.responsavelId!==fr)return;const i=prazoInfo(p);if(!i.r)return;
    const pr=byId('processos',p.processoId);
    it.push({kind:'prazo',id:p.id,dia:i.r.venc,hora:'',cls:p.cumprido?'k-ok':i.dd<0?'k-venc':'k-prazo',titulo:'Prazo: '+(p.descricao||''),sub:pr?pr.numero:'',resp:p.responsavelId,manual:!!i.r.manual,feito:!!p.cumprido});});
  S.eventos.forEach(e=>{if(!e.data||!ehCompromisso(e))return;if(fr&&e.responsavelId!==fr)return;
    const pr=byId('processos',e.processoId);
    it.push({kind:'evento',id:e.id,dia:e.data,hora:e.hora||'',cls:evClasse(e.tipo),titulo:(e.hora?e.hora+' ':'')+(e.titulo||e.tipo),sub:[e.tipo,e.local,pr&&pr.numero].filter(Boolean).join(' · '),resp:e.responsavelId,feito:!!e.concluido,modalidade:e.modalidade,link:e.link,linkInfo:e.linkInfo});});
  return it.sort((a,b)=>(a.dia+(a.hora||'99')).localeCompare(b.dia+(b.hora||'99')));
}
function nomeFeriado(d){const s=ymd(d);const sp=typeof suspensao==='function'&&suspensao(d,'*');if(sp&&!ehFeriado(d,true))return 'Suspensão'+(sp.tribunal&&!/^todos$/i.test(sp.tribunal)?' '+sp.tribunal:'');if(!ehFeriado(d,true))return'';const md=s.slice(5);
  const N={'01-01':'Confraternização','04-21':'Tiradentes','05-01':'Dia do Trabalho','09-07':'Independência','10-12':'N. Sra. Aparecida','11-02':'Finados','11-15':'República','11-20':'Consciência Negra','12-25':'Natal','08-11':'Feriado JF','11-01':'Feriado JF','12-08':'Feriado JF'};
  return N[md]||'Feriado';}

/* ---------- tela do calendário ---------- */
UI.prazoModo=UI.prazoModo||'lista';
UI.calMes=UI.calMes||hojeStr().slice(0,7);UI.calDia=UI.calDia||hojeStr();UI.respCal=UI.respCal||'';
const P0={tools:VIEWS.prazos.tools,bind:VIEWS.prazos.bind,body:VIEWS.prazos.body};
VIEWS.prazos.tools=function(){
  const seg=`<div class="tools"><div class="seg" id="segModo"><button data-m="lista" type="button" class="${UI.prazoModo==='lista'?'on':''}">Lista</button><button data-m="cal" type="button" class="${UI.prazoModo==='cal'?'on':''}">Calendário</button></div></div>`;
  if(UI.prazoModo!=='cal')return seg+P0.tools();
  return seg+`<div class="tools"><select class="input" id="fRespC" aria-label="Responsável"></select><button class="btn push" data-new="prazos" type="button">+ Prazo</button><button class="btn pri" data-novoev="" type="button">+ Audiência, perícia…</button></div>`;
};
VIEWS.prazos.bind=function(){
  $('#segModo').onclick=e=>{const b=e.target.closest('button');if(b&&b.dataset.m!==UI.prazoModo){UI.prazoModo=b.dataset.m;go('prazos');}};
  if(UI.prazoModo!=='cal')return P0.bind();
  $('#fRespC').onchange=e=>{UI.respCal=e.target.value;body_();};
};
VIEWS.prazos.body=function(){
  if(UI.prazoModo!=='cal')return P0.body();
  $('#fRespC').innerHTML=respOptions(UI.respCal);
  const[y,m]=UI.calMes.split('-').map(Number);const ini=new Date(Date.UTC(y,m-1,1));
  const start=addD(ini,-ini.getUTCDay());const hoje=hojeStr();
  const its=itensCalendario();const porDia={};its.forEach(x=>(porDia[x.dia]=porDia[x.dia]||[]).push(x));
  let cells='';
  for(let i=0;i<42;i++){
    const d=addD(start,i),s=ymd(d),l=porDia[s]||[];const fora=d.getUTCMonth()!==m-1;
    if(i===35&&fora)break;
    const fer=nomeFeriado(d);
    cells+=`<div class="cal-cell ${fora?'fora':''} ${fer?'feriado':''} ${emRecesso(d)?'recesso':''} ${s===UI.calDia?'sel':''}" data-dia="${s}" role="button" tabindex="0" aria-label="${fmtD(s)}${l.length?', '+l.length+' itens':''}">
      <span class="cal-n"><span class="${s===hoje?'hj':''}">${d.getUTCDate()}</span>${fer?`<small>${esc(fer)}</small>`:''}</span>
      ${l.slice(0,3).map(x=>`<span class="cal-it ${x.cls}" draggable="true" data-calk="${x.kind}" data-calid="${esc(x.id)}" title="${esc(x.titulo)}">${esc(x.titulo)}</span>`).join('')}
      ${l.length>3?`<span class="cal-mais">+${l.length-3} mais</span>`:''}
      <span class="cal-dots">${l.slice(0,4).map(x=>`<i class="${x.cls}" style="background:currentColor"></i>`).join('')}</span>
    </div>`;
  }
  const doDia=porDia[UI.calDia]||[];
  const nomeMes=`${MESES[m-1].charAt(0).toUpperCase()+MESES[m-1].slice(1)} de ${y}`;
  return `<div class="cal-head"><button class="btn sm" data-calnav="-1" type="button" aria-label="Mês anterior">‹</button><h2>${nomeMes}</h2><button class="btn sm" data-calnav="1" type="button" aria-label="Próximo mês">›</button><button class="btn sm" data-calnav="0" type="button">Hoje</button></div>
    <div class="cal-grid">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=>`<div class="cal-dow">${x}</div>`).join('')}${cells}</div>
    <div class="cal-leg"><span><i class="k-venc" style="background:var(--danger)"></i>Prazo vencido</span><span><i style="background:var(--warn)"></i>Prazo</span><span><i style="background:var(--accent)"></i>Audiência</span><span><i style="background:var(--prev)"></i>Perícia</span><span><i style="background:var(--crim)"></i>Júri</span><span><i style="background:var(--adm)"></i>Outros</span><span>No computador, arraste para mudar a data.</span></div>
    <div class="sec"><h2>${fmtDS(UI.calDia)}${nomeFeriado(parseD(UI.calDia))?' · '+esc(nomeFeriado(parseD(UI.calDia))):''} <button class="lnk" data-novoev="" data-evdia="${UI.calDia}" type="button">+ Compromisso neste dia</button></h2>
      ${doDia.length?`<div class="list">${doDia.map(rowItemCal).join('')}</div>`:vazio('Nada marcado neste dia','Toque em outro dia ou adicione um compromisso.')}</div>`;
};
function rowItemCal(x){
  const m=byId('equipe',x.resp);
  return `<div class="row click ${x.feito?'done':''}" data-calopen="${x.kind}" data-id="${esc(x.id)}" role="button" tabindex="0">
    <div class="ev-hora">${esc(x.hora||(x.kind==='prazo'?'Prazo':'—'))}</div>
    <div class="main"><div class="t">${esc(x.titulo.replace(/^\d\d:\d\d /,''))}</div>${x.sub?`<div class="m">${esc(x.sub)}</div>`:''}
      <div class="chips"><span class="chip cal-it ${x.cls}" style="border:0">${x.kind==='prazo'?'Prazo':'Compromisso'}</span>${x.manual?'<span class="chip c-warn">Vencimento ajustado à mão</span>':''}${ehVirtual(x.modalidade)?`<span class="chip c-prev">${esc(x.modalidade.replace(/ \(.*\)/,''))}</span>`:''}${m?`<span class="chip c-mute">${esc(m.nome)}</span>`:''}</div>
      ${x.linkInfo&&linkSeguro(x.link)?`<div class="m">${esc(x.linkInfo)}</div>`:''}${linkSeguro(x.link)?`<div class="acts">${botoesLink(x.link,x.linkInfo)}</div>`:''}</div></div>`;
}
function moverCal(kind,id,dia){
  if(kind==='prazo'){const p=byId('prazos',id);if(!p)return;atualizar('prazos',id,{vencManual:dia,vencimento:dia,conferidoPor:'',conferidoEm:''}).then(ok=>ok&&toast(`Vencimento ajustado à mão para ${fmtD(dia)}. Para voltar ao cálculo, apague o ajuste no prazo.`));}
  else{const e=byId('eventos',id);if(!e||e.data===dia)return;atualizar('eventos',id,{data:dia}).then(ok=>ok&&toast(`Movido para ${fmtD(dia)}.`));}
}

/* ---------- compromissos no Início ---------- */
const INI0=VIEWS.inicio.body;
VIEWS.inicio.body=function(){
  const h=INI0();const hoje=hojeStr(),lim=ymd(addD(parseD(hoje),3));
  const l=S.eventos.filter(e=>ehCompromisso(e)&&!e.concluido&&e.data>=hoje&&e.data<=lim).sort((a,b)=>(a.data+(a.hora||'99')).localeCompare(b.data+(b.hora||'99')));
  const sec=`<div class="sec"><h2>Compromissos até ${fmtD(lim)} <a href="#prazos" data-irCal>Abrir calendário</a></h2>${l.length?`<div class="list">${l.map(e=>{const pr=byId('processos',e.processoId);return `<div class="row click" data-calopen="evento" data-id="${esc(e.id)}" role="button" tabindex="0"><div class="dateblk ${e.data===hoje?'warn':''}"><b>${parseD(e.data).getUTCDate()}</b><span>${MES[parseD(e.data).getUTCMonth()]}</span></div><div class="main"><div class="t">${esc(e.titulo||e.tipo)}</div><div class="m">${[e.hora,e.tipo,ehVirtual(e.modalidade)?e.modalidade.replace(/ \(.*\)/,''):'',e.local].filter(Boolean).map(esc).join(' · ')}</div>${linkSeguro(e.link)?`<div class="acts">${botoesLink(e.link,e.linkInfo)}</div>`:''}${pr?`<div class="m mono">${esc(pr.numero||'')}</div>`:''}</div></div>`;}).join('')}</div>`:vazio('Nenhum compromisso nos próximos dias','Audiências, perícias e plenários aparecem aqui.')}</div>`;
  const i=h.indexOf('<div class="sec">');return i<0?h+sec:h.slice(0,i)+sec+h.slice(i);
};

/* ---------- ações no cartão do processo ---------- */
function acoesProcesso(pr){
  const b=[];
  if(typeof acaoJuri==='function'){const x=acaoJuri(pr);if(x)b.push(x);}
  if(typeof acaoPrev==='function'){const x=acaoPrev(pr);if(x)b.push(x);}
  b.push(`<button class="btn sm" data-novoev="${esc(pr.id)}" type="button">+ Audiência, perícia…</button>`);
  return `<div class="acts">${b.join('')}</div>`;
}

/* ---------- eventos de clique e arrastar ---------- */
document.addEventListener('click',e=>{
  if(e.target.closest('#sheet .panel'))return;
  const cl=e.target.closest('[data-copiarlink]');if(cl){e.stopPropagation();copiar(cl.dataset.copiarlink);return;}
  if(e.target.closest('a[href^="http"]')){e.stopPropagation();return;} // deixa o link abrir sem abrir o formulário
  const nv=e.target.closest('[data-calnav]');
  if(nv){e.stopPropagation();const n=Number(nv.dataset.calnav);if(n===0){UI.calMes=hojeStr().slice(0,7);UI.calDia=hojeStr();}else{const[y,m]=UI.calMes.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+n,1));UI.calMes=ymd(d).slice(0,7);}body_();return;}
  const ir=e.target.closest('[data-irCal]');if(ir){UI.prazoModo='cal';return;}
  const ev=e.target.closest('[data-novoev]');
  if(ev){e.stopPropagation();e.preventDefault();const pr=byId('processos',ev.dataset.novoev);abrirEvento(null,{tipo:'Audiência',data:ev.dataset.evdia||(cur==='prazos'&&UI.prazoModo==='cal'?UI.calDia:''),processoId:pr?pr.id:'',responsavelId:pr?pr.responsavelId:''});return;}
  const op=e.target.closest('[data-calopen]');
  if(op){e.stopPropagation();if(op.dataset.calopen==='prazo')openForm('prazos',op.dataset.id);else abrirEvento(op.dataset.id);return;}
  const it=e.target.closest('.cal-it[data-calid]');
  if(it){e.stopPropagation();if(it.dataset.calk==='prazo')openForm('prazos',it.dataset.calid);else abrirEvento(it.dataset.calid);return;}
  const cell=e.target.closest('.cal-cell[data-dia]');
  if(cell){e.stopPropagation();UI.calDia=cell.dataset.dia;if(cell.dataset.dia.slice(0,7)!==UI.calMes)UI.calMes=cell.dataset.dia.slice(0,7);body_();
    const s=document.querySelector('.cal-leg');if(s&&innerWidth<700)setTimeout(()=>s.scrollIntoView({behavior:'smooth',block:'start'}),50);return;}
},true);
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches&&e.target.matches('.cal-cell,[data-calopen]'))e.target.click();});
let calDrag=null;
document.addEventListener('dragstart',e=>{const it=e.target.closest&&e.target.closest('.cal-it[data-calid]');if(it){calDrag={k:it.dataset.calk,id:it.dataset.calid};e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',it.dataset.calid);}catch(_){}}});
document.addEventListener('dragover',e=>{const c=e.target.closest&&e.target.closest('.cal-cell[data-dia]');if(c&&calDrag){e.preventDefault();document.querySelectorAll('.cal-cell.over').forEach(x=>x!==c&&x.classList.remove('over'));c.classList.add('over');}});
document.addEventListener('drop',e=>{const c=e.target.closest&&e.target.closest('.cal-cell[data-dia]');document.querySelectorAll('.cal-cell.over').forEach(x=>x.classList.remove('over'));if(c&&calDrag){e.preventDefault();moverCal(calDrag.k,calDrag.id,c.dataset.dia);}calDrag=null;});
document.addEventListener('dragend',()=>{calDrag=null;document.querySelectorAll('.cal-cell.over').forEach(x=>x.classList.remove('over'));});

/* ---------- linha do tempo (usada no Júri e no Previdenciário) ---------- */
(function(){
  const css=`
  .tl{display:flex;flex-direction:column}
  .tl-it{display:grid;grid-template-columns:78px 20px minmax(0,1fr);column-gap:10px}
  .tl-d{text-align:right;font-size:12.5px;color:var(--muted);padding-top:12px;font-variant-numeric:tabular-nums;line-height:1.3}
  .tl-d b{display:block;color:var(--ink);font-size:14px}
  .tl-l{position:relative}
  .tl-l::before{content:"";position:absolute;left:9px;top:0;bottom:0;width:2px;background:var(--line)}
  .tl-it:first-child .tl-l::before{top:16px}.tl-it:last-child .tl-l::before{bottom:calc(100% - 16px)}
  .tl-l i{position:absolute;left:3px;top:13px;width:14px;height:14px;border-radius:50%;background:currentColor;border:3px solid var(--surface);box-shadow:0 0 0 1px currentColor}
  .tl-it.futuro .tl-l i{background:var(--surface)}
  .tl-c{padding:8px 0 14px;min-width:0}
  .tl-c .t{font-weight:600;font-size:14.5px;line-height:1.35;overflow-wrap:anywhere}
  .tl-c .m{font-size:13px;color:var(--muted);overflow-wrap:anywhere}
  .tl-c.click{cursor:pointer;border-radius:8px}.tl-c.click:hover .t{color:var(--accent)}
  .tl-hoje{display:grid;grid-template-columns:78px 20px minmax(0,1fr);column-gap:10px;align-items:center;color:var(--accent);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
  .tl-hoje span:last-child{border-top:1px dashed var(--accent);padding-top:2px}
  .tl-hoje span:first-child{text-align:right}
  .c-tl-adm{color:var(--prev)} .c-tl-jud{color:var(--crim)} .c-tl-ok{color:var(--ok)} .c-tl-pz{color:var(--warn)} .c-tl-neg{color:var(--danger)} .c-tl-mute{color:var(--muted)} .c-tl-ac{color:var(--accent)}`;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
})();
/* itens: {data:'AAAA-MM-DD', titulo, sub, cor:'adm|jud|ok|pz|neg|mute|ac', abrir:{tipo:'evento'|'prazo', id}} */
function linhaDoTempoHTML(itens,vazioTxt){
  const l=itens.filter(x=>x.data).sort((a,b)=>a.data.localeCompare(b.data)||(a.ordem||0)-(b.ordem||0));
  if(!l.length)return vazio('Linha do tempo vazia',vazioTxt||'Adicione o primeiro evento.');
  const hoje=hojeStr();let marcou=false;let html='';
  l.forEach(x=>{
    if(!marcou&&x.data>hoje){marcou=true;html+=`<div class="tl-hoje"><span>Hoje</span><span></span><span>${fmtD(hoje)}</span></div>`;}
    const d=parseD(x.data);const ab=x.abrir?`data-tlopen="${x.abrir.tipo}" data-id="${esc(x.abrir.id)}" role="button" tabindex="0"`:'';
    html+=`<div class="tl-it ${x.data>hoje?'futuro':''}"><div class="tl-d"><b>${pad(d.getUTCDate())} ${MES[d.getUTCMonth()]}</b>${d.getUTCFullYear()}</div><div class="tl-l c-tl-${x.cor||'mute'}"><i></i></div>
      <div class="tl-c ${x.abrir?'click':''}" ${ab}><div class="t">${esc(x.titulo)}</div>${x.sub?`<div class="m">${esc(x.sub)}</div>`:''}${x.chips||''}</div></div>`;
  });
  if(!marcou)html+=`<div class="tl-hoje"><span>Hoje</span><span></span><span>${fmtD(hoje)}</span></div>`;
  return `<div class="tl">${html}</div>`;
}
let TL_TIPOS=null;
document.addEventListener('click',e=>{
  if(e.target.closest('#sheet .panel'))return;
  const t=e.target.closest('[data-tlopen]');if(!t)return;e.stopPropagation();
  if(t.dataset.tlopen==='prazo')openForm('prazos',t.dataset.id);
  else if(t.dataset.tlopen==='evento')abrirEvento(t.dataset.id,null,TL_TIPOS);
  else if(t.dataset.tlopen==='honorarios')openForm('honorarios',t.dataset.id);
},true);
