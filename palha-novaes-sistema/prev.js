'use strict';
/* =====================================================================
   Linha do tempo previdenciária por cliente
   ===================================================================== */
(function(){
  const css=`
  .etapas{display:flex;gap:0;overflow-x:auto;padding:4px 0 2px;scrollbar-width:thin}
  .etapa{flex:1;min-width:88px;display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;text-align:center;font-size:11.5px;font-weight:600;color:var(--muted);line-height:1.25;padding:0 2px}
  .etapa::before{content:"";position:absolute;top:10px;left:-50%;width:100%;height:3px;background:var(--line);z-index:0}
  .etapa:first-child::before{display:none}
  .etapa i{width:22px;height:22px;border-radius:50%;background:var(--surface);border:3px solid var(--line);z-index:1;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px}
  .etapa.feita{color:var(--ink)}.etapa.feita i{background:var(--ok);border-color:var(--ok);color:#fff}.etapa.feita::before{background:var(--ok)}
  .etapa.atual{color:var(--accent)}.etapa.atual i{border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}.etapa.atual::before{background:var(--ok)}
  .etapa.pulada{opacity:.45}
  .mini-etapas{display:flex;gap:3px;margin-top:2px}.mini-etapas i{height:5px;flex:1;border-radius:3px;background:var(--line)}.mini-etapas i.f{background:var(--ok)}.mini-etapas i.a{background:var(--accent)}
  .resumo-prev{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin:12px 0}
  .resumo-prev div{background:var(--sunk);border-radius:8px;padding:8px 10px;min-width:0}
  .resumo-prev span{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}
  .resumo-prev b{font-size:15px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  .proc-prev{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin-bottom:16px}
  .proc-prev>.cab{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:flex-start;margin-bottom:10px}
  .proc-prev>.cab .tt{flex:1;min-width:0}`;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
})();

const PREV_TIPOS=['Requerimento administrativo (DER)','Cumprimento de exigência','Perícia administrativa (INSS)','Avaliação social','Indeferimento','Recurso ao CRPS','Decisão do CRPS','Ajuizamento da ação','Citação do INSS','Perícia judicial','Audiência','Sentença','Acórdão','Trânsito em julgado','Benefício implantado','RPV/precatório expedido','Atrasados recebidos','Parcela do benefício recebida','Honorários de êxito recebidos','Revisão / cessação','Outro'];
const ETAPAS=['Requerimento','Análise no INSS','Recurso adm.','Ação judicial','Sentença','Benefício concedido','Pagamento'];
const FASE_ETAPA={'Requerimento no INSS':0,'Exigência / cumprimento':1,'Indeferido — avaliar recurso':1,'Recurso administrativo (CRPS)':2,'Petição inicial':3,'Perícia / audiência':3,'Sentença':4,'Recurso (Turma Recursal / TRF)':4,'Benefício implantado':5,'Cumprimento / RPV / precatório':6,'Arquivado':-1};
const TIPO_ETAPA={'Requerimento administrativo (DER)':0,'Cumprimento de exigência':1,'Perícia administrativa (INSS)':1,'Avaliação social':1,'Indeferimento':1,'Recurso ao CRPS':2,'Decisão do CRPS':2,'Ajuizamento da ação':3,'Citação do INSS':3,'Perícia judicial':3,'Audiência':3,'Sentença':4,'Acórdão':4,'Trânsito em julgado':4,'Benefício implantado':5,'RPV/precatório expedido':6,'Atrasados recebidos':6,'Parcela do benefício recebida':6,'Honorários de êxito recebidos':6};
const ehRecebimento=t=>/recebid/i.test(t||'');
UI.prevCli=UI.prevCli||'';

const prevProcs=cid=>S.processos.filter(p=>p.clienteId===cid&&p.area==='Previdenciário');
const evsProc=p=>S.eventos.filter(e=>e.processoId===p.id);
function etapaAtual(p){
  let e=p.fasePrev in FASE_ETAPA?FASE_ETAPA[p.fasePrev]:0;
  evsProc(p).forEach(x=>{if(x.tipo in TIPO_ETAPA&&x.data<=hojeStr())e=Math.max(e,TIPO_ETAPA[x.tipo]);});
  if(p.dib)e=Math.max(e,5);
  if(p.dip&&p.dip<=hojeStr())e=Math.max(e,6);
  return e;
}
function etapasPassadas(p){ // quais etapas tiveram algum registro (para mostrar as puladas mais claras)
  const s=new Set();evsProc(p).forEach(x=>{if(x.tipo in TIPO_ETAPA)s.add(TIPO_ETAPA[x.tipo]);});
  if(p.der)s.add(0);if(p.fasePrev in FASE_ETAPA)s.add(FASE_ETAPA[p.fasePrev]);if(p.dib)s.add(5);
  if(/\.4\.\d\d\./.test(p.numero||'')||/^\d{7}-/.test(p.numero||''))s.add(3);
  return s;
}
function stepperHTML(p){
  const at=etapaAtual(p),reg=etapasPassadas(p);
  if(at<0)return `<span class="chip c-mute">Arquivado</span>`;
  const fim=at===ETAPAS.length-1&&evsProc(p).some(x=>ehRecebimento(x.tipo)&&x.data<=hojeStr());
  return `<div class="etapas">${ETAPAS.map((n,i)=>{const cls=i<at?(reg.has(i)||i===0?'feita':'feita pulada'):i===at?(fim?'feita':'atual'):'';return `<div class="etapa ${cls}"><i>${i<at||(fim&&i===at)?'✓':i+1}</i>${n}</div>`;}).join('')}</div>`;
}
function miniEtapas(p){const at=etapaAtual(p);return `<div class="mini-etapas" aria-label="Etapa ${at+1} de ${ETAPAS.length}">${ETAPAS.map((_,i)=>`<i class="${i<at?'f':i===at?'a':''}"></i>`).join('')}</div>`;}
function itensPrev(p){
  const it=[];const c=byId('clientes',p.clienteId);
  if(p.der)it.push({data:p.der,titulo:'Requerimento administrativo (DER)',sub:[p.especie,p.nb?'NB '+p.nb:''].filter(Boolean).join(' · '),cor:'adm',ordem:-1});
  evsProc(p).forEach(e=>it.push({data:e.data,titulo:e.titulo&&e.titulo!==e.tipo?e.titulo:e.tipo,sub:[e.titulo&&e.titulo!==e.tipo?e.tipo:'',e.hora,e.local,e.valor?brl(e.valor):'',e.descricao].filter(Boolean).join(' · '),
    cor:ehRecebimento(e.tipo)?'ok':/Indeferimento|cessação/i.test(e.tipo)?'neg':(TIPO_ETAPA[e.tipo]??0)>=3&&(TIPO_ETAPA[e.tipo]??0)<5?'jud':(TIPO_ETAPA[e.tipo]??0)>=5?'ok':'adm',abrir:{tipo:'evento',id:e.id}}));
  S.prazos.filter(x=>x.processoId===p.id).forEach(x=>{const i=prazoInfo(x);if(i.r)it.push({data:i.r.venc,titulo:'Prazo: '+(x.descricao||''),sub:x.cumprido?'Cumprido':i.txt,cor:x.cumprido?'mute':'pz',abrir:{tipo:'prazo',id:x.id}});});
  S.intimacoes.filter(x=>x.processo_id===p.id||(digits(p.numero).length===20&&digits(x.numero)===digits(p.numero))).forEach(x=>it.push({data:x.data_disponibilizacao,titulo:'Intimação: '+(x.tipo_documento||x.tipo||'publicação'),sub:String(x.texto||'').slice(0,160),cor:'mute'}));
  const mv=S.movs[digits(p.numero)];if(mv&&mv.data)it.push({data:String(mv.data).slice(0,10),titulo:'Movimentação: '+mv.nome,sub:'Fonte: DataJud/CNJ',cor:'mute'});
  if(p.dib)it.push({data:p.dib,titulo:'Benefício concedido (DIB)',sub:[p.especie,p.rmi?'RMI '+brl(p.rmi):''].filter(Boolean).join(' · '),cor:'ok'});
  if(p.dip)it.push({data:p.dip,titulo:'Início do pagamento (DIP)',sub:p.rmi?'Benefício mensal de '+brl(p.rmi):'',cor:'ok'});
  S.documentos.filter(d=>d.processoId===p.id&&d.status==='assinado'&&d.assinadoEm).forEach(d=>it.push({data:d.assinadoEm,titulo:d.tipo==='procuracao'?'Procuração assinada':'Contrato assinado',sub:'Aba Documentos',cor:'mute'}));
  S.honorarios.filter(h=>h.processoId===p.id).forEach(h=>(h.parcelas||[]).filter(x=>x.desc==='Êxito').forEach(x=>it.push({data:x.pago?(x.pagoEm||x.venc):x.venc,titulo:x.pago?'Honorários de êxito recebidos':'Honorários de êxito previstos',sub:brl(x.valor),cor:x.pago?'ok':'pz',abrir:{tipo:'honorarios',id:h.id}})));
  return it;
}
function resumoPrev(p){
  const rec=evsProc(p).filter(e=>/Atrasados recebidos|Parcela do benefício/.test(e.tipo)).reduce((s,e)=>s+(Number(e.valor)||0),0);
  const ex=S.honorarios.filter(h=>h.processoId===p.id).flatMap(h=>h.parcelas||[]).filter(x=>x.desc==='Êxito');
  const cel=(l,v)=>`<div><span>${l}</span><b>${v||'—'}</b></div>`;
  return `<div class="resumo-prev">${cel('DER',p.der?fmtD(p.der):'')}${cel('DIB',p.dib?fmtD(p.dib):'')}${cel('DIP',p.dip?fmtD(p.dip):'')}${cel('RMI',p.rmi?brl(p.rmi):'')}${cel('Atrasados previstos',p.atrasados?brl(p.atrasados):'')}${cel('Recebido pela cliente',rec?brl(rec):'')}${cel('Êxito do escritório',ex.length?ex.map(x=>brl(x.valor)+(x.pago?' (recebido)':'')).join(' + '):'')}</div>`;
}
function proximoPrev(p){
  const hoje=hojeStr();const f=itensPrev(p).filter(x=>x.data>=hoje&&x.cor!=='mute').sort((a,b)=>a.data.localeCompare(b.data))[0];
  return f?`${f.titulo} · ${fmtD(f.data)}`:'';
}

/* ---------- telas ---------- */
VIEWS.previdenciario={t:'Previdenciário',
  tools(){const c=UI.prevCli&&byId('clientes',UI.prevCli);if(c)return'';return `<div class="sub">A jornada de cada cliente: do requerimento no INSS à concessão do benefício e ao recebimento dos valores.</div>`;},
  body(){
    const c=UI.prevCli&&byId('clientes',UI.prevCli);
    if(c)return telaClientePrev(c);
    UI.prevCli='';
    const cls=S.clientes.filter(x=>prevProcs(x.id).length||x.area==='Previdenciário'||x.area==='Ambos'||x.area==='Mais de uma área').sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));
    if(!cls.length)return vazio('Nenhuma cliente de previdenciário','Cadastre a cliente e o processo (ou o protocolo do INSS) com área Previdenciário.','clientes','+ Cadastrar cliente');
    return `<div class="list">${cls.map(c=>{const ps=prevProcs(c.id);const p=ps[0];const prox=p?proximoPrev(p):'';
      return `<div class="row click a-prev" data-prevcli="${esc(c.id)}" role="button" tabindex="0"><div class="main"><div class="t">${esc(c.nome)}</div>
        ${p?`<div class="m">${esc(p.especie||'Benefício não informado')}${ps.length>1?` · +${ps.length-1} ${ps.length===2?'processo':'processos'}`:''}</div>${miniEtapas(p)}<div class="chips"><span class="chip c-prev">${esc(ETAPAS[Math.max(0,etapaAtual(p))]||'')}</span>${p.fasePrev?`<span class="chip c-mute">${esc(p.fasePrev)}</span>`:''}${p.dib?`<span class="chip c-ok">DIB ${fmtD(p.dib)}</span>`:''}${prox?`<span class="chip c-warn">Próximo: ${esc(prox)}</span>`:''}</div>`:'<div class="m">Nenhum processo previdenciário cadastrado.</div>'}
      </div></div>`;}).join('')}</div>`;
  }};
function telaClientePrev(c){
  TL_TIPOS=PREV_TIPOS;
  const ps=prevProcs(c.id);
  return `<div class="jhead"><button class="btn sm" data-prevvoltar type="button">‹ Clientes</button><div class="tt"><b>${esc(c.nome)}</b><span class="muted" style="font-size:13px">${[c.cpf,c.nit?'NIT '+c.nit:'',c.telefone].filter(Boolean).map(esc).join(' · ')}</span></div>
    <button class="btn sm" data-edit="clientes" data-id="${esc(c.id)}" type="button">Cadastro</button><button class="btn sm pri" data-new="processos" data-prevnovoproc="${esc(c.id)}" type="button">+ Processo</button></div>
  ${ps.length?ps.map(p=>`<section class="proc-prev"><div class="cab"><div class="tt"><div class="t" style="font-weight:600">${esc(p.especie||'Benefício não informado')}</div><div class="m muted mono" style="font-size:13px">${esc(p.numero||'Sem número')}${p.vara?' · '+esc(p.vara):''}</div></div>
      <button class="btn sm" data-edit="processos" data-id="${esc(p.id)}" type="button">Editar processo</button><button class="btn sm pri" data-prevnovoev="${esc(p.id)}" type="button">+ Evento</button></div>
    ${stepperHTML(p)}${resumoPrev(p)}
    ${linhaDoTempoHTML(itensPrev(p),'Registre a DER no processo ou adicione o primeiro evento.')}</section>`).join('')
  :vazio('Nenhum processo previdenciário','Cadastre o requerimento no INSS ou a ação judicial desta cliente.')}`;
}
function acaoPrev(pr){if(!pr||pr.area!=='Previdenciário'||!pr.clienteId)return'';return `<button class="btn sm" data-prevcli="${esc(pr.clienteId)}" type="button">Linha do tempo</button>`;}
function acoesCliente(c){if(!prevProcs(c.id).length)return'';return `<div class="acts"><button class="btn sm" data-prevcli="${esc(c.id)}" type="button">Linha do tempo</button></div>`;}

document.addEventListener('click',e=>{
  if(e.target.closest('#sheet .panel'))return;
  let t;
  if(t=e.target.closest('[data-prevcli]')){e.stopPropagation();UI.prevCli=t.dataset.prevcli;if(location.hash!=='#previdenciario')location.hash='#previdenciario';else go('previdenciario');return;}
  if(e.target.closest('[data-prevvoltar]')){e.stopPropagation();UI.prevCli='';go('previdenciario');return;}
  if(t=e.target.closest('[data-prevnovoev]')){e.stopPropagation();const p=byId('processos',t.dataset.prevnovoev);abrirEvento(null,{tipo:'Perícia administrativa (INSS)',processoId:p.id,responsavelId:p.responsavelId||'',clienteId:p.clienteId},PREV_TIPOS);return;}
  if(t=e.target.closest('[data-prevnovoproc]')){e.stopPropagation();openForm('processos',null,{clienteId:t.dataset.prevnovoproc,area:'Previdenciário'});return;}
},true);
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches&&e.target.matches('[data-prevcli]'))e.target.click();});
