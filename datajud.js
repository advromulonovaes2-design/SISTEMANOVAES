'use strict';
/* =====================================================================
   Completar o processo pelo CNJ (DataJud): classe, assuntos, órgão,
   ajuizamento e movimentações, direto no cadastro do processo
   ===================================================================== */
function renderCnjBox(v){
  const box=$('#cnjBox');if(!box||!SH||SH.col!=='processos')return;
  const n=digits((v&&v.numero)||($('#f_numero')||{}).value||'');
  const rec=SH.id?byId('processos',SH.id):null;const dados=SH.cnj||(rec&&rec.cnj)||null;
  if(n.length!==20){box.innerHTML=dados?resumoCnj(dados):'';return;}
  box.innerHTML=`<div class="acts" style="margin:0"><button class="btn sm" type="button" id="cnjBuscar">${dados?'Atualizar pelo CNJ':'Completar pelo CNJ'}</button><span class="hint" id="cnjSt">${dados?'':'Busca classe, assuntos, vara, data de ajuizamento e movimentações na base pública do CNJ.'}</span></div>${dados?resumoCnj(dados):''}`;
  $('#cnjBuscar').onclick=()=>buscarCnj(n);
}
function resumoCnj(d){
  if(!d||!d.achou)return'';
  const movs=(d.movimentos||[]).slice(0,8);
  return `<div class="cnjbox"><div><b>${esc(d.classe||'Classe não informada')}</b>${d.grau?` <span class="chip c-mute">${esc(d.graus&&d.graus.length>1?d.graus.join(' e '):d.grau)}</span>`:''}${d.sigilo?' <span class="chip c-warn">Sigiloso</span>':''}</div>
    <div class="hint">${esc([d.tribunal,d.orgao].filter(Boolean).join(' · '))}${d.ajuizamento?' · ajuizado em '+esc(fmtDS(d.ajuizamento)):''}</div>
    ${(d.assuntos||[]).length?`<div class="hint">Assuntos: ${esc(d.assuntos.join('; '))}</div>`:''}
    ${movs.length?`<details><summary class="hint" style="cursor:pointer">Últimas movimentações (${(d.movimentos||[]).length})</summary><ul class="cnjmov">${movs.map(m=>`<li><time>${esc(fmtDT(m.data))}</time> ${esc(m.nome)}</li>`).join('')}</ul></details>`:''}
    <span class="hint">Dados do CNJ consultados em ${esc(fmtDT(d.consultadoEm))}. A base do CNJ pode atrasar alguns dias.</span></div>`;
}
async function buscarCnj(n){
  const st=$('#cnjSt'),bt=$('#cnjBuscar');if(bt)bt.disabled=true;if(st)st.textContent='Consultando o CNJ…';
  let res=null;
  try{const{data,error}=await sb.functions.invoke('datajud',{body:{numero:n}});if(error){try{res=await error.context.json();}catch(_){res={erro:'rede'};}}else res=data;}catch(_){res={erro:'rede'};}
  if(!SH||SH.col!=='processos')return;if(bt)bt.disabled=false;
  if(!res||res.erro){if(st)st.textContent=res&&res.erro==='numero_invalido'?'Número de processo não reconhecido.':res&&res.erro==='chave_cnj'?'O CNJ trocou a chave pública. Veja o passo a passo (DataJud).':'Não foi possível consultar o CNJ agora. Tente de novo em alguns minutos.';return;}
  if(!res.achou){if(st)st.textContent=`O CNJ ainda não tem este processo (${res.tribunal}). Processos novos e sigilosos podem demorar a aparecer.`;return;}
  res.consultadoEm=new Date().toISOString();SH.cnj=res;
  const preenche=(id,val)=>{const el=$('#'+id);if(el&&val&&!el.value.trim()){el.value=val;return 1;}return 0;};
  const n1=preenche('f_tribunal',res.tribunal)+preenche('f_vara',res.orgao);
  renderCnjBox();
  const s2=$('#cnjSt');if(s2)s2.textContent=n1?'Tribunal e vara preenchidos. Confira e salve.':'Dados do CNJ carregados. Toque em Salvar para guardar.';
}
const BS_PROC=FORMS.processos.beforeSave;
FORMS.processos.beforeSave=async function(v,id){
  if(BS_PROC){const ok=await BS_PROC(v,id);if(ok===false)return false;}
  if(SH&&SH.cnj){v.cnj=SH.cnj;if(SH.cnj.classe)v.classeCnj=SH.cnj.classe;if(SH.cnj.ajuizamento)v.ajuizamento=SH.cnj.ajuizamento;}
};
const AFTER_PROC=FORMS.processos.after;
FORMS.processos.after=function(v){if(AFTER_PROC)AFTER_PROC(v);renderCnjBox(v);};
