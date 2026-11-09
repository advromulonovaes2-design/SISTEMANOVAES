'use strict';
/* =====================================================================
   Modelos de petição com campos automáticos
   ===================================================================== */
const ASS='{{ASSINATURAS}}';
const MODELOS_PADRAO=[
{id:'p-simples',padrao:true,area:'Geral',titulo:'Petição simples (manifestação ou juntada)',texto:`{{ENDERECAMENTO}}

Processo nº {{PROCESSO_NUMERO}}

{{CLIENTE_NOME}}, já qualificado(a) nos autos do processo em epígrafe, por seus advogados que esta subscrevem, vem, respeitosamente, à presença de Vossa Excelência, [expor e requerer / juntar documentos / manifestar-se sobre …].

[Desenvolva aqui.]

Termos em que pede deferimento.

{{CIDADE}}, {{DATA_EXTENSO}}.

${ASS}`},
{id:'p-bpc',padrao:true,area:'Previdenciário',titulo:'Inicial de BPC/LOAS (estrutura)',texto:`{{ENDERECAMENTO}}

{{QUALIFICACAO}}, por seus advogados (procuração anexa), vem propor

AÇÃO DE CONCESSÃO DE BENEFÍCIO ASSISTENCIAL DE PRESTAÇÃO CONTINUADA (BPC/LOAS)

em face do INSTITUTO NACIONAL DO SEGURO SOCIAL – INSS, autarquia federal, pelos fatos e fundamentos a seguir expostos.

# I – DA GRATUIDADE DA JUSTIÇA
A parte autora não tem condições de arcar com as custas do processo sem prejuízo do próprio sustento e de sua família, razão pela qual requer a gratuidade da justiça, nos termos dos arts. 98 e seguintes do Código de Processo Civil, juntando declaração de hipossuficiência.

# II – DOS FATOS
A parte autora requereu o benefício em {{DER}} (NB {{NB}}), que foi indeferido sob o fundamento de [motivo do indeferimento].
[Descreva a condição da parte autora: deficiência ou impedimento de longo prazo, ou idade de 65 anos ou mais; composição do grupo familiar; renda e despesas.]

# III – DO DIREITO
O art. 203, V, da Constituição Federal garante um salário mínimo de benefício mensal à pessoa com deficiência e à pessoa idosa que comprovem não possuir meios de prover a própria manutenção ou de tê-la provida por sua família, conforme regulamentado pelo art. 20 da Lei nº 8.742/1993.
[Desenvolva: requisito da deficiência ou da idade; situação de miserabilidade e análise do caso concreto.]

# IV – DOS PEDIDOS
Diante do exposto, requer:
a) a gratuidade da justiça;
b) a citação do INSS para, querendo, contestar;
c) a realização de perícia médica e de avaliação social;
d) a procedência do pedido, para condenar o INSS a conceder o benefício assistencial desde a DER ({{DER}}), com o pagamento das parcelas vencidas, corrigidas monetariamente e acrescidas de juros;
e) [tutela de urgência, se cabível].

Dá-se à causa o valor de R$ [valor].

Termos em que pede deferimento.

{{CIDADE}}, {{DATA_EXTENSO}}.

${ASS}`},
{id:'p-resposta',padrao:true,area:'Criminal',titulo:'Resposta à acusação (estrutura)',texto:`{{ENDERECAMENTO}}

Processo nº {{PROCESSO_NUMERO}}

{{CLIENTE_NOME}}, já qualificado(a) nos autos da ação penal em epígrafe, que lhe move o MINISTÉRIO PÚBLICO, por seus advogados (procuração anexa), vem, respeitosamente, apresentar

RESPOSTA À ACUSAÇÃO

com fundamento nos arts. 396 e 396-A do Código de Processo Penal, pelos fatos e fundamentos a seguir expostos.

# I – SÍNTESE DA DENÚNCIA
O(a) acusado(a) foi denunciado(a) pela suposta prática da conduta descrita no {{TIPIFICACAO}}. [Resuma a narrativa da denúncia.]

# II – PRELIMINARES
[Nulidades, inépcia da denúncia ou falta de justa causa, se houver.]

# III – DO MÉRITO
[Teses defensivas. Hipóteses de absolvição sumária do art. 397 do CPP, se cabíveis.]

# IV – DOS PEDIDOS
Diante do exposto, requer:
a) [o acolhimento das preliminares];
b) a absolvição sumária, nos termos do art. 397 do Código de Processo Penal; ou, subsidiariamente,
c) o prosseguimento do feito, com a intimação e a oitiva das testemunhas abaixo arroladas.

# ROL DE TESTEMUNHAS
1. [nome, qualificação e endereço]
2. [nome, qualificação e endereço]

Termos em que pede deferimento.

{{CIDADE}}, {{DATA_EXTENSO}}.

${ASS}`},
{id:'p-trab',padrao:true,area:'Trabalhista',titulo:'Reclamação trabalhista (estrutura)',texto:`{{ENDERECAMENTO}}

{{QUALIFICACAO}}, por seus advogados (procuração anexa), vem propor

RECLAMAÇÃO TRABALHISTA

em face de {{RECLAMADA}}, inscrita no CNPJ sob o nº {{CNPJ_RECLAMADA}}, [endereço da reclamada], pelos fatos e fundamentos a seguir expostos.

# I – DA GRATUIDADE DA JUSTIÇA
A parte reclamante requer a gratuidade da justiça, nos termos do art. 790, §§ 3º e 4º, da CLT, juntando declaração de hipossuficiência.

# II – DO CONTRATO DE TRABALHO
A parte reclamante foi admitida em {{ADMISSAO}} e desligada em {{SAIDA}}, exercendo a função de [função], com último salário de R$ [valor].

# III – DOS FATOS E FUNDAMENTOS
[Desenvolva cada pedido em tópico próprio.]

# IV – DOS PEDIDOS
Diante do exposto, requer a notificação da reclamada e a procedência dos pedidos, com a condenação ao pagamento de:
a) [pedido] – R$ [valor];
b) [pedido] – R$ [valor];
c) honorários de sucumbência, nos termos do art. 791-A da CLT.
Os pedidos são certos, determinados e com indicação de valor, conforme o art. 840, § 1º, da CLT.

Dá-se à causa o valor de R$ {{VALOR_CAUSA}}.

Termos em que pede deferimento.

{{CIDADE}}, {{DATA_EXTENSO}}.

${ASS}`}];
const CAMPOS_PECA='{{ENDERECAMENTO}} {{CLIENTE_NOME}} {{QUALIFICACAO}} {{CLIENTE_CPF}} {{PROCESSO_NUMERO}} {{VARA}} {{TRIBUNAL}} {{NB}} {{DER}} {{ESPECIE}} {{DIB}} {{RMI}} {{TIPIFICACAO}} {{RECLAMADA}} {{CNPJ_RECLAMADA}} {{ADMISSAO}} {{SAIDA}} {{VALOR_CAUSA}} {{CIDADE}} {{DATA_EXTENSO}} {{ASSINATURAS}}';
function todosModelos(){const proprios=S.modelos||[];const sub=new Set(proprios.map(m=>m.base).filter(Boolean));return[...proprios.map(m=>({...m,proprio:true})),...MODELOS_PADRAO.filter(m=>!sub.has(m.id))];}
function dadosPeca(cid,pid,advIds){
  const c=byId('clientes',cid),pr=byId('processos',pid),cfg=S.config||{};
  const vara=pr&&pr.vara?pr.vara:'';const t=pr?(pr.tribunal||'')+' '+vara:'';
  const juiz=/TRT|Trabalho/i.test(t)?'JUIZ(A) DO TRABALHO DA':/TRF|Federal|JEF/i.test(t)?'JUIZ(A) FEDERAL DA':/INSS/i.test(t)?'':'JUIZ(A) DE DIREITO DA';
  const advs=(advIds||[]).map(id=>byId('equipe',id)).filter(Boolean);
  const v=x=>x||'[preencher]';
  return{
    ENDERECAMENTO:vara&&juiz?`EXCELENTÍSSIMO(A) SENHOR(A) ${juiz} ${vara.toUpperCase()}`:'EXCELENTÍSSIMO(A) SENHOR(A) JUIZ(A) [preencher o juízo]',
    CLIENTE_NOME:c?(c.nome||'').toUpperCase():'[cliente]',QUALIFICACAO:qualificacao(c),CLIENTE_CPF:c?v(c.cpf):'',
    PROCESSO_NUMERO:pr&&pr.numero?pr.numero:'[número]',VARA:v(vara),TRIBUNAL:v(pr&&pr.tribunal),
    NB:v(pr&&pr.nb),DER:pr&&pr.der?fmtD(pr.der):'[DER]',ESPECIE:v(pr&&pr.especie),DIB:pr&&pr.dib?fmtD(pr.dib):'[DIB]',RMI:pr&&pr.rmi?brl(pr.rmi):'[RMI]',
    TIPIFICACAO:v(pr&&pr.tipoPenal),RECLAMADA:pr&&pr.reclamada?pr.reclamada.toUpperCase():'[reclamada]',CNPJ_RECLAMADA:v(pr&&pr.cnpjReclamada),
    ADMISSAO:pr&&pr.admissao?fmtD(pr.admissao):'[admissão]',SAIDA:pr&&pr.demissao?fmtD(pr.demissao):'[saída]',VALOR_CAUSA:pr&&pr.valorCausa?brl(pr.valorCausa).replace('R$ ',''):'[valor]',
    CIDADE:cfg.cidade||'Belém/PA',DATA_EXTENSO:dataExtenso(),
    ASSINATURAS:advs.length?advs.map(m=>{const o=parseOab(m.oab);return `\n\n______________________________________________\n${m.nome.toUpperCase()}\nOAB/${o.uf} ${o.num}`;}).join('\n'):'\n\n______________________________________________\n[advogado(a) – OAB]'};
}
/* texto (com "# " nos títulos) <-> html do editor */
function textoParaHtml(t){return String(t).split('\n').map(l=>{const x=l.trim();if(!x)return'';if(/^# /.test(x))return `<h3>${esc(x.slice(2))}</h3>`;return `<p>${esc(x)}</p>`;}).join('');}
function htmlParaPdf(html){
  const d=document.createElement('div');d.innerHTML=limparHTML(html);const out=[];
  const walk=el=>{[...el.childNodes].forEach(n=>{
    if(n.nodeType===3){const t=n.textContent.trim();if(t)out.push(t);return;}if(n.nodeType!==1)return;
    const tg=n.tagName;
    if(tg==='H2'||tg==='H3')out.push('# '+n.textContent.trim());
    else if(tg==='UL'||tg==='OL'){[...n.children].forEach((li,i)=>out.push((tg==='OL'?(i+1)+'. ':'• ')+li.textContent.trim()));}
    else if(tg==='P'||tg==='BLOCKQUOTE'||tg==='DIV'){const t=n.innerText!==undefined?n.innerText:n.textContent;t.split('\n').forEach(x=>out.push(x.trim()));}
    else if(tg==='BR')out.push('');
    else out.push(n.textContent.trim());});};
  walk(d);
  // linhas de assinatura: separa com linha em branco para o PDF centralizar o bloco
  return out.join('\n').replace(/\n(_{10,})/g,'\n\n$1');
}

/* ---------- montar uma petição ---------- */
function novaPeca(pre){
  const ms=todosModelos();const sh=$('#sheet');SH={col:'__peca0'};const advs=advogados();
  const o={modelo:ms[0]&&ms[0].id,clienteId:'',processoId:'',advs:advs.map(m=>m.id).slice(0,2),...(pre||{})};
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="npT"><div class="ph"><h3 id="npT">Nova petição</h3><button class="btn ghost sm" id="npX" type="button">Fechar</button></div>
  <div class="pb">
    <div class="fld"><label for="np_m">Modelo</label><select class="input" id="np_m">${ms.map(m=>`<option value="${esc(m.id)}" ${m.id===o.modelo?'selected':''}>${esc(m.titulo)}${m.proprio?' (seu modelo)':''}</option>`).join('')}</select></div>
    <div class="fld half"><label for="np_c">Cliente</label><select class="input" id="np_c"><option value="">— Escolha —</option>${[...S.clientes].sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR')).map(c=>`<option value="${esc(c.id)}" ${c.id===o.clienteId?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div>
    <div class="fld half"><label for="np_p">Processo</label><select class="input" id="np_p"></select></div>
    <div class="fld"><span class="lab">Advogados que assinam</span><div class="multi">${advs.length?advs.map(m=>`<label class="chk"><input type="checkbox" data-npadv="${esc(m.id)}" ${o.advs.includes(m.id)?'checked':''}>${esc(m.nome)} · OAB ${esc(m.oab)}</label>`).join(''):'<span class="hint">Cadastre os advogados com OAB na Equipe.</span>'}</div></div>
    <div class="fld"><span class="hint">Os dados do cliente, do processo e dos advogados entram sozinhos. Os trechos entre colchetes [assim] são para você completar.</span></div>
  </div><div class="pf"><div class="r"><button class="btn" id="npC" type="button">Cancelar</button><button class="btn pri" id="npS" type="button">Montar petição</button></div></div></div>`;
  sh.hidden=false;
  const procs=()=>{const cid=$('#np_c').value;const l=S.processos.filter(p=>!cid||p.clienteId===cid);$('#np_p').innerHTML=`<option value="">— Nenhum —</option>`+l.map(p=>`<option value="${esc(p.id)}" ${p.id===o.processoId?'selected':''}>${esc(procLabel(p))}</option>`).join('');};
  procs();$('#np_c').onchange=procs;
  $('#np_p').onchange=()=>{const pr=byId('processos',$('#np_p').value);if(pr&&!$('#np_c').value){$('#np_c').value=pr.clienteId||'';}};
  $('#npX').onclick=$('#npC').onclick=closeForm;
  $('#npS').onclick=()=>{const m=todosModelos().find(x=>x.id===$('#np_m').value);const cid=$('#np_c').value;if(!m)return;if(!cid)return toast('Escolha o cliente.');
    const advIds=[...sh.querySelectorAll('[data-npadv]')].filter(x=>x.checked).map(x=>x.dataset.npadv);
    const texto=String(m.texto).replace(/\{\{([A-Z_]+)\}\}/g,(a,k)=>{const d=dadosPeca(cid,$('#np_p').value,advIds);return k in d?d[k]:a;});
    abrirPeca(null,{titulo:m.titulo.replace(/ \(estrutura\)$/,'')+' – '+(byId('clientes',cid)||{}).nome,html:textoParaHtml(texto),clienteId:cid,processoId:$('#np_p').value});};
}
function abrirPeca(docId,novo){
  const d=docId?byId('documentos',docId):null;const base=d||novo;if(!base)return;
  const sh=$('#sheet');SH={col:'__peca',id:docId};let html=d?d.texto:novo.html;
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="pcT" style="max-width:880px"><div class="ph"><h3 id="pcT">Petição</h3><button class="btn ghost sm" id="pcX" type="button">Fechar</button></div>
    <div class="pb" style="display:block"><div class="fld" style="margin-bottom:10px"><label for="pc_t">Nome da petição</label><input class="input" id="pc_t" value="${esc(base.titulo||'')}"></div><div id="pcEd"></div>
    <span class="hint" style="display:block;margin-top:8px">Linhas em CAIXA ALTA curtas saem centralizadas no PDF; títulos (T1/T2) saem em negrito.</span></div>
    <div class="pf"><div class="r"><button class="btn" id="pcSalvar" type="button">Salvar texto</button><button class="btn pri" id="pcPdf" type="button">Gerar PDF com a logo</button></div></div></div>`;
  sh.hidden=false;
  const ed=criarEditor($('#pcEd'),{html,titulo:base.titulo||'peticao',onChange:h=>{html=h;return true;}});
  $('#pcX').onclick=closeForm;
  const guardar=async(comPdf)=>{
    html=ed.html();const titulo=$('#pc_t').value.trim()||'Petição';
    const dados={tipo:'peticao',titulo,texto:html,clienteId:base.clienteId,processoId:base.processoId||'',status:'rascunho',arquivo:d&&d.arquivo||''};
    if(comPdf){try{const bytes=await montarPDF(htmlParaPdf(html));const nome=nomeArquivo('peticao',(byId('clientes',base.clienteId)||{}).nome);const blob=new Blob([bytes],{type:'application/pdf'});
      const pasta=`documentos/${docId||uid()}`;const p=await enviarArquivo(new File([blob],nome,{type:'application/pdf'}),pasta);if(!p)return;dados.arquivo=p;dados.status='pdf';try{baixarBlob(blob,nome);}catch(_){}}
      catch(e){console.error(e);return toast('Não foi possível gerar o PDF: '+(e.message||'erro'));}}
    const id=await salvar('documentos',docId,{...(d||{}),...dados});
    if(id){SH.id=docId=id;toast(comPdf?'PDF gerado e guardado em Documentos.':'Texto salvo em Documentos.');}
  };
  $('#pcSalvar').onclick=()=>guardar(false);$('#pcPdf').onclick=()=>guardar(true);
}

/* ---------- gerenciar modelos ---------- */
function listaModelos(){
  const sh=$('#sheet');SH={col:'__mods'};const ms=todosModelos();
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="lmT"><div class="ph"><h3 id="lmT">Modelos de petição</h3><button class="btn ghost sm" id="lmX" type="button">Fechar</button></div>
  <div class="pb" style="display:block"><div class="tools" style="margin-bottom:12px"><span class="hint">Crie seus modelos com os campos automáticos. Os modelos que vêm no sistema são estruturas para você adaptar ao seu estilo.</span><button class="btn pri push" data-novomod type="button">+ Novo modelo</button></div>
  <div class="list">${ms.map(m=>`<div class="row a-${areaCls(m.area)}"><div class="main"><div class="t">${esc(m.titulo)}</div><div class="chips">${m.area&&m.area!=='Geral'?areaChip(m.area):'<span class="chip c-mute">Geral</span>'}<span class="chip c-mute">${m.proprio?'Seu modelo':'Vem no sistema'}</span></div>
    <div class="acts"><button class="btn sm pri" data-usarmod="${esc(m.id)}" type="button">Usar</button><button class="btn sm" data-editmod="${esc(m.id)}" type="button">${m.proprio?'Editar':'Adaptar'}</button>${m.proprio?`<button class="btn sm ghost" data-delmod="${esc(m.id)}" type="button">Excluir</button>`:''}</div></div></div>`).join('')}</div></div></div>`;
  sh.hidden=false;$('#lmX').onclick=closeForm;
}
function editarModelo(id){
  const m=id?todosModelos().find(x=>x.id===id):{titulo:'',area:'Geral',texto:'{{ENDERECAMENTO}}\n\nProcesso nº {{PROCESSO_NUMERO}}\n\n{{CLIENTE_NOME}}, já qualificado(a) nos autos, vem…\n\nTermos em que pede deferimento.\n\n{{CIDADE}}, {{DATA_EXTENSO}}.\n\n{{ASSINATURAS}}'};
  const sh=$('#sheet');SH={col:'__mod'};
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="emT" style="max-width:820px"><div class="ph"><h3 id="emT">${m.proprio?'Editar modelo':'Novo modelo'}</h3><button class="btn ghost sm" id="emX" type="button">Fechar</button></div>
  <div class="pb"><div class="fld"><label for="em_t">Nome do modelo</label><input class="input" id="em_t" value="${esc(m.titulo)}"></div>
    <div class="fld half"><label for="em_a">Área</label><select class="input" id="em_a">${['Geral','Previdenciário','Criminal','Trabalhista'].map(a=>`<option ${a===m.area?'selected':''}>${a}</option>`).join('')}</select></div>
    <div class="fld"><label for="em_x">Texto</label><textarea class="input doc" id="em_x" spellcheck="true" lang="pt-BR">${esc(m.texto)}</textarea><span class="hint">Comece uma linha com “# ” para virar título. Campos automáticos: <span class="mono" style="font-size:11.5px">${esc(CAMPOS_PECA)}</span></span></div></div>
  <div class="pf"><div class="r"><button class="btn" id="emC" type="button">Cancelar</button><button class="btn pri" id="emS" type="button">Salvar modelo</button></div></div></div>`;
  sh.hidden=false;$('#emX').onclick=$('#emC').onclick=listaModelos;
  $('#emS').onclick=async()=>{const titulo=$('#em_t').value.trim();if(!titulo)return toast('Dê um nome ao modelo.');
    const dados={titulo,area:$('#em_a').value,texto:$('#em_x').value,base:m.proprio?m.base||'':(m.padrao?m.id:'')};
    const r=await salvar('modelos',m.proprio?m.id:null,dados);if(r){toast('Modelo salvo.');listaModelos();}};
}
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-novapeca],[data-modpecas],[data-abrirpeca],[data-usarmod],[data-editmod],[data-delmod],[data-novomod]');if(!t)return;
  const dentro=!!e.target.closest('#sheet .panel');
  if(!dentro&&('novapeca' in t.dataset)){e.stopPropagation();return novaPeca();}
  if(!dentro&&('modpecas' in t.dataset)){e.stopPropagation();return listaModelos();}
  if(!dentro&&t.dataset.abrirpeca){e.stopPropagation();return abrirPeca(t.dataset.abrirpeca);}
  if(dentro){
    if(t.dataset.usarmod){e.stopPropagation();return novaPeca({modelo:t.dataset.usarmod});}
    if(t.dataset.editmod){e.stopPropagation();return editarModelo(t.dataset.editmod);}
    if('novomod' in t.dataset){e.stopPropagation();return editarModelo(null);}
    if(t.dataset.delmod){e.stopPropagation();if(!t.dataset.armed){t.dataset.armed='1';t.textContent='Toque de novo';return;}if(await excluir('modelos',t.dataset.delmod)){toast('Modelo excluído.');listaModelos();}return;}
  }
},true);
