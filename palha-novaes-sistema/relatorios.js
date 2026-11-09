'use strict';
/* =====================================================================
   Relatórios: financeiro, processos, prazos por pessoa, benefícios,
   júris e clientes novos
   ===================================================================== */
const REL={per:'12'};
const mesesAtras=n=>{const out=[];const d=new Date();d.setDate(1);for(let i=n-1;i>=0;i--){const x=new Date(d.getFullYear(),d.getMonth()-i,1);out.push(x.getFullYear()+'-'+pad(x.getMonth()+1));}return out;};
function inicioPeriodo(){const d=new Date();if(REL.per==='ano')return d.getFullYear()+'-01-01';if(REL.per==='tudo')return '0000-01-01';const x=new Date(d.getFullYear(),d.getMonth()-(Number(REL.per)-1),1);return x.getFullYear()+'-'+pad(x.getMonth()+1)+'-01';}
const rotMes=m=>MES[Number(m.slice(5))-1];
const rotMesAno=m=>MES[Number(m.slice(5))-1]+'/'+m.slice(0,4);
function colunas(meses,val,fmt){
  const vs=meses.map(val);const max=Math.max(1,...vs);const iMax=vs.indexOf(Math.max(...vs));const ult=vs.length-1;
  return `<div class="cols" role="img" aria-label="Gráfico por mês">${meses.map((m,i)=>{const v=vs[i];const rot=v&&(i===iMax||i===ult);return `<div class="c" title="${esc(rotMesAno(m))}: ${esc(fmt(v))}"><small>${rot?esc(fmt(v,true)):'&nbsp;'}</small><i style="height:${Math.round(v/max*100)}%"></i><em>${esc(rotMes(m))}</em></div>`;}).join('')}</div>`;
}
function barras(pares,fmt){
  pares=pares.filter(([,v])=>v>0);if(!pares.length)return '<span class="muted" style="font-size:13.5px">Nada no período.</span>';
  const max=Math.max(...pares.map(x=>x[1]));fmt=fmt||(v=>String(v));
  return `<div class="bars">${pares.map(([l,v])=>`<div class="bar" title="${esc(l)}: ${esc(fmt(v))}"><span>${esc(l)}</span><span class="tr"><span class="fi" style="width:${Math.max(2,Math.round(v/max*100))}%;display:block"></span></span><span class="vl">${esc(fmt(v))}</span></div>`).join('')}</div>`;
}
const contar=(l,f)=>{const o={};l.forEach(x=>{const k=f(x);if(k)o[k]=(o[k]||0)+1;});return Object.entries(o).sort((a,b)=>b[1]-a[1]);};
const brlCurto=(v,curto)=>curto&&v>=1000?'R$ '+(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:v>=10000?0:1})+' mil':brl(v);
function faseDe(p){return p.fasePrev||p.faseCrim||p.faseTrab||p.faseOutro||'';}
const ativoProc=p=>!/arquivad|encerrad|baixad|extint/i.test(faseDe(p));

VIEWS.relatorios={t:'Relatórios',
  tools(){return `<div class="sub">Números do escritório, calculados na hora com os dados cadastrados.</div><div class="tools"><div class="seg" id="segRel"><button data-p="6" type="button">6 meses</button><button data-p="12" type="button">12 meses</button><button data-p="ano" type="button">Este ano</button><button data-p="tudo" type="button">Tudo</button></div><button class="btn push" id="relImp" type="button">Imprimir</button></div>`;},
  bind(){$('#segRel').onclick=e=>{const b=e.target.closest('button');if(b){REL.per=b.dataset.p;body_();}};$('#relImp').onclick=()=>window.print();},
  body(){
    document.querySelectorAll('#segRel button').forEach(x=>x.classList.toggle('on',x.dataset.p===REL.per));
    const ini=inicioPeriodo(),hoje=hojeStr();const no=d=>d&&String(d).slice(0,10)>=ini&&String(d).slice(0,10)<=hoje;
    const nMeses=REL.per==='ano'?new Date().getMonth()+1:REL.per==='tudo'?12:Number(REL.per);const meses=mesesAtras(nMeses);
    // financeiro
    const parc=parcelasTodas();
    const recebidas=parc.filter(x=>x.p.pago&&no(x.p.pagoEm));
    const recebido=recebidas.reduce((s,x)=>s+Number(x.p.valor||0),0);
    const abertas=parc.filter(x=>!x.p.pago);
    const atrasado=abertas.filter(x=>x.p.venc<hoje).reduce((s,x)=>s+Number(x.p.valor||0),0);
    const aReceber=abertas.filter(x=>x.p.venc>=hoje).reduce((s,x)=>s+Number(x.p.valor||0),0);
    const porMes=m=>parc.filter(x=>x.p.pago&&String(x.p.pagoEm||'').slice(0,7)===m).reduce((s,x)=>s+Number(x.p.valor||0),0);
    const prox3=mesesAtras(1)[0];const futuros=[0,1,2].map(i=>{const d=new Date();const x=new Date(d.getFullYear(),d.getMonth()+i,1);return x.getFullYear()+'-'+pad(x.getMonth()+1);});
    const devedores=contar(abertas.filter(x=>x.p.venc<hoje),x=>nomeCli(x.h.clienteId)).map(([n])=>[n,abertas.filter(x=>x.p.venc<hoje&&nomeCli(x.h.clienteId)===n).reduce((s,x)=>s+Number(x.p.valor||0),0)]).sort((a,b)=>b[1]-a[1]).slice(0,8);
    // processos
    const procs=S.processos;const ativos=procs.filter(ativoProc);
    // prazos
    const cumpridoEm=p=>p.cumpridoEm||(p.cumprido?String(p.atualizadoEm||'').slice(0,10):'');
    const pz=S.prazos.map(p=>({p,r:prazoCalc(p)})).filter(x=>x.r);
    const cumpridosPer=pz.filter(x=>x.p.cumprido&&no(cumpridoEm(x.p)));
    const noPrazo=cumpridosPer.filter(x=>cumpridoEm(x.p)<=x.r.venc).length;
    const vencidosAbertos=pz.filter(x=>!x.p.cumprido&&x.r.venc<hoje);
    const pessoas=S.equipe.map(m=>{const meus=pz.filter(x=>x.p.responsavelId===m.id);return{m,abertos:meus.filter(x=>!x.p.cumprido).length,vencidos:meus.filter(x=>!x.p.cumprido&&x.r.venc<hoje).length,feitos:meus.filter(x=>x.p.cumprido&&no(cumpridoEm(x.p))).length,atraso:meus.filter(x=>x.p.cumprido&&no(cumpridoEm(x.p))&&cumpridoEm(x.p)>x.r.venc).length};}).filter(x=>x.abertos||x.feitos);
    // previdenciário, júri, clientes
    const concedidos=procs.filter(p=>p.area==='Previdenciário'&&no(p.dib));
    const atrasadosValor=concedidos.reduce((s,p)=>s+Number(p.atrasados||0),0);
    const juris=S.juri||[];const jurPer=juris.filter(j=>no(j.dataPlenario));const jurProx=juris.filter(j=>j.dataPlenario&&j.dataPlenario>hoje).sort((a,b)=>a.dataPlenario.localeCompare(b.dataPlenario));
    const cliNovos=S.clientes.filter(c=>no(c.criadoEm));
    const cliMes=m=>S.clientes.filter(c=>String(c.criadoEm||'').slice(0,7)===m).length;
    const kpi=(v,l,neg)=>`<div class="kpi"><b${neg?' style="color:var(--danger)"':''}>${v}</b><span>${l}</span></div>`;
    const card=(t,h,full)=>`<div class="rcard"${full?' style="grid-column:1/-1"':''}><h3>${t}</h3>${h}</div>`;
    return `<div class="kpis">
      ${kpi(brl(recebido),'Recebido no período')}${kpi(brl(aReceber),'A receber (parcelas futuras)')}${kpi(brl(atrasado),'Em atraso',atrasado>0)}
      ${kpi(ativos.length,'Processos ativos')}${kpi(cumpridosPer.length?Math.round(noPrazo/cumpridosPer.length*100)+'%':'—',`Prazos cumpridos em dia (${noPrazo} de ${cumpridosPer.length})`)}${kpi(cliNovos.length,'Clientes novos no período')}</div>
    <div class="rgrid">
      ${card('Honorários recebidos por mês',colunas(meses,porMes,(v,c)=>brlCurto(v,c))+`<span class="hint" style="display:block;margin-top:8px">${recebidas.length} ${recebidas.length===1?'parcela recebida':'parcelas recebidas'} no período.</span>`)}
      ${card('Previsto para os próximos meses',barras(futuros.map(m=>[rotMesAno(m)+(m===prox3?' (este mês)':''),abertas.filter(x=>String(x.p.venc).slice(0,7)===m).reduce((s,x)=>s+Number(x.p.valor||0),0)]),brl))}
      ${card('Quem está devendo (parcelas atrasadas)',barras(devedores,brl))}
      ${card('Processos ativos por área',barras(contar(ativos,p=>p.area||'Sem área')))}
      ${card('Processos ativos por fase',barras(contar(ativos,p=>faseDe(p)||'Fase não informada').slice(0,10)))}
      ${card('Prazos por pessoa',(pessoas.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>Pessoa</th><th>Abertos</th><th>Vencidos</th><th>Feitos</th><th>Com atraso</th></tr></thead><tbody>${pessoas.map(x=>`<tr><td>${esc(x.m.nome)}</td><td>${x.abertos}</td><td${x.vencidos?' style="color:var(--danger);font-weight:600"':''}>${x.vencidos}</td><td>${x.feitos}</td><td>${x.atraso}</td></tr>`).join('')}</tbody></table></div>`:'<span class="muted" style="font-size:13.5px">Nenhum prazo com responsável.</span>')+(vencidosAbertos.length?`<span class="hint" style="display:block;margin-top:8px;color:var(--danger)">${vencidosAbertos.length} ${vencidosAbertos.length===1?'prazo vencido continua aberto':'prazos vencidos continuam abertos'}.</span>`:''))}
      ${card('Benefícios concedidos no período',barras(contar(concedidos,p=>p.especie||'Espécie não informada'))+(atrasadosValor?`<span class="hint" style="display:block;margin-top:8px">Atrasados informados nesses processos: <b>${brl(atrasadosValor)}</b>.</span>`:''))}
      ${card('Tribunal do Júri',`<div class="kpis" style="margin-bottom:8px">${kpi(juris.length,'Casos no painel')}${kpi(jurPer.length,'Plenários no período')}</div>${jurProx.length?`<div class="list">${jurProx.slice(0,4).map(j=>`<div class="m">${fmtD(j.dataPlenario)} · ${esc(tituloJuri(j))}</div>`).join('')}</div>`:'<span class="muted" style="font-size:13.5px">Nenhum plenário marcado.</span>'}`)}
      ${card('Clientes novos por mês',colunas(meses,cliMes,v=>String(v)))}
    </div>`;
  }};
