'use strict';
/* =====================================================================
   Painel do Tribunal do Júri
   ===================================================================== */
(function(){
  const css=`
  .jhead{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:14px}
  .jhead .tt{flex:1;min-width:0}
  @media (max-width:640px){.jhead .tt{flex-basis:100%;order:2}.jhead .chip{order:3}}
  .jhead .tt b{font-family:var(--f-display);font-size:22px;font-weight:600;display:block;line-height:1.2;overflow-wrap:anywhere}
  .jtabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--line);margin-bottom:16px;scrollbar-width:thin}
  .jtabs button{border:0;background:none;padding:9px 12px;font-weight:600;font-size:14px;color:var(--muted);border-bottom:2px solid transparent;white-space:nowrap}
  .jtabs button.on{color:var(--accent);border-bottom-color:var(--accent)}
  .jgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .jgrid .full{grid-column:span 2}
  @media (max-width:640px){.jgrid{grid-template-columns:1fr}.jgrid .full{grid-column:span 1}}
  .jcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px}
  .jcard h3{font-size:12.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;margin-bottom:8px}
  .countdown{font-family:var(--f-display);font-size:34px;font-weight:600;line-height:1}
  .tese{display:flex;gap:10px;align-items:flex-start}
  .tese .ord{font-family:var(--f-display);font-size:20px;font-weight:600;color:var(--crim);width:26px;flex:none;text-align:center}
  .timer{display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 10px;border-radius:var(--r);background:var(--sunk)}
  .timer .big{font-family:var(--f-mono);font-size:54px;font-weight:500;font-variant-numeric:tabular-nums;line-height:1}
  .timer .big.warn{color:var(--warn)}.timer .big.danger{color:var(--danger)}
  .fases{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
  .fases button{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600}
  .fases button.on{background:var(--crim);border-color:var(--crim);color:#fff}
  .fases button small{font-family:var(--f-mono);font-weight:500;margin-left:4px;opacity:.8}
  .contador{display:flex;gap:10px;flex-wrap:wrap}
  .contador div{flex:1;min-width:110px;background:var(--sunk);border-radius:8px;padding:8px 10px}
  .contador b{font-family:var(--f-display);font-size:24px;display:block;line-height:1.1}
  .contador span{font-size:12px;color:var(--muted)}
  .jinline{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}`;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
})();

const JURI_TIPOS=['Fato','Prisão em flagrante','Audiência de custódia','Prisão preventiva','Inquérito policial','Denúncia','Citação','Resposta à acusação','Audiência de instrução','Pronúncia','Recurso em sentido estrito','Diligências (art. 422 do CPP)','Plenário do Júri','Sentença','Apelação','Outro'];
const TESE_TIPOS=['Principal','Subsidiária','Desclassificação','Privilegiadora / causa de diminuição','Afastar qualificadora','Preliminar / nulidade','Quesito específico','Dosimetria'];
const TESE_ST=['Em estudo','Vou usar','Descartada'];
const PROVA_TIPOS=['Laudo pericial','Laudo cadavérico / necropsia','Depoimento','Interrogatório','Reconhecimento','Perícia de local','Vídeo / áudio','Foto','Documento','Antecedentes / certidões','Outro'];
const POSICOES=['A favor da defesa','Contra a defesa','Neutra'];
const posCls=p=>p==='A favor da defesa'?'c-ok':p==='Contra a defesa'?'c-danger':'c-mute';
UI.juriId=UI.juriId||'';UI.juriAba=UI.juriAba||'resumo';UI.teseId='';UI.provaF='';

const ehJuriProc=pr=>pr&&pr.area==='Criminal'&&(/j[úu]ri/i.test((pr.faseCrim||'')+' '+(pr.vara||''))||/art\.?\s*121/i.test(pr.tipoPenal||''));
const juriDo=prId=>S.juri.find(j=>j.processoId===prId);
function tituloJuri(j){const pr=byId('processos',j.processoId),c=pr&&byId('clientes',pr.clienteId);return j.reus||(c&&c.nome)||'Caso sem nome';}
function acaoJuri(pr){
  if(!pr||pr.area!=='Criminal')return'';const j=juriDo(pr.id);
  if(j)return `<button class="btn sm pri" data-abrirjuri="${esc(j.id)}" type="button">Painel do júri</button>`;
  if(ehJuriProc(pr))return `<button class="btn sm" data-criarjuri="${esc(pr.id)}" type="button">Criar painel do júri</button>`;
  return'';
}
const novoId=()=>uid().slice(0,8);

/* grava sem recarregar a tela (para não atrapalhar quem está escrevendo).
   Busca a versão mais nova no banco antes de gravar, para não apagar o que um
   colega acabou de escrever em outra parte do mesmo júri. "patch" pode ser um
   objeto ou uma função que recebe a versão mais nova e devolve as mudanças. */
async function gravarJuri(id,patch,render){
  const r=byId('juri',id);if(!r)return false;
  try{
    let atual=r;
    const{data,error:e1}=await sb.from('juri').select('*').eq('id',id).maybeSingle();
    if(!e1&&data)atual=rowToRec(data);
    const mud=typeof patch==='function'?patch(atual):patch;if(!mud)return false;
    const novo={...atual,...mud};
    const{error}=await sb.from('juri').update({dados:limpa(novo),atualizado_em:new Date().toISOString()}).eq('id',id);if(error)throw error;
    Object.keys(r).forEach(k=>{if(!(k in novo))delete r[k];});Object.assign(r,novo);
  }catch(e){erroGravar(e);return false;}
  if(render!==false)body_();return true;
}
async function criarJuri(prId){
  const pr=byId('processos',prId),c=pr&&byId('clientes',pr.clienteId);
  const id=await salvar('juri',null,{processoId:prId||'',reus:c?c.nome:'',numReus:1,imputacao:pr?pr.tipoPenal||'':'',teses:[],provas:[],testemunhas:[],jurados:[],roteiro:'',notas:''});
  if(id){UI.juriId=id;UI.juriAba='resumo';location.hash='#juri';go('juri');toast('Painel do júri criado.');}
}

/* ---------- lista de casos ---------- */
function rowJuri(j){
  const pr=byId('processos',j.processoId);const dd=j.dataPlenario?diffDias(j.dataPlenario):null;
  const usar=(j.teses||[]).filter(t=>t.status==='Vou usar').length;
  return `<div class="row click a-crim" data-abrirjuri="${esc(j.id)}" role="button" tabindex="0">
    ${j.dataPlenario?`<div class="dateblk ${dd!==null&&dd>=0&&dd<=15?'warn':''}"><b>${parseD(j.dataPlenario).getUTCDate()}</b><span>${MES[parseD(j.dataPlenario).getUTCMonth()]}</span></div>`:'<div class="dateblk"><b>—</b><span>plenário</span></div>'}
    <div class="main"><div class="t">${esc(tituloJuri(j))}</div>
      <div class="m">${pr?`<span class="mono">${esc(pr.numero||'')}</span>`:'Sem processo vinculado'}${j.imputacao?' · '+esc(j.imputacao):''}</div>
      <div class="chips">${dd!==null?`<span class="chip ${dd<0?'c-mute':dd<=15?'c-warn':'c-mute'}">${dd<0?'Plenário realizado':dd===0?'Plenário hoje':`Plenário em ${dd} dias`}</span>`:'<span class="chip c-mute">Plenário sem data</span>'}${pr&&pr.reuPreso?'<span class="chip c-preso">Réu preso</span>':''}<span class="chip c-mute">${(j.teses||[]).length} teses${usar?` · ${usar} para usar`:''}</span><span class="chip c-mute">${(j.provas||[]).length} provas</span><span class="chip c-mute">${(j.testemunhas||[]).length} testemunhas</span></div></div></div>`;
}
VIEWS.juri={t:'Tribunal do Júri',
  tools(){if(UI.juriId&&byId('juri',UI.juriId))return'';return `<div class="sub">Um painel por caso: teses, provas, testemunhas, jurados, cronômetro dos debates e linha do tempo.</div><div class="tools"><button class="btn pri" data-novojuri type="button">+ Novo caso do júri</button></div>`;},
  body(){
    const j=UI.juriId&&byId('juri',UI.juriId);
    if(j)return painelJuri(j);
    UI.juriId='';
    const l=[...S.juri].sort((a,b)=>(a.dataPlenario||'9999').localeCompare(b.dataPlenario||'9999'));
    const sug=S.processos.filter(p=>ehJuriProc(p)&&!juriDo(p.id));
    return (l.length?`<div class="list">${l.map(rowJuri).join('')}</div>`:vazio('Nenhum caso do júri ainda','Crie o painel a partir de um processo criminal. Processos com fase “Tribunal do Júri” ou art. 121 aparecem aqui como sugestão.'))
      +(sug.length?`<div class="sec" style="margin-top:22px"><h2>Processos que parecem ser do júri</h2><div class="list">${sug.map(p=>`<div class="row a-crim"><div class="main"><div class="t mono">${esc(p.numero||'')}</div><div class="m">${esc(byId('clientes',p.clienteId)?.nome||'')} · ${esc(p.tipoPenal||p.faseCrim||'')}</div></div><div class="side"><button class="btn sm pri" data-criarjuri="${esc(p.id)}" type="button">Criar painel</button></div></div>`).join('')}</div></div>`:'');
  },
  after(){const j=UI.juriId&&byId('juri',UI.juriId);if(j)depoisDoPainel(j);}
};

/* ---------- painel de um caso ---------- */
const ABAS=[['resumo','Resumo'],['teses','Teses'],['provas','Provas e documentos'],['testemunhas','Testemunhas'],['tempo','Linha do tempo'],['plenario','Plenário'],['roteiro','Roteiro da sustentação']];
function painelJuri(j){
  const pr=byId('processos',j.processoId);const dd=j.dataPlenario?diffDias(j.dataPlenario):null;
  let corpo='';
  if(UI.juriAba==='resumo')corpo=abaResumo(j,pr);
  else if(UI.juriAba==='teses')corpo=UI.teseId?editorTese(j):abaTeses(j);
  else if(UI.juriAba==='provas')corpo=abaProvas(j);
  else if(UI.juriAba==='testemunhas')corpo=abaTestemunhas(j);
  else if(UI.juriAba==='tempo')corpo=abaTempo(j,pr);
  else if(UI.juriAba==='plenario')corpo=abaPlenario(j);
  else if(UI.juriAba==='roteiro')corpo=`<div id="edRoteiro"></div><p class="muted" style="font-size:13px">Salva sozinho enquanto você escreve. O corretor ortográfico sublinha as palavras erradas; clique com o botão direito (ou toque e segure) para ver as sugestões.</p>`;
  return `<div class="jhead"><button class="btn sm" data-voltarjuri type="button">‹ Casos</button>
      <div class="tt"><b>${esc(tituloJuri(j))}</b><span class="muted" style="font-size:13px">${pr?`<span class="mono">${esc(pr.numero||'')}</span> · ${esc(pr.vara||'')}`:'Sem processo vinculado'}</span></div>
      ${dd!==null?`<span class="chip ${dd<0?'c-mute':dd<=15?'c-warn':'c-mute'}">${dd<0?'Plenário realizado':dd===0?'Plenário hoje':`Plenário em ${dd} dias`}</span>`:''}${pr&&pr.reuPreso?'<span class="chip c-preso">Réu preso</span>':''}</div>
    <div class="jtabs" role="tablist">${ABAS.map(([k,l])=>`<button type="button" role="tab" data-jaba="${k}" class="${UI.juriAba===k?'on':''}" aria-selected="${UI.juriAba===k}">${l}</button>`).join('')}</div>
    ${corpo}`;
}
function depoisDoPainel(j){
  if(UI.juriAba==='roteiro'){const el=$('#edRoteiro');if(el)criarEditor(el,{html:j.roteiro,titulo:'Roteiro - '+tituloJuri(j),ph:'Abertura, narrativa dos fatos, análise das provas, teses na ordem em que serão apresentadas, quesitos, fechamento…',onChange:h=>gravarJuri(j.id,{roteiro:h},false)});}
  if(UI.juriAba==='teses'&&UI.teseId){const t=(j.teses||[]).find(x=>x.id===UI.teseId);const el=$('#edTese');if(t&&el)criarEditor(el,{html:t.texto,titulo:t.titulo||'Tese',ph:'Fundamentação: fatos, provas (com folhas), doutrina, jurisprudência e como explicar aos jurados em linguagem simples…',onChange:h=>salvarTese(j,t.id,{texto:h},false)});}
  if(UI.juriAba==='plenario')pintarTimer();
}
function campo(id,l,v,tipo,ph,half){return `<div class="fld${half?' half':''}"><label for="${id}">${l}</label><input class="input" id="${id}" type="${tipo||'text'}" value="${esc(v||'')}" placeholder="${esc(ph||'')}"></div>`;}
function abaResumo(j,pr){
  const prazos=pr?S.prazos.filter(p=>p.processoId===pr.id&&!p.cumprido).map(p=>({p,i:prazoInfo(p)})).filter(x=>x.i.r).sort((a,b)=>a.i.r.venc.localeCompare(b.i.r.venc)):[];
  const mv=pr&&S.movs[digits(pr.numero)];const dd=j.dataPlenario?diffDias(j.dataPlenario):null;
  const usar=(j.teses||[]).filter(t=>t.status==='Vou usar');
  return `<div class="jgrid">
    <div class="jcard"><h3>Plenário</h3>${dd!==null&&dd>=0?`<div class="countdown">${dd===0?'Hoje':dd+' dias'}</div><div class="muted" style="font-size:13px">${fmtDS(j.dataPlenario)}${j.horaPlenario?' às '+esc(j.horaPlenario):''}${j.local?' · '+esc(j.local):''}</div>`:`<div class="muted">${j.dataPlenario?'Realizado em '+fmtD(j.dataPlenario):'Data ainda não marcada.'}</div>`}</div>
    <div class="jcard"><h3>Teses para usar</h3>${usar.length?`<ol style="margin:0;padding-left:18px">${usar.map(t=>`<li>${esc(t.titulo||'Sem título')} <span class="muted" style="font-size:12.5px">(${esc(t.tipo||'')})</span></li>`).join('')}</ol>`:'<span class="muted">Marque teses como “Vou usar” na aba Teses.</span>'}</div>
    <div class="jcard full"><h3>Apresentação para os jurados</h3>${linkSeguro(j.canva)?`<div class="acts" style="margin:0"><a class="btn pri" href="${esc(linkSeguro(j.canva))}" target="_blank" rel="noopener noreferrer">Abrir apresentação no Canva</a><button class="btn" type="button" data-copiarlink="${esc(linkSeguro(j.canva))}">Copiar link</button></div><span class="hint" style="display:block;margin-top:6px">No Canva, use “Apresentar” para tela cheia no plenário. Para não depender da internet do fórum, baixe também em PDF ou PPTX pelo próprio Canva.</span>`:'<span class="muted">Cole o link do Canva em “Dados do caso”, logo abaixo, para abrir a apresentação daqui.</span>'}</div>
    <div class="jcard"><h3>Prazos abertos</h3>${prazos.length?prazos.slice(0,4).map(x=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:14px;padding:3px 0"><span>${esc(x.p.descricao)}</span><span class="chip c-${x.i.st}">${esc(x.i.txt)}</span></div>`).join(''):'<span class="muted">Nenhum prazo aberto.</span>'}</div>
    <div class="jcard"><h3>Última movimentação</h3>${mv&&mv.nome?`<div>${esc(mv.nome)}</div><div class="muted" style="font-size:13px">${fmtDT(mv.data)}</div>`:'<span class="muted">Sem dados do CNJ ainda.</span>'}</div>
    <div class="jcard full" data-semrecarga><h3>Dados do caso</h3><form class="pb" id="jResumo" style="padding:0" novalidate>
      <div class="fld"><label for="jr_proc">Processo</label><select class="input" id="jr_proc"><option value="">— Nenhum —</option>${S.processos.filter(p=>p.area==='Criminal'||p.id===j.processoId).map(p=>`<option value="${esc(p.id)}" ${p.id===j.processoId?'selected':''}>${esc(procLabel(p))}</option>`).join('')}</select></div>
      ${campo('jr_reus','Réu(s)',j.reus,'text','',1)}${campo('jr_num','Número de réus',j.numReus||1,'number','',1)}
      ${campo('jr_vit','Vítima(s)',j.vitima,'text','',1)}${campo('jr_imp','Imputação',j.imputacao,'text','Art. 121, § 2º, II e IV, do CP',1)}
      ${campo('jr_data','Data do plenário',j.dataPlenario,'date','',1)}${campo('jr_hora','Hora',j.horaPlenario,'time','',1)}
      ${campo('jr_local','Local',j.local,'text','Salão do Júri do Fórum Criminal')}
      ${campo('jr_canva','Link da apresentação (Canva)',j.canva,'url','https://www.canva.com/design/…')}
      ${campo('jr_juiz','Juiz(a) presidente',j.juiz,'text','',1)}${campo('jr_prom','Promotor(a)',j.promotor,'text','',1)}
      ${campo('jr_assist','Assistente de acusação',j.assistente,'text','',1)}${campo('jr_def','Defensores no plenário',j.defensores,'text','',1)}
      <div class="fld"><label for="jr_notas">Anotações gerais</label><textarea class="input" id="jr_notas" spellcheck="true" lang="pt-BR">${esc(j.notas||'')}</textarea></div>
      <div class="fld"><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between"><button class="btn danger" id="jr_del" type="button">Excluir painel</button><button class="btn pri" id="jr_ok" type="button">Salvar dados do caso</button></div><span class="hint">A data do plenário entra no calendário automaticamente.</span></div>
    </form></div></div>`;
}
async function salvarResumo(j){
  const v=id=>$('#'+id).value.trim();
  const patch={processoId:v('jr_proc'),reus:v('jr_reus'),numReus:Math.max(1,Number(v('jr_num'))||1),vitima:v('jr_vit'),imputacao:v('jr_imp'),dataPlenario:v('jr_data'),horaPlenario:v('jr_hora'),local:v('jr_local'),juiz:v('jr_juiz'),promotor:v('jr_prom'),assistente:v('jr_assist'),defensores:v('jr_def'),canva:normLink(v('jr_canva')),notas:$('#jr_notas').value};
  if(patch.canva&&!linkSeguro(patch.canva))return toast('O link da apresentação precisa começar com https://');
  // plenário no calendário
  const pr=byId('processos',patch.processoId);let evId=j.eventoId&&byId('eventos',j.eventoId)?j.eventoId:'';
  if(patch.dataPlenario){
    const ev={titulo:'Plenário do Júri — '+(patch.reus||'réu'),tipo:'Plenário do Júri',data:patch.dataPlenario,hora:patch.horaPlenario,local:patch.local,processoId:patch.processoId,clienteId:pr?pr.clienteId:'',responsavelId:pr?pr.responsavelId:'',juriId:j.id};
    if(evId)await salvar('eventos',evId,{...byId('eventos',evId),...ev});else evId=await salvar('eventos',null,ev)||'';
  }else if(evId){await excluir('eventos',evId);evId='';}
  patch.eventoId=evId;
  if(await gravarJuri(j.id,patch))toast('Dados do caso salvos.');
}

/* teses */
function abaTeses(j){
  const l=j.teses||[];const ordem=t=>t.status==='Vou usar'?0:t.status==='Em estudo'?1:2;
  const ts=[...l].sort((a,b)=>ordem(a)-ordem(b)||(a.ordem||0)-(b.ordem||0));
  return `<div class="tools" style="margin-bottom:12px"><span class="muted" style="font-size:13.5px">Ordene as teses na sequência em que vai sustentar. Toque para escrever a fundamentação.</span><button class="btn pri push" data-novatese type="button">+ Nova tese</button></div>
  ${ts.length?`<div class="list">${ts.map((t,i)=>{const pv=(t.provas||[]).length;const pal=contarPalavras(htmlParaTexto(t.texto||''));
    return `<div class="row click a-crim ${t.status==='Descartada'?'soft':''}" data-abrirtese="${esc(t.id)}" role="button" tabindex="0"><div class="main"><div class="tese"><span class="ord">${t.status==='Vou usar'?i+1:'·'}</span><div style="min-width:0;flex:1">
      <div class="t">${esc(t.titulo||'Tese sem título')}</div>
      <div class="m">${esc(htmlParaTexto(t.texto||'').slice(0,160))||'Sem fundamentação ainda.'}</div>
      <div class="chips"><span class="chip c-crim">${esc(t.tipo||'')}</span><span class="chip ${t.status==='Vou usar'?'c-ok':t.status==='Descartada'?'c-mute':'c-warn'}">${esc(t.status||'')}</span>${pv?`<span class="chip c-mute">${pv} ${pv===1?'prova':'provas'}</span>`:''}<span class="chip c-mute">${pal} palavras</span></div></div>
      ${t.status==='Vou usar'?`<div class="mv"><button data-moverTese="${esc(t.id)}" data-d="-1" type="button" aria-label="Subir">↑</button><button data-moverTese="${esc(t.id)}" data-d="1" type="button" aria-label="Descer">↓</button></div>`:''}</div></div></div>`;}).join('')}</div>`
  :vazio('Nenhuma tese ainda','Ex.: legítima defesa, negativa de autoria, desclassificação para lesão corporal, afastar a qualificadora do motivo fútil.')}`;
}
function editorTese(j){
  const t=(j.teses||[]).find(x=>x.id===UI.teseId);if(!t){UI.teseId='';return abaTeses(j);}
  const provas=j.provas||[];
  return `<div class="tools" style="margin-bottom:12px"><button class="btn sm" data-fechartese type="button">‹ Todas as teses</button><button class="btn sm danger push" data-deltese="${esc(t.id)}" type="button">Excluir tese</button></div>
  <div class="jgrid" style="margin-bottom:12px">
    <div class="fld full"><label for="ts_tit">Tese</label><input class="input" id="ts_tit" value="${esc(t.titulo||'')}" placeholder="Legítima defesa própria" style="font-size:17px;font-weight:600"></div>
    <div class="fld"><label for="ts_tipo">Tipo</label><select class="input" id="ts_tipo">${TESE_TIPOS.map(x=>`<option ${x===t.tipo?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="fld"><label for="ts_st">Situação</label><select class="input" id="ts_st">${TESE_ST.map(x=>`<option ${x===t.status?'selected':''}>${x}</option>`).join('')}</select></div>
  </div>
  <div id="edTese"></div>
  <div class="jcard" style="margin-top:12px"><h3>Provas que sustentam esta tese</h3>${provas.length?`<div class="multi">${provas.map(p=>`<label class="chk"><input type="checkbox" data-tsprova="${esc(p.id)}" ${(t.provas||[]).includes(p.id)?'checked':''}>${esc(p.titulo||'Prova')}${p.folhas?` <span class="muted" style="font-size:13px">(fls. ${esc(p.folhas)})</span>`:''} <span class="chip ${posCls(p.posicao)}">${esc(p.posicao||'')}</span></label>`).join('')}</div>`:'<span class="muted">Cadastre as provas na aba “Provas e documentos” para ligar a esta tese.</span>'}</div>`;
}
async function salvarTese(j,id,patch,render){
  return gravarJuri(j.id,a=>({teses:(a.teses||[]).map(t=>t.id===id?{...t,...patch,atualizadoEm:new Date().toISOString()}:t)}),render);
}

/* provas */
function abaProvas(j){
  const l=(j.provas||[]).filter(p=>!UI.provaF||p.posicao===UI.provaF);
  const cont=k=>(j.provas||[]).filter(p=>p.posicao===k).length;
  return `<div class="tools" style="margin-bottom:12px"><div class="seg" id="segProva"><button data-p="" type="button" class="${!UI.provaF?'on':''}">Todas</button>${POSICOES.map(p=>`<button data-p="${p}" type="button" class="${UI.provaF===p?'on':''}">${p.replace(' da defesa','')} (${cont(p)})</button>`).join('')}</div><button class="btn pri push" data-novaprova type="button">+ Prova ou documento</button></div>
  ${l.length?`<div class="list">${l.map(p=>`<div class="row click ${p.posicao==='A favor da defesa'?'a-prev':p.posicao==='Contra a defesa'?'a-crim':''}" data-abrirprova="${esc(p.id)}" role="button" tabindex="0"><div class="main">
    <div class="t">${esc(p.titulo||'Prova')}</div>
    <div class="m">${esc(p.tipo||'')}${p.folhas?' · fls./ID '+esc(p.folhas):''}</div>
    ${p.resumo?`<div class="m">${esc(p.resumo.slice(0,220))}${p.resumo.length>220?'…':''}</div>`:''}
    <div class="chips"><span class="chip ${posCls(p.posicao)}">${esc(p.posicao||'')}</span>${p.arquivo?'<span class="chip c-mute">Arquivo anexado</span>':''}${(j.teses||[]).filter(t=>(t.provas||[]).includes(p.id)).map(t=>`<span class="chip c-crim">${esc(t.titulo||'tese')}</span>`).join('')}</div></div>
    ${p.arquivo?`<div class="side"><button class="btn sm" data-verprova="${esc(p.arquivo)}" type="button">Ver</button></div>`:''}</div>`).join('')}</div>`
  :vazio('Nenhuma prova cadastrada','Laudos, depoimentos, vídeos, fotos e documentos, com as folhas dos autos e se ajudam ou atrapalham a defesa.')}`;
}
function abrirItem(j,lista,id,campos,titulo){
  const rec=id?(j[lista]||[]).find(x=>x.id===id):{};const sh=$('#sheet');SH={col:'__juri',files:{}};let arquivo=rec&&rec.arquivo||'';
  const html=campos.map(c=>{const v=rec?rec[c.k]:'';
    if(c.t==='select')return `<div class="fld${c.half?' half':''}"><label for="ji_${c.k}">${c.l}</label><select class="input" id="ji_${c.k}">${c.o.map(o=>`<option ${o===(v||c.def)?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
    if(c.t==='area')return `<div class="fld"><label for="ji_${c.k}">${c.l}</label><textarea class="input" id="ji_${c.k}" spellcheck="true" lang="pt-BR" style="min-height:110px">${esc(v||'')}</textarea></div>`;
    if(c.t==='file')return `<div class="fld"><span class="lab">${c.l}</span><div class="filebox"><span class="nm" id="jiArqNm">${arquivo?'Arquivo anexado':'Nenhum arquivo'}</span><button class="btn sm" id="jiArq" type="button">${arquivo?'Trocar':'Anexar'}</button></div></div>`;
    return `<div class="fld${c.half?' half':''}"><label for="ji_${c.k}">${c.l}</label><input class="input" id="ji_${c.k}" value="${esc(v||'')}" placeholder="${esc(c.ph||'')}"></div>`;}).join('');
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="jiT"><div class="ph"><h3 id="jiT">${esc(titulo)}</h3><button class="btn ghost sm" id="jiX" type="button">Fechar</button></div>
    <form class="pb" novalidate>${html}</form>
    <div class="pf">${id?'<button class="btn danger" id="jiDel" type="button">Excluir</button>':''}<div class="r"><button class="btn" id="jiC" type="button">Cancelar</button><button class="btn pri" id="jiS" type="button">Salvar</button></div></div></div>`;
  sh.hidden=false;
  $('#jiX').onclick=$('#jiC').onclick=closeForm;
  const ab=$('#jiArq');if(ab)ab.onclick=async()=>{const f=await escolherArquivo('image/*,application/pdf,video/*,audio/*');if(!f)return;ab.disabled=true;ab.textContent='Enviando…';const p=await enviarArquivo(f,`juri/${j.id}`);ab.disabled=false;ab.textContent='Trocar';if(p){arquivo=p;$('#jiArqNm').textContent='Arquivo anexado (salve para gravar)';}};
  $('#jiS').onclick=async()=>{
    const v={};campos.forEach(c=>{if(c.t==='file')return;const el=$('#ji_'+c.k);if(el)v[c.k]=el.value.trim();});
    if(!v[campos[0].k])return toast(`Preencha “${campos[0].l}”.`);
    if(campos.some(c=>c.t==='file'))v.arquivo=arquivo;
    const nid=novoId();
    if(await gravarJuri(j.id,a=>{const atual=a[lista]||[];return{[lista]:id?atual.map(x=>x.id===id?{...x,...v}:x):[...atual,{id:nid,...v}]};})){closeForm();toast('Salvo.');}
  };
  const del=$('#jiDel');if(del){let armed=false;del.onclick=async()=>{if(!armed){armed=true;del.textContent='Toque de novo para excluir';setTimeout(()=>{armed=false;if(del.isConnected)del.textContent='Excluir';},4000);return;}
    const patch=a=>{const p={[lista]:(a[lista]||[]).filter(x=>x.id!==id)};if(lista==='provas')p.teses=(a.teses||[]).map(t=>({...t,provas:(t.provas||[]).filter(x=>x!==id)}));return p;};
    if(await gravarJuri(j.id,patch)){closeForm();toast('Excluído.');}};}
}
const CAMPOS_PROVA=[{k:'titulo',l:'Prova ou documento',ph:'Laudo de necropsia'},{k:'tipo',l:'Tipo',t:'select',o:PROVA_TIPOS,half:1},{k:'folhas',l:'Folhas / ID nos autos',ph:'fls. 45-52 ou ID 123456',half:1},{k:'posicao',l:'Para a defesa, ela é…',t:'select',o:POSICOES,def:'Neutra'},{k:'resumo',l:'O que ela mostra / como usar no plenário',t:'area'},{k:'arquivo',l:'Arquivo',t:'file'}];
const CAMPOS_TEST=[{k:'nome',l:'Nome'},{k:'arroladaPor',l:'Arrolada por',t:'select',o:['Defesa','Acusação','Juízo'],half:1},{k:'situacao',l:'Situação',t:'select',o:['A ouvir em plenário','Ouvida','Dispensada','Não localizada'],half:1},{k:'contato',l:'Contato / endereço',ph:'Telefone ou endereço para intimação'},{k:'disse',l:'O que já disse (inquérito e instrução)',t:'area'},{k:'perguntas',l:'Perguntas para fazer em plenário',t:'area'}];

/* testemunhas */
function abaTestemunhas(j){
  const l=j.testemunhas||[];const g=k=>l.filter(t=>t.arroladaPor===k);
  const bloco=(k)=>{const x=g(k);return x.length?`<div class="sec"><h2>${k==='Juízo'?'Do juízo':'Da '+k.toLowerCase()} (${x.length})</h2><div class="list">${x.map(t=>`<div class="row click ${k==='Defesa'?'a-prev':k==='Acusação'?'a-crim':''}" data-abrirtest="${esc(t.id)}" role="button" tabindex="0"><div class="main"><div class="t">${esc(t.nome)}</div>${t.contato?`<div class="m">${esc(t.contato)}</div>`:''}${t.disse?`<div class="m">${esc(t.disse.slice(0,200))}${t.disse.length>200?'…':''}</div>`:''}<div class="chips"><span class="chip ${t.situacao==='Ouvida'?'c-ok':t.situacao==='A ouvir em plenário'?'c-warn':'c-mute'}">${esc(t.situacao||'')}</span>${t.perguntas?'<span class="chip c-mute">Perguntas preparadas</span>':''}</div></div></div>`).join('')}</div></div>`:'';};
  return `<div class="tools" style="margin-bottom:12px"><span class="muted" style="font-size:13.5px">No plenário, cada parte pode arrolar até 5 testemunhas (art. 422 do CPP).</span><button class="btn pri push" data-novatest type="button">+ Testemunha</button></div>
  ${l.length?bloco('Defesa')+bloco('Acusação')+bloco('Juízo'):vazio('Nenhuma testemunha cadastrada','Anote o que cada uma já disse e as perguntas que você quer fazer.')}`;
}

/* linha do tempo do caso */
function abaTempo(j,pr){
  TL_TIPOS=JURI_TIPOS;
  const it=[];const pid=j.processoId;
  S.eventos.filter(e=>(pid&&e.processoId===pid)||e.juriId===j.id).forEach(e=>it.push({data:e.data,titulo:e.titulo||e.tipo,sub:[e.tipo!==e.titulo?e.tipo:'',e.hora,e.local,e.descricao].filter(Boolean).join(' · '),cor:/Plenário/.test(e.tipo)?'jud':/Prisão|Denúncia|Pronúncia/.test(e.tipo)?'neg':/Fato/.test(e.tipo)?'ac':'adm',abrir:{tipo:'evento',id:e.id}}));
  if(pid){
    S.prazos.filter(p=>p.processoId===pid).forEach(p=>{const i=prazoInfo(p);if(i.r)it.push({data:i.r.venc,titulo:'Prazo: '+(p.descricao||''),sub:p.cumprido?'Cumprido':i.txt,cor:p.cumprido?'ok':'pz',abrir:{tipo:'prazo',id:p.id}});});
    S.intimacoes.filter(x=>x.processo_id===pid||digits(x.numero)===digits(pr&&pr.numero)).forEach(x=>it.push({data:x.data_disponibilizacao,titulo:'Intimação: '+(x.tipo_documento||x.tipo||'publicação'),sub:String(x.texto||'').slice(0,160),cor:'mute'}));
    const mv=pr&&S.movs[digits(pr.numero)];if(mv&&mv.data)it.push({data:String(mv.data).slice(0,10),titulo:'Movimentação: '+mv.nome,sub:'Fonte: DataJud/CNJ',cor:'mute'});
  }
  return `<div class="tools" style="margin-bottom:14px"><span class="muted" style="font-size:13.5px">Fatos, prisão, denúncia, pronúncia, plenário… Prazos e intimações do processo entram sozinhos.</span><button class="btn pri push" data-novoevjuri type="button">+ Evento</button></div>${linhaDoTempoHTML(it,'Comece pela data do fato e da prisão.')}`;
}

/* plenário: jurados e cronômetro */
const TIMER={id:'',fase:'acusacao',rest:{},rodando:false,ult:0,int:null,lock:null};
function limites(j){const n=Number(j.numReus)||1;const deb=(n>1?150:90)*60,rep=(n>1?120:60)*60;return{acusacao:deb,defesa:deb,replica:rep,treplica:rep};}
const FASES=[['acusacao','Acusação'],['defesa','Defesa'],['replica','Réplica'],['treplica','Tréplica']];
const hms=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+':':'')+pad(m)+':'+pad(x);};
function abaPlenario(j){
  if(TIMER.id!==j.id){Object.assign(TIMER,{id:j.id,fase:'acusacao',rest:limites(j),rodando:false});}
  const jur=j.jurados||[];const rd=jur.filter(x=>x.decisao==='Recusado pela defesa').length,ra=jur.filter(x=>x.decisao==='Recusado pela acusação').length,ac=jur.filter(x=>x.decisao==='Aceito').length;
  const n=Number(j.numReus)||1;
  return `<div class="jgrid">
    ${linkSeguro(j.canva)?`<div class="jcard full"><div class="acts" style="margin:0;align-items:center"><a class="btn pri" href="${esc(linkSeguro(j.canva))}" target="_blank" rel="noopener noreferrer">Abrir apresentação no Canva</a><span class="muted" style="font-size:13px">Abre numa nova aba; o cronômetro continua rodando aqui.</span></div></div>`:''}
    <div class="jcard full" data-semrecarga><h3>Cronômetro dos debates (art. 477 do CPP${n>1?' · mais de um réu':''})</h3>
      <div class="timer"><div class="fases" id="tmFases">${FASES.map(([k,l])=>`<button type="button" data-tmfase="${k}" class="${TIMER.fase===k?'on':''}">${l}<small id="tmr_${k}">${hms(TIMER.rest[k])}</small></button>`).join('')}</div>
        <div class="big" id="tmBig">${hms(TIMER.rest[TIMER.fase])}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn pri" id="tmGo" type="button">${TIMER.rodando?'Pausar':'Iniciar'}</button><button class="btn" data-tmadd="-60" type="button">−1 min</button><button class="btn" data-tmadd="60" type="button">+1 min</button><button class="btn ghost" id="tmZera" type="button">Zerar tudo</button></div>
        <span class="hint">Debates: ${n>1?'2h30':'1h30'} para cada parte · réplica e tréplica: ${n>1?'2h':'1h'}. Fica amarelo nos últimos 10 minutos e vermelho nos últimos 5.</span></div></div>
    <div class="jcard full"><h3>Jurados e recusas (art. 468 do CPP)</h3>
      <div class="contador"><div><b>${ac}/7</b><span>Conselho de Sentença</span></div><div><b style="color:${rd>=3?'var(--danger)':'inherit'}">${rd}/3</b><span>Recusas da defesa</span></div><div><b>${ra}/3</b><span>Recusas da acusação</span></div><div><b>${jur.length}</b><span>Jurados sorteados</span></div></div>
      <div class="tools" style="margin:12px 0"><span class="muted" style="font-size:13px">Cadastre a lista dos 25 jurados e anote o que souber de cada um.</span><button class="btn pri push" data-novojurado type="button">+ Jurado</button></div>
      ${jur.length?`<div class="list">${jur.map(x=>`<div class="row ${x.decisao==='Aceito'?'a-prev':/Recusado/.test(x.decisao||'')?'soft':''}"><div class="main"><div class="jinline"><div style="min-width:0"><div class="t">${esc(x.nome)}</div><div class="m">${[x.profissao,x.idade?x.idade+' anos':'',x.obs].filter(Boolean).map(esc).join(' · ')}</div></div>
        <select class="input" data-jdec="${esc(x.id)}" aria-label="Decisão sobre ${esc(x.nome)}" style="width:auto">${['—','Aceito','Recusado pela defesa','Recusado pela acusação','Dispensado'].map(o=>`<option ${o===(x.decisao||'—')?'selected':''}>${o}</option>`).join('')}</select></div>
        <div class="acts"><button class="btn sm ghost" data-editjurado="${esc(x.id)}" type="button">Editar</button></div></div></div>`).join('')}</div>`:vazio('Nenhum jurado cadastrado','A lista de jurados sorteados sai alguns dias antes do plenário.')}
    </div></div>`;
}
function pintarTimer(){
  const big=$('#tmBig');if(!big)return;const r=TIMER.rest[TIMER.fase];
  big.textContent=hms(r);big.className='big'+(r<=300?' danger':r<=600?' warn':'');
  FASES.forEach(([k])=>{const e=$('#tmr_'+k);if(e)e.textContent=hms(TIMER.rest[k]);});
  const g=$('#tmGo');if(g)g.textContent=TIMER.rodando?'Pausar':'Iniciar';
}
function tick(){if(!TIMER.rodando)return;const n=Date.now();TIMER.rest[TIMER.fase]=Math.max(0,TIMER.rest[TIMER.fase]-(n-TIMER.ult)/1000);TIMER.ult=n;if(TIMER.rest[TIMER.fase]<=0){TIMER.rodando=false;toast('Tempo esgotado.');}pintarTimer();}
function timerGo(){
  TIMER.rodando=!TIMER.rodando;TIMER.ult=Date.now();clearInterval(TIMER.int);
  if(TIMER.rodando){TIMER.int=setInterval(tick,500);try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(l=>TIMER.lock=l).catch(()=>{});}catch(e){}}
  else{try{TIMER.lock&&TIMER.lock.release();}catch(e){}}
  pintarTimer();
}
const CAMPOS_JURADO=[{k:'nome',l:'Nome'},{k:'profissao',l:'Profissão',half:1},{k:'idade',l:'Idade',half:1},{k:'obs',l:'Observações (perfil, já serviu antes, vínculos…)',t:'area'}];

/* ---------- cliques ---------- */
document.addEventListener('click',async e=>{
  if(e.target.closest('#sheet .panel'))return;
  const q=s=>e.target.closest(s);let t;
  const j=UI.juriId&&byId('juri',UI.juriId);
  if(q('[data-novojuri]')){e.stopPropagation();novoCasoJuri();return;}
  if(t=q('[data-criarjuri]')){e.stopPropagation();criarJuri(t.dataset.criarjuri);return;}
  if(t=q('[data-abrirjuri]')){e.stopPropagation();UI.juriId=t.dataset.abrirjuri;UI.juriAba='resumo';UI.teseId='';if(location.hash!=='#juri')location.hash='#juri';else go('juri');return;}
  if(q('[data-voltarjuri]')){e.stopPropagation();UI.juriId='';UI.teseId='';go('juri');return;}
  if(t=q('[data-jaba]')){e.stopPropagation();UI.juriAba=t.dataset.jaba;UI.teseId='';body_();return;}
  if(!j)return;
  if(q('#jr_ok')){e.stopPropagation();salvarResumo(j);return;}
  if(t=q('#jr_del')){e.stopPropagation();if(!t.dataset.armed){t.dataset.armed='1';t.textContent='Toque de novo para excluir o painel';setTimeout(()=>{if(t.isConnected){delete t.dataset.armed;t.textContent='Excluir painel';}},4000);return;}
    if(j.eventoId&&byId('eventos',j.eventoId))await excluir('eventos',j.eventoId);if(await excluir('juri',j.id)){UI.juriId='';go('juri');toast('Painel excluído.');}return;}
  if(q('[data-novatese]')){e.stopPropagation();const nt={id:novoId(),titulo:'',tipo:'Principal',status:'Em estudo',texto:'',provas:[],ordem:(j.teses||[]).length};if(await gravarJuri(j.id,a=>({teses:[...(a.teses||[]),{...nt,ordem:(a.teses||[]).length}]}),false)){UI.teseId=nt.id;body_();setTimeout(()=>$('#ts_tit')&&$('#ts_tit').focus(),60);}return;}
  if(t=q('[data-moverTese]')){e.stopPropagation();const usar=(j.teses||[]).filter(x=>x.status==='Vou usar').sort((a,b)=>(a.ordem||0)-(b.ordem||0));const i=usar.findIndex(x=>x.id===t.dataset.movertese);const k=i+Number(t.dataset.d);if(k<0||k>=usar.length)return;[usar[i],usar[k]]=[usar[k],usar[i]];const ord={};usar.forEach((x,n)=>ord[x.id]=n);gravarJuri(j.id,a=>({teses:(a.teses||[]).map(x=>x.id in ord?{...x,ordem:ord[x.id]}:x)}));return;}
  if(t=q('[data-abrirtese]')){e.stopPropagation();UI.teseId=t.dataset.abrirtese;body_();return;}
  if(q('[data-fechartese]')){e.stopPropagation();UI.teseId='';body_();return;}
  if(t=q('[data-deltese]')){e.stopPropagation();if(!t.dataset.armed){t.dataset.armed='1';t.textContent='Toque de novo para excluir';setTimeout(()=>{if(t.isConnected){delete t.dataset.armed;t.textContent='Excluir tese';}},4000);return;}
    const did=t.dataset.deltese;UI.teseId='';gravarJuri(j.id,a=>({teses:(a.teses||[]).filter(x=>x.id!==did)}));return;}
  if(t=q('#segProva button')){e.stopPropagation();UI.provaF=t.dataset.p;body_();return;}
  if(q('[data-novaprova]')){e.stopPropagation();abrirItem(j,'provas',null,CAMPOS_PROVA,'Nova prova ou documento');return;}
  if(t=q('[data-verprova]')){e.stopPropagation();abrirArquivo(t.dataset.verprova);return;}
  if(t=q('[data-abrirprova]')){e.stopPropagation();abrirItem(j,'provas',t.dataset.abrirprova,CAMPOS_PROVA,'Prova ou documento');return;}
  if(q('[data-novatest]')){e.stopPropagation();abrirItem(j,'testemunhas',null,CAMPOS_TEST,'Nova testemunha');return;}
  if(t=q('[data-abrirtest]')){e.stopPropagation();abrirItem(j,'testemunhas',t.dataset.abrirtest,CAMPOS_TEST,'Testemunha');return;}
  if(q('[data-novojurado]')){e.stopPropagation();abrirItem(j,'jurados',null,CAMPOS_JURADO,'Novo jurado');return;}
  if(t=q('[data-editjurado]')){e.stopPropagation();abrirItem(j,'jurados',t.dataset.editjurado,CAMPOS_JURADO,'Jurado');return;}
  if(q('[data-novoevjuri]')){e.stopPropagation();const pr=byId('processos',j.processoId);abrirEvento(null,{tipo:'Fato',processoId:j.processoId||'',responsavelId:pr?pr.responsavelId:'',juriId:j.id},JURI_TIPOS);return;}
  if(t=q('[data-tmfase]')){e.stopPropagation();TIMER.fase=t.dataset.tmfase;TIMER.ult=Date.now();document.querySelectorAll('[data-tmfase]').forEach(b=>b.classList.toggle('on',b===t));pintarTimer();return;}
  if(q('#tmGo')){e.stopPropagation();timerGo();return;}
  if(t=q('[data-tmadd]')){e.stopPropagation();TIMER.rest[TIMER.fase]=Math.max(0,TIMER.rest[TIMER.fase]+Number(t.dataset.tmadd));pintarTimer();return;}
  if(q('#tmZera')){e.stopPropagation();TIMER.rodando=false;clearInterval(TIMER.int);TIMER.rest=limites(j);pintarTimer();return;}
},true);
document.addEventListener('change',e=>{
  const j=UI.juriId&&byId('juri',UI.juriId);if(!j)return;
  if(e.target.dataset.jdec){const id=e.target.dataset.jdec,val=e.target.value;
    const jur=(j.jurados||[]);const rd=jur.filter(x=>x.id!==id&&x.decisao==='Recusado pela defesa').length,ra=jur.filter(x=>x.id!==id&&x.decisao==='Recusado pela acusação').length,ac=jur.filter(x=>x.id!==id&&x.decisao==='Aceito').length;
    if(val==='Recusado pela defesa'&&rd>=3)toast('A defesa já usou as 3 recusas imotivadas.');
    if(val==='Recusado pela acusação'&&ra>=3)toast('A acusação já usou as 3 recusas imotivadas.');
    if(val==='Aceito'&&ac>=7)toast('O Conselho de Sentença já tem 7 jurados.');
    gravarJuri(j.id,a=>({jurados:(a.jurados||[]).map(x=>x.id===id?{...x,decisao:val}:x)}));return;}
  if(UI.teseId){const tid=UI.teseId;
    if(e.target.id==='ts_tipo')salvarTese(j,tid,{tipo:e.target.value},false);
    if(e.target.id==='ts_st')salvarTese(j,tid,{status:e.target.value,ordem:999},false);
    if(e.target.dataset.tsprova){const t=(j.teses||[]).find(x=>x.id===tid);const s=new Set(t.provas||[]);e.target.checked?s.add(e.target.dataset.tsprova):s.delete(e.target.dataset.tsprova);salvarTese(j,tid,{provas:[...s]},false);}
  }
});
document.addEventListener('input',e=>{if(e.target.id==='ts_tit'&&UI.teseId){const j=byId('juri',UI.juriId);clearTimeout(e.target._t);const v=e.target.value;e.target._t=setTimeout(()=>salvarTese(j,UI.teseId,{titulo:v},false),900);}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches&&e.target.matches('[data-abrirjuri],[data-abrirtese],[data-abrirprova],[data-abrirtest]'))e.target.click();});
function novoCasoJuri(){
  const crim=S.processos.filter(p=>p.area==='Criminal'&&!juriDo(p.id));const sh=$('#sheet');SH={col:'__nj'};
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="njT"><div class="ph"><h3 id="njT">Novo caso do júri</h3><button class="btn ghost sm" id="njX" type="button">Fechar</button></div>
  <div class="pb"><div class="fld"><label for="nj_p">Processo criminal</label><select class="input" id="nj_p"><option value="">— Sem processo por enquanto —</option>${crim.map(p=>`<option value="${esc(p.id)}">${esc(procLabel(p))}</option>`).join('')}</select><span class="hint">Se o processo ainda não está no sistema, cadastre em Processos e depois volte aqui, ou crie o painel sem processo e vincule depois.</span></div></div>
  <div class="pf"><div class="r"><button class="btn" id="njC" type="button">Cancelar</button><button class="btn pri" id="njS" type="button">Criar painel</button></div></div></div>`;
  sh.hidden=false;$('#njX').onclick=$('#njC').onclick=closeForm;$('#njS').onclick=()=>{const p=$('#nj_p').value;closeForm();criarJuri(p);};
}
