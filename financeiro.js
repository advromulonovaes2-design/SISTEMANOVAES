'use strict';
/* =====================================================================
   Acompanhamento financeiro: parcelas editáveis uma a uma no contrato,
   contrato com a lista de parcelas, filtros e visão por mês
   ===================================================================== */
const FIN_HOJE=()=>hojeStr();
const clonaParc=l=>(l||[]).map(p=>({...p}));
const somaParc=l=>Math.round(l.reduce((s,p)=>s+(Number(p.valor)||0),0)*100)/100;
const valorContrato=v=>temFixo(v)?(Number(v.valor)||0)+(v.modalidade==='entrada_parcelado'?0:(temEntrada(v)?Number(v.entrada)||0:0)):(temEntrada(v)?Number(v.entrada)||0:0);

/* ---------- editor de parcelas dentro do formulário do contrato ---------- */
function parcIniciar(){
  if(SH.parcIni)return;SH.parcIni=true;
  const rec=SH.id?byId('honorarios',SH.id):null;
  SH.parc=rec?clonaParc(rec.parcelas):[];SH.parcManual=!!(rec&&rec.parcelasManuais);
}
function parcRecalcular(v){
  if(SH.parcManual)return;
  const rec=SH.id?byId('honorarios',SH.id):null;
  const{res}=juntarParcelas(gerarParcelas(v),(rec&&rec.parcelas)||[]);SH.parc=res;
}
function parcHtml(v){
  const l=SH.parc||[],tot=somaParc(l),alvo=valorContrato(v);
  const faltaVenc=temFixo(v)&&Number(v.valor)>0&&!v.primeiroVenc&&!SH.parcManual;
  const faltaEnt=temEntrada(v)&&Number(v.entrada)>0&&!v.entradaVenc&&!SH.parcManual;
  const dif=alvo&&Math.abs(tot-alvo)>=0.01&&l.some(p=>p.desc!=='Êxito');
  const linhas=l.map((p,i)=>`<div class="pedit${p.pago?' pago':''}" data-pi="${i}">
      <input class="input" data-pf="desc" value="${esc(p.desc||'')}" aria-label="Descrição da parcela ${i+1}">
      <input class="input" type="date" data-pf="venc" value="${esc(p.venc||'')}" aria-label="Vencimento da parcela ${i+1}">
      <input class="input" type="number" step="0.01" min="0" inputmode="decimal" data-pf="valor" value="${p.valor===''||p.valor==null?'':esc(p.valor)}" aria-label="Valor da parcela ${i+1}">
      <label class="chk pchk"><input type="checkbox" data-pf="pago" ${p.pago?'checked':''}>Recebida</label>
      <input class="input" type="date" data-pf="pagoEm" value="${esc(p.pagoEm||'')}" aria-label="Data do recebimento" ${p.pago?'':'hidden'}>
      ${p.pago?'':`<button class="btn sm ghost" type="button" data-prem="${i}" aria-label="Remover parcela ${i+1}">Remover</button>`}
    </div>`).join('');
  return `<span class="lab">Parcelas (dá para mudar a data e o valor de cada uma)</span>
    ${faltaVenc?'<div class="banner warn" style="margin:6px 0">Informe o <b>vencimento da 1ª parcela</b> acima para o sistema montar as parcelas, ou adicione as parcelas à mão abaixo.</div>':''}
    ${faltaEnt?'<div class="banner warn" style="margin:6px 0">Informe o <b>vencimento da entrada</b>.</div>':''}
    ${l.length?`<div class="pedits">${linhas}</div>`:`<span class="hint">${temExito(v)&&!temFixo(v)&&!temEntrada(v)?'Só êxito: nenhuma parcela agora. Informe o valor do êxito quando souber.':'Nenhuma parcela ainda.'}</span>`}
    <div class="ptot"><span>Soma das parcelas</span><b class="money" id="parcTot">${brl(tot)}</b></div>
    <div id="parcDif">${dif?`<span class="hint warn">A soma é diferente do valor do contrato (${brl(alvo)}).</span>`:''}</div>
    <div class="acts" style="margin-top:6px"><button class="btn sm" type="button" id="parcAdd">+ Adicionar parcela</button>
      ${SH.parcManual?'<button class="btn sm ghost" type="button" id="parcRefaz">Refazer pelo valor e nº de parcelas</button>':''}</div>
    ${SH.parcManual?'<span class="hint">Você ajustou as parcelas à mão: mudar o valor ou o nº de parcelas acima não refaz a lista (use o botão acima).</span>':''}`;
}
function parcRender(v){const box=$('#parcBox');if(!box)return;box.innerHTML=parcHtml(v);}
function parcAtualizaTotais(){
  const v=collect(FORMS.honorarios.f),tot=somaParc(SH.parc||[]),alvo=valorContrato(v);
  const t=$('#parcTot');if(t)t.textContent=brl(tot);
  const d=$('#parcDif');if(d)d.innerHTML=alvo&&Math.abs(tot-alvo)>=0.01?`<span class="hint warn">A soma é diferente do valor do contrato (${brl(alvo)}).</span>`:'';
}
FORMS.honorarios.after=function(v){parcIniciar();parcRecalcular(v);parcRender(v);};
// as mudanças dentro da lista de parcelas não refazem o formulário inteiro (não perde o cursor)
['input','change'].forEach(ev=>document.addEventListener(ev,e=>{
  const row=e.target.closest&&e.target.closest('#parcBox [data-pi]');if(!row)return;
  e.stopPropagation();
  const i=Number(row.dataset.pi),k=e.target.dataset.pf,p=SH.parc&&SH.parc[i];if(!p||!k)return;
  if(k==='pago'){p.pago=e.target.checked;p.pagoEm=p.pago?(p.pagoEm||FIN_HOJE()):'';SH.parcManual=true;if(ev==='change')parcRender(collect(FORMS.honorarios.f));return;}
  p[k]=k==='valor'?(e.target.value===''?'':Math.round(Number(e.target.value)*100)/100):e.target.value;
  SH.parcManual=true;parcAtualizaTotais();
},true));
document.addEventListener('click',e=>{
  if(!e.target.closest)return;
  const v=()=>collect(FORMS.honorarios.f);
  if(e.target.closest('#parcAdd')){e.preventDefault();parcIniciar();const l=SH.parc;
    const ult=[...l].reverse().find(p=>p.venc&&p.desc!=='Êxito');
    const n=l.filter(p=>/^Parcela/.test(p.desc||'')).length+1;
    l.push({n,desc:`Parcela ${n}`,venc:ult?addMes(ult.venc,1):(v().primeiroVenc||FIN_HOJE()),valor:ult?ult.valor:''});
    SH.parcManual=true;parcRender(v());return;}
  const rm=e.target.closest('[data-prem]');if(rm){e.preventDefault();SH.parc.splice(Number(rm.dataset.prem),1);SH.parcManual=true;parcRender(v());return;}
  if(e.target.closest('#parcRefaz')){e.preventDefault();SH.parcManual=false;const x=v();parcRecalcular(x);parcRender(x);}
});
{
  const _bs=FORMS.honorarios.beforeSave;
  FORMS.honorarios.beforeSave=function(v,id){
    parcIniciar();
    if(!SH.parcManual){
      if(temFixo(v)&&Number(v.valor)>0&&!v.primeiroVenc){toast('Informe o vencimento da 1ª parcela (ou adicione as parcelas à mão).',5000);$('#f_primeiroVenc')&&$('#f_primeiroVenc').focus();return false;}
      if(temEntrada(v)&&Number(v.entrada)>0&&!v.entradaVenc){toast('Informe o vencimento da entrada.',5000);$('#f_entradaVenc')&&$('#f_entradaVenc').focus();return false;}
      if(v.modalidade==='entrada_parcelado'&&Number(v.valor)>0&&Number(v.valor)<=Number(v.entrada||0)){toast('O valor total precisa ser maior que a entrada.',5000);return false;}
      v.parcelasManuais=false;
      return _bs?_bs.call(this,v,id):undefined;
    }
    const l=clonaParc(SH.parc).filter(p=>p.venc||Number(p.valor));
    const ruim=l.findIndex(p=>!p.venc||!(Number(p.valor)>0));
    if(ruim>=0){toast(`Confira a parcela ${ruim+1}: precisa de data e valor maior que zero.`,5000);return false;}
    l.sort((a,b)=>(a.desc==='Êxito')-(b.desc==='Êxito')||a.venc.localeCompare(b.venc));
    v.parcelas=l.map((p,i)=>({...p,n:p.desc==='Êxito'?99:i+1,valor:Math.round(Number(p.valor)*100)/100,pago:!!p.pago,pagoEm:p.pago?(p.pagoEm||FIN_HOJE()):''}));
    v.parcelasManuais=true;
    if(v.parcelas.length&&v.parcelas.every(p=>p.pago)&&!temExito(v))v.status='quitado';
    else if(v.status==='quitado'&&v.parcelas.some(p=>!p.pago))v.status='ativo';
  };
}

/* ---------- contrato com as parcelas ---------- */
function resumoContrato(h){
  const ps=h.parcelas||[],tot=somaParc(ps),pago=somaParc(ps.filter(p=>p.pago)),abertas=ps.filter(p=>!p.pago);
  const atras=abertas.filter(p=>diffDias(p.venc)<0),prox=abertas.filter(p=>diffDias(p.venc)>=0).sort((a,b)=>a.venc.localeCompare(b.venc))[0];
  return{ps,tot,pago,saldo:Math.round((tot-pago)*100)/100,atras,prox,abertas};
}
function rowParcelaContrato(h,p,i){
  const[st,txt]=stParcela(p);
  return `<div class="cprow${p.pago?' soft':''}"><div class="cpm"><b>${esc(p.desc)}</b><span>${fmtD(p.venc)} · <span class="money">${brl(p.valor)}</span></span><span class="chip c-${st}">${esc(txt)}</span></div>
    <div class="cpa">${p.pago?`<button class="btn sm" data-recibo="${esc(h.id)}" data-i="${i}" type="button">Recibo</button><button class="btn sm ghost" data-pg="${esc(h.id)}" data-i="${i}" type="button">Desfazer</button>`
      :`<button class="btn sm" data-cobrar="${esc(h.id)}" data-i="${i}" type="button">Cobrar</button><button class="btn sm pri" data-pg="${esc(h.id)}" data-i="${i}" type="button">Recebido</button>`}</div></div>`;
}
rowContrato=function(h){
  const r=resumoContrato(h),pr=byId('processos',h.processoId);
  const semParc=!r.ps.length&&(temFixo(h)||temEntrada(h))&&h.status!=='cancelado';
  const chip=h.status==='quitado'?['c-ok','Quitado']:h.status==='cancelado'?['c-mute','Cancelado']:r.atras.length?['c-danger',`${r.atras.length} ${r.atras.length===1?'parcela atrasada':'parcelas atrasadas'}`]:['c-mute','Ativo'];
  const aberto=UI.ctrAberto===h.id;
  return `<div class="ctr">
    <div class="row click a-${pr?areaCls(pr.area):'adm'}" data-edit="honorarios" data-id="${esc(h.id)}" role="button" tabindex="0">
      <div class="main"><div class="t">${esc(nomeCli(h.clienteId))}</div>
        <div class="m">${esc(String(h.objeto||'').slice(0,140))}</div>
        <div class="m">${esc(modalNome(h.modalidade))}${temExito(h)&&h.percentual?' · êxito '+esc(h.percentual)+'%':''}${pr?' · <span class="mono">'+esc(pr.numero||'')+'</span>':''}</div>
        ${r.tot?`<div class="progress" aria-label="Recebido"><i style="width:${Math.min(100,Math.round(r.pago/r.tot*100))}%"></i></div>
          <div class="cnums"><span>Recebido <b class="money">${brl(r.pago)}</b></span><span>Falta <b class="money">${brl(r.saldo)}</b></span><span>Total <b class="money">${brl(r.tot)}</b></span></div>`:''}
        ${r.prox?`<div class="m">Próxima: ${esc(r.prox.desc.toLowerCase())} em ${fmtD(r.prox.venc)} · ${brl(r.prox.valor)}</div>`:''}
        ${semParc?'<div class="banner warn" style="margin-top:6px">Este contrato está sem parcelas: toque aqui e informe o vencimento da 1ª parcela.</div>':''}
        <div class="chips"><span class="chip ${chip[0]}">${chip[1]}</span>${temExito(h)&&!h.exitoValor?'<span class="chip c-warn">Êxito pendente</span>':''}</div></div>
    </div>
    <div class="cfoot">${r.ps.length?`<button class="btn sm" type="button" data-ctrver="${esc(h.id)}" aria-expanded="${aberto}">${aberto?'Esconder parcelas':`Ver parcelas (${r.ps.length})`}</button>`:''}<button class="btn sm" data-gerarcontrato="${esc(h.id)}" type="button">Gerar contrato</button></div>
    ${aberto?`<div class="cplist">${r.ps.map((p,i)=>rowParcelaContrato(h,p,i)).join('')}</div>`:''}
  </div>`;
};
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-ctrver]');if(!b)return;e.stopPropagation();UI.ctrAberto=UI.ctrAberto===b.dataset.ctrver?'':b.dataset.ctrver;body_();},true);

/* ---------- página do Financeiro ---------- */
const FIN_FILTROS=[['abertas','A receber'],['atrasadas','Atrasadas'],['mes','Este mês'],['recebidas','Recebidas'],['todas','Todas']];
function finMeses(all){
  const out=[],h=parseD(FIN_HOJE());
  for(let k=-2;k<=5;k++){const d=new Date(Date.UTC(h.getUTCFullYear(),h.getUTCMonth()+k,1)),m=ymd(d).slice(0,7);
    const prev=all.filter(x=>x.p.venc.slice(0,7)===m).reduce((s,x)=>s+x.p.valor,0);
    const rec=all.filter(x=>x.p.pago&&(x.p.pagoEm||x.p.venc).slice(0,7)===m).reduce((s,x)=>s+x.p.valor,0);
    const aberto=all.filter(x=>!x.p.pago&&x.p.venc.slice(0,7)===m).reduce((s,x)=>s+x.p.valor,0);
    out.push({m,nome:MESES[d.getUTCMonth()].slice(0,3)+'/'+String(d.getUTCFullYear()).slice(2),prev,rec,aberto,atual:k===0});}
  return out;
}
{
  const _tools=VIEWS.financeiro.tools;
  VIEWS.financeiro.body=function(){
    document.querySelectorAll('#segFin button').forEach(x=>x.classList.toggle('on',x.dataset.f===UI.finF));
    const all=parcelasTodas(),hoje=FIN_HOJE(),mes=hoje.slice(0,7),n=new Date();
    const abertas=all.filter(x=>!x.p.pago);
    const atras=abertas.filter(x=>diffDias(x.p.venc)<0),totAtras=atras.reduce((s,x)=>s+x.p.valor,0);
    const aReceberMes=abertas.filter(x=>x.p.venc.slice(0,7)===mes).reduce((s,x)=>s+x.p.valor,0);
    const receb=all.filter(x=>x.p.pago&&(x.p.pagoEm||'').slice(0,7)===mes).reduce((s,x)=>s+x.p.valor,0);
    const saldo=abertas.reduce((s,x)=>s+x.p.valor,0);
    const exitos=S.honorarios.filter(h=>h.status==='ativo'&&temExito(h)&&!h.exitoValor).length;
    const semParc=S.honorarios.filter(h=>h.status!=='cancelado'&&!(h.parcelas||[]).length&&(temFixo(h)||temEntrada(h)));
    let html=`<div class="stats">
      <div class="stat ${totAtras?'alert':''}"><span>Em atraso</span><b class="money">${brl(totAtras)}</b>${atras.length?`<small>${atras.length} ${atras.length===1?'parcela':'parcelas'}</small>`:''}</div>
      <div class="stat"><span>A receber em ${MESES[n.getMonth()]}</span><b class="money">${brl(aReceberMes)}</b></div>
      <div class="stat good"><span>Recebido em ${MESES[n.getMonth()]}</span><b class="money">${brl(receb)}</b></div>
      <div class="stat"><span>Falta receber (todos os contratos)</span><b class="money">${brl(saldo)}</b><small>${abertas.length} ${abertas.length===1?'parcela aberta':'parcelas abertas'}</small></div>
      <div class="stat"><span>Contratos ativos</span><b>${S.honorarios.filter(h=>h.status==='ativo').length}</b></div>
      <div class="stat"><span>Êxitos pendentes</span><b>${exitos}</b></div></div>`;
    if(semParc.length)html+=`<div class="banner warn" style="margin-bottom:10px">${semParc.length===1?'1 contrato está':semParc.length+' contratos estão'} sem parcelas (falta o vencimento): ${semParc.map(h=>`<a href="#" data-edit="honorarios" data-id="${esc(h.id)}">${esc(nomeCli(h.clienteId))}</a>`).join(', ')}.</div>`;
    if(!S.honorarios.length)return html+vazio('Nenhum contrato de honorários','Cadastre o modo de pagamento do cliente. As parcelas entram aqui e o robô avisa os vencimentos.','honorarios','+ Cadastrar contrato');
    if(UI.finF==='contratos'){
      const l=[...S.honorarios].sort((a,b)=>(a.status!=='ativo')-(b.status!=='ativo')||nomeCli(a.clienteId).localeCompare(nomeCli(b.clienteId),'pt-BR'));
      return html+`<div class="grid2">${l.map(rowContrato).join('')}</div>`;
    }
    const meses=finMeses(all),max=Math.max(1,...meses.map(m=>Math.max(m.prev,m.rec)));
    html+=`<details class="cf finmes" ${UI.finMesAberto?'open':''}><summary>Mês a mês</summary><div class="fmgrid" role="table" aria-label="Previsto e recebido por mês">
      <div class="fmh" role="row"><span>Mês</span><span>Previsto</span><span>Recebido</span><span>Em aberto</span></div>
      ${meses.map(m=>`<div class="fmr${m.atual?' atual':''}" role="row"><span>${m.nome}</span><span class="money">${brl(m.prev)}</span><span class="money good">${brl(m.rec)}</span><span class="money${m.aberto&&m.m<mes?' bad':''}">${brl(m.aberto)}</span>
        <i class="fmbar" aria-hidden="true"><b style="width:${Math.round(m.prev/max*100)}%"></b><em style="width:${Math.round(m.rec/max*100)}%"></em></i></div>`).join('')}</div></details>`;
    const f=UI.finPF||'abertas';
    html+=`<div class="seg" id="segFinP" style="margin:10px 0">${FIN_FILTROS.map(([k,l])=>`<button type="button" data-fp="${k}" class="${k===f?'on':''}">${l}</button>`).join('')}</div>`;
    let l=all;
    if(f==='abertas')l=abertas;else if(f==='atrasadas')l=atras;else if(f==='mes')l=all.filter(x=>x.p.venc.slice(0,7)===mes||(x.p.pagoEm||'').slice(0,7)===mes);else if(f==='recebidas')l=all.filter(x=>x.p.pago);
    l=[...l].sort((a,b)=>f==='recebidas'?(b.p.pagoEm||b.p.venc).localeCompare(a.p.pagoEm||a.p.venc):((!!a.p.pago)-(!!b.p.pago))||a.p.venc.localeCompare(b.p.venc));
    const tot=l.reduce((s,x)=>s+x.p.valor,0);
    html+=l.length?`<p class="hint" style="margin:0 0 6px">${l.length} ${l.length===1?'parcela':'parcelas'} · ${brl(tot)}</p><div class="list">${l.map(rowParcela).join('')}</div>`
      :vazio(f==='atrasadas'?'Nenhuma parcela atrasada':f==='recebidas'?'Nenhuma parcela recebida ainda':'Nenhuma parcela aqui',f==='abertas'?'Tudo recebido.':'');
    return html;
  };
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#segFinP [data-fp]');if(!b)return;UI.finPF=b.dataset.fp;body_();});
  document.addEventListener('toggle',e=>{if(e.target.classList&&e.target.classList.contains('finmes'))UI.finMesAberto=e.target.open;},true);
}
