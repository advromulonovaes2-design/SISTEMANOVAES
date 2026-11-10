'use strict';
/* =====================================================================
   Assistente de IA (Claude): monta o pedido com os dados da tela,
   copia e abre o Claude da conta do advogado. Nada é enviado pelo
   sistema: o texto só sai quando a pessoa toca em "Abrir no Claude".
   ===================================================================== */
const IA_URL='https://claude.ai/new';
const IA_BASE=()=>`Você está ajudando o escritório ${(S.config&&S.config.nome)||NOME_PADRAO} (${(S.config&&S.config.cidade)||'Belém/PA'}), que atua em direito previdenciário, criminal e trabalhista.
Responda em português do Brasil, de forma objetiva e organizada.
Regras:
- Não invente artigos, súmulas, temas ou jurisprudência. Se não tiver certeza de uma referência, diga isso claramente.
- Não dê prazo processual como definitivo: o prazo oficial é o calculado e conferido no sistema do escritório. Pode comentar o tipo de prazo e a contagem, sempre pedindo conferência.
- Aponte o que precisa ser conferido nos autos antes de qualquer providência.
- O advogado responsável vai revisar tudo antes de usar.`;

/* ---------- privacidade ---------- */
const RX_CPF=/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,RX_CNPJ=/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const iniciaisNome=n=>String(n).split(/\s+/).filter(p=>p.length>2||/^[A-ZÁ-Ú]/.test(p)).map(p=>p[0].toUpperCase()+'.').join('');
function nomesDoTexto(partes){return String(partes||'').split(/[;\n]|,(?![^(]*\))/).map(x=>x.replace(/\(.*?\)/g,'').trim()).filter(x=>x.length>5&&!/segredo de justi/i.test(x));}
function anonimizar(t,nomes){
  let s=String(t).replace(RX_CNPJ,'[CNPJ]').replace(RX_CPF,'[CPF]');
  [...new Set(nomes.filter(Boolean))].sort((a,b)=>b.length-a.length).forEach(n=>{
    const rx=new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');s=s.replace(rx,iniciaisNome(n));});
  return s;
}
const limpo=t=>String(t||'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
const corta=(t,n)=>{t=limpo(t);return t.length>n?t.slice(0,n)+' […]':t;};

/* ---------- dados de cada tela ---------- */
function ctxProcessoTxt(p,{publicacoes=true}={}){
  if(!p)return'';const c=byId('clientes',p.clienteId)||{},r=byId('equipe',p.responsavelId);
  const fase=p.fasePrev||p.faseCrim||p.faseTrab||p.faseOutro||'';
  const L=[`Processo: ${p.numero||'(sem número)'}`,`Cliente: ${c.nome||'(não informado)'}`,`Área: ${p.area||''}${fase?' · Fase: '+fase:''}`,
    p.tribunal||p.vara?`Juízo: ${[p.tribunal,p.vara].filter(Boolean).join(' · ')}`:'',r?`Responsável: ${r.nome}`:'',
    p.classeCnj?`Classe (CNJ): ${p.classeCnj}`:'',p.cnj&&p.cnj.assuntos&&p.cnj.assuntos.length?`Assuntos (CNJ): ${p.cnj.assuntos.join(', ')}`:'',
    p.ajuizamento?`Ajuizamento: ${fmtD(p.ajuizamento)}`:''];
  if(p.area==='Previdenciário')L.push([p.especie&&`Benefício: ${p.especie}`,p.nb&&`NB: ${p.nb}`,p.der&&`DER: ${fmtD(p.der)}`,p.dib&&`DIB: ${fmtD(p.dib)}`].filter(Boolean).join(' · '));
  if(p.area==='Criminal')L.push([p.tipoPenal&&`Tipificação: ${p.tipoPenal}`,p.reuPreso&&'Réu preso'].filter(Boolean).join(' · '));
  if(p.area==='Trabalhista')L.push([p.reclamada&&`Reclamada: ${p.reclamada}`,p.admissao&&`Admissão: ${fmtD(p.admissao)}`,p.demissao&&`Saída: ${fmtD(p.demissao)}`].filter(Boolean).join(' · '));
  if(p.obs)L.push(`Observações do escritório: ${corta(p.obs,800)}`);
  const pz=S.prazos.filter(x=>x.processoId===p.id&&!x.cumprido).map(x=>{const r=prazoCalc(x);return `- ${x.descricao||'Prazo'}${r?` (vence ${fmtD(r.venc)}, conforme o sistema)`:''}`;});
  if(pz.length)L.push('Prazos abertos no sistema:\n'+pz.join('\n'));
  const ev=(S.eventos||[]).filter(e=>e.processoId===p.id&&e.data>=hojeStr()).map(e=>`- ${e.tipo||'Compromisso'}: ${fmtD(e.data)}${e.hora?' '+e.hora:''}`);
  if(ev.length)L.push('Próximos compromissos:\n'+ev.join('\n'));
  if(p.cnj&&p.cnj.movimentos&&p.cnj.movimentos.length)L.push('Últimas movimentações (CNJ):\n'+p.cnj.movimentos.slice(0,10).map(m=>`- ${m.data?fmtD(String(m.data).slice(0,10)):''} ${m.nome}`).join('\n'));
  if(publicacoes){const pubs=S.intimacoes.filter(i=>digits(i.numero)&&digits(i.numero)===digits(p.numero)).sort((a,b)=>String(b.data_disponibilizacao).localeCompare(String(a.data_disponibilizacao))).slice(0,4);
    if(pubs.length)L.push('Últimas publicações no DJEN:\n'+pubs.map(i=>`[${fmtD(i.data_disponibilizacao)} · ${i.tipo_documento||i.tipo||'Publicação'}]\n${corta(i.texto||'(texto não carregado)',1800)}`).join('\n\n'));}
  return L.filter(Boolean).join('\n');
}
function ctxIntimacaoTxt(it){
  const p=S.processos.find(x=>digits(x.numero)&&digits(x.numero)===digits(it.numero));
  const sug=typeof sugerirDias==='function'?sugerirDias(it.texto||''):null;
  return [`Publicação no DJEN de ${fmtD(it.data_disponibilizacao)}`,`Processo: ${it.numero||''}`,`Tribunal/órgão: ${[it.tribunal,it.orgao].filter(Boolean).join(' · ')}`,
    it.classe?`Classe: ${it.classe}`:'',`Tipo: ${it.tipo_documento||it.tipo||''}`,it.partes?`Partes: ${it.partes}`:'',
    sug?`O texto menciona prazo de ${sug.dias} dias ("${sug.trecho}") — o sistema calcula a data oficial.`:'',
    `Texto da publicação:\n${corta(it.texto||'(texto não carregado)',6000)}`,
    p?`\nDados do processo cadastrado no escritório:\n${ctxProcessoTxt(p,{publicacoes:false})}`:''].filter(Boolean).join('\n');
}
function ctxJuriTxt(j){
  const pr=byId('processos',j.processoId);const txt=h=>typeof htmlParaTexto==='function'?htmlParaTexto(h||''):String(h||'').replace(/<[^>]+>/g,' ');
  return [`Caso do Tribunal do Júri: ${tituloJuri(j)}`,j.imputacao?`Imputação: ${j.imputacao}`:'',j.dataPlenario?`Plenário: ${fmtD(j.dataPlenario)}`:'',
    pr?ctxProcessoTxt(pr,{publicacoes:false}):'',
    (j.teses||[]).length?'Teses da defesa:\n'+(j.teses||[]).map(t=>`- ${t.titulo||'Tese'} [${t.status||''}]\n${corta(txt(t.texto),1500)}`).join('\n'):'Ainda sem teses cadastradas.',
    (j.provas||[]).length?'Provas:\n'+(j.provas||[]).map(p=>`- ${p.titulo||''}${p.tipo?' ('+p.tipo+')':''}${p.folhas?' fls. '+p.folhas:''}${p.resumo?': '+corta(p.resumo,400):''}`).join('\n'):'',
    (j.testemunhas||[]).length?'Testemunhas:\n'+(j.testemunhas||[]).map(t=>`- ${t.nome||''}${t.arroladaPor?' (arrolada por '+t.arroladaPor+')':''}${t.disse?': '+corta(t.disse,500):''}`).join('\n'):'',
    j.notas?`Anotações: ${corta(j.notas,1000)}`:''].filter(Boolean).join('\n');
}
function nomesDe(...l){return l.flat().filter(Boolean);}

/* ---------- tarefas prontas ---------- */
const IA_TAREFAS={
  intimacao:[
    ['Resumir e dizer a providência','Resuma em poucas linhas o que foi decidido ou determinado nesta publicação, diga se ela exige alguma providência do advogado, qual seria (manifestação, recurso, juntada, cumprimento etc.) e o tipo de prazo envolvido, indicando o que conferir nos autos.'],
    ['Rascunhar a manifestação','Escreva um rascunho de petição de manifestação ou cumprimento ao que foi determinado nesta publicação, com endereçamento, qualificação resumida, fundamentos e pedidos. Deixe entre colchetes [assim] o que precisar ser completado ou conferido.'],
    ['Explicar ao cliente (WhatsApp)','Escreva uma mensagem curta de WhatsApp, em linguagem simples e acolhedora, explicando ao cliente o que essa publicação significa para o processo dele e o que acontece agora. Não use termos jurídicos sem explicar e não prometa resultado.']],
  processo:[
    ['Resumo e próximos passos','Faça um resumo do caso em tópicos (situação atual, o que já aconteceu, o que está pendente) e sugira os próximos passos do advogado, em ordem de prioridade.'],
    ['Rascunhar petição','Escreva um rascunho da petição mais adequada para o momento atual deste processo, com endereçamento, fatos, fundamentos e pedidos. Deixe entre colchetes [assim] o que precisar ser completado ou conferido.'],
    ['Riscos e pontos de atenção','Aponte os riscos e pontos de atenção deste caso (prescrição, decadência, provas que faltam, requisitos não comprovados, prazos), explicando cada um em poucas linhas.'],
    ['Explicar ao cliente (WhatsApp)','Escreva uma mensagem curta de WhatsApp, em linguagem simples, explicando ao cliente em que pé está o processo e o que vem a seguir. Não prometa resultado.']],
  juri:[
    ['Revisar as teses','Revise as teses da defesa: aponte a força e a fraqueza de cada uma, se são compatíveis entre si e em que ordem apresentá-las aos jurados.'],
    ['Antecipar a acusação','Liste os argumentos que a acusação provavelmente vai usar e, para cada um, uma resposta da defesa baseada nas provas e testemunhas do caso.'],
    ['Perguntas às testemunhas','Sugira perguntas para cada testemunha, separando as da defesa (para reforçar a tese) e as da acusação (para mostrar contradições), sem perguntas que possam prejudicar o réu.'],
    ['Fala aos jurados','Escreva um roteiro de fala aos jurados, em linguagem simples, com abertura, desenvolvimento das teses e fechamento, para cerca de 1 hora e 30 minutos.']],
  carteira:[
    ['Organizar prioridades','Com base nesta lista de processos, aponte quais merecem atenção primeiro (audiências próximas, processos parados há muito tempo, fases que costumam ter prazo) e sugira uma organização de trabalho para a semana.'],
    ['Resumo da carteira','Faça um resumo desta carteira de processos: quantos por matéria e situação, o que chama atenção e o que pode estar esquecido.']],
  livre:[['Pergunta livre','']]
};

/* ---------- janela do assistente ---------- */
function abrirIA({titulo,tipo,contexto,nomes=[]}){
  const tarefas=[...(IA_TAREFAS[tipo]||[]),...IA_TAREFAS.livre];
  const sh=$('#sheet');SH={col:'__ia'};let anon=(()=>{try{return localStorage.getItem('ia_anon')!=='0';}catch(_){return true;}})();
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="iaT" style="max-width:820px"><div class="ph"><h3 id="iaT">Perguntar à IA</h3><button class="btn ghost sm" id="iaX" type="button">Fechar</button></div>
    <div class="pb" style="display:block">
      <p class="hint" style="margin:0 0 10px">${esc(titulo||'')} · o sistema monta o pedido com os dados desta tela e abre o Claude da sua conta. Nada sai do sistema antes de você tocar em "Abrir no Claude".</p>
      <div class="ia-tarefas" role="radiogroup" aria-label="O que pedir">${tarefas.map(([l],i)=>`<button type="button" class="cart-chip ${i===0?'on':''}" data-iatar="${i}">${esc(l)}</button>`).join('')}</div>
      <div class="fld" style="margin-top:10px"><label for="ia_q">O que você quer da IA</label><textarea class="input" id="ia_q" rows="3" spellcheck="true" lang="pt-BR"></textarea></div>
      <label class="chk"><input type="checkbox" id="ia_anon" ${anon?'checked':''}>Trocar nomes por iniciais e esconder CPF/CNPJ (recomendado)</label>
      <details class="ia-prev"><summary>Ver o texto que vai para a IA</summary><pre class="ia-txt" id="ia_prev"></pre></details>
      <p class="hint" style="margin-top:10px">A IA pode errar e inventar referências. Revise tudo antes de usar; o prazo oficial é sempre o do sistema, conferido por duas pessoas.</p>
    </div>
    <div class="pf"><button class="btn" id="iaCopiar" type="button">Só copiar</button><div class="r"><button class="btn pri" id="iaAbrir" type="button">Abrir no Claude</button></div></div></div>`;
  sh.hidden=false;
  const montar=()=>{const q=$('#ia_q').value.trim()||'Responda à pergunta do advogado sobre os dados abaixo.';
    let ctx=contexto;if($('#ia_anon').checked)ctx=anonimizar(ctx,nomes);
    return `${IA_BASE()}\n\nTAREFA:\n${q}\n\nDADOS (copiados do sistema do escritório):\n${ctx}`;};
  const prev=()=>{$('#ia_prev').textContent=montar();};
  const escolher=i=>{sh.querySelectorAll('[data-iatar]').forEach(b=>b.classList.toggle('on',+b.dataset.iatar===i));$('#ia_q').value=tarefas[i][1];if(!tarefas[i][1])$('#ia_q').focus();prev();};
  sh.querySelectorAll('[data-iatar]').forEach(b=>b.onclick=()=>escolher(+b.dataset.iatar));
  $('#ia_q').oninput=prev;$('#ia_anon').onchange=()=>{try{localStorage.setItem('ia_anon',$('#ia_anon').checked?'1':'0');}catch(_){}prev();};
  escolher(0);
  $('#iaX').onclick=closeForm;
  $('#iaCopiar').onclick=()=>{copiarTexto(montar());toast('Pedido copiado. Cole no Claude ou em outro lugar.');};
  $('#iaAbrir').onclick=()=>{const t=montar();copiarTexto(t);
    const url=encodeURIComponent(t).length<7000?`${IA_URL}?q=${encodeURIComponent(t)}`:IA_URL;
    window.open(url,'_blank','noopener');
    toast(url===IA_URL?'Pedido copiado. No Claude, cole (Ctrl+V ou tocar e segurar › Colar) e envie.':'Abrindo o Claude. Se o texto não aparecer pronto, cole (Ctrl+V).',6000);};
}
function copiarTexto(t){
  try{if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).catch(()=>copiarAntigo(t));return;}}catch(_){}
  copiarAntigo(t);
}
function copiarAntigo(t){const a=document.createElement('textarea');a.value=t;a.setAttribute('readonly','');a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();try{document.execCommand('copy');}catch(_){}a.remove();}

/* ---------- botões nas telas ---------- */
async function iaIntimacao(hash){
  const it=S.intimacoes.find(x=>x.hash===hash);if(!it)return;
  if(it.texto===undefined&&typeof carregarTextos==='function')await carregarTextos([hash]);
  const p=S.processos.find(x=>digits(x.numero)&&digits(x.numero)===digits(it.numero));const c=p&&byId('clientes',p.clienteId);
  abrirIA({titulo:`Publicação de ${fmtD(it.data_disponibilizacao)} · ${it.numero||''}`,tipo:'intimacao',contexto:ctxIntimacaoTxt(it),nomes:nomesDe(nomesDoTexto(it.partes),c&&c.nome)});
}
async function iaProcesso(id){
  const p=byId('processos',id);if(!p)return;
  const hs=S.intimacoes.filter(i=>digits(i.numero)&&digits(i.numero)===digits(p.numero)).map(i=>i.hash);
  if(hs.length&&typeof carregarTextos==='function')await carregarTextos(hs.slice(0,8));
  const c=byId('clientes',p.clienteId);
  abrirIA({titulo:`Processo ${p.numero||''}`,tipo:'processo',contexto:ctxProcessoTxt(p),nomes:nomesDe(c&&c.nome,p.reclamada)});
}
function iaJuri(id){
  const j=byId('juri',id);if(!j)return;const pr=byId('processos',j.processoId),c=pr&&byId('clientes',pr.clienteId);
  abrirIA({titulo:`Júri · ${tituloJuri(j)}`,tipo:'juri',contexto:ctxJuriTxt(j),nomes:nomesDe(j.reus,c&&c.nome,(j.testemunhas||[]).map(t=>t.nome))});
}
function iaCarteira(){
  const l=(typeof gruposCarteira==='function'?gruposCarteira():[]).filter(g=>!g.excluido).slice(0,150);
  const sit={andamento:'em andamento',sentenca:'sentença/recurso',arquivado:'arquivado'};
  const linhas=l.map(g=>`- ${g.ult.numero} · ${g.materia} · ${sit[g.situacao]||''}${g.audiencia==='marcada'?' · audiência '+(g.audData?fmtD(g.audData):'marcada'):''}${g.ano?' · processo de '+g.ano:''} · última publicação ${fmtD(g.ult.data_disponibilizacao)}${g.proc?' · cadastrado':''}${g.ult.classe?' · '+g.ult.classe:''}`);
  abrirIA({titulo:`Carteira da OAB (${l.length} processos)`,tipo:'carteira',contexto:`Lista de processos encontrados nas publicações do DJEN pelas OABs do escritório (matéria e situação foram estimadas pelo sistema a partir do texto das publicações):\n${linhas.join('\n')}`});
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-iaint],[data-iaproc],[data-iajuri],#iaCart');if(!t)return;
  e.preventDefault();e.stopPropagation();
  if(t.dataset.iaint)return iaIntimacao(t.dataset.iaint);
  if(t.dataset.iaproc)return iaProcesso(t.dataset.iaproc);
  if(t.dataset.iajuri)return iaJuri(t.dataset.iajuri);
  if(t.id==='iaCart')return iaCarteira();
},true);

// processo: botão abaixo da caixa do CNJ
const AFTER_PROC_IA=FORMS.processos.after;
FORMS.processos.after=function(v){
  if(AFTER_PROC_IA)AFTER_PROC_IA(v);
  if(!SH||SH.col!=='processos'||!SH.id||$('#iaProcBox'))return;
  const ref=$('#cnjBox')||$('#f_numero');if(!ref)return;
  const d=document.createElement('div');d.id='iaProcBox';d.className='acts';d.style.margin='8px 0 0';
  d.innerHTML=`<button class="btn sm" type="button" data-iaproc="${esc(SH.id)}">Perguntar à IA sobre este processo</button>`;
  (ref.closest('.fld')||ref).after(d);
};
// júri: botão no topo do painel do caso
if(typeof painelJuri==='function'){
  const _pj=painelJuri;
  painelJuri=function(j){return _pj(j).replace('<div class="jtabs"',`<div class="acts" style="margin:-4px 0 12px"><button class="btn sm" type="button" data-iajuri="${esc(j.id)}">Perguntar à IA sobre o caso</button></div><div class="jtabs"`);};
}

/* ---------- página "Assistente IA" ---------- */
VIEWS.assistente={t:'Assistente IA',
  tools(){return `<div class="sub">Peça ajuda ao Claude com os dados do sistema já preenchidos. O pedido abre na sua conta do Claude; o sistema não envia nada sozinho.</div>`;},
  body(){
    const procs=[...S.processos].sort((a,b)=>String((byId('clientes',a.clienteId)||{}).nome||'').localeCompare(String((byId('clientes',b.clienteId)||{}).nome||''),'pt-BR'));
    return `<div class="rgrid">
      <div class="rcard"><h3>Sobre um processo</h3><p class="hint" style="margin:0 0 10px">Resumo, próximos passos, rascunho de petição, riscos ou mensagem ao cliente.</p>
        <select class="input" id="iaSelProc" aria-label="Processo"><option value="">Escolha o processo…</option>${procs.map(p=>`<option value="${esc(p.id)}">${esc(((byId('clientes',p.clienteId)||{}).nome||'Sem cliente')+' · '+(p.numero||p.area||''))}</option>`).join('')}</select>
        <div class="acts"><button class="btn pri" type="button" id="iaIrProc">Continuar</button></div></div>
      <div class="rcard"><h3>Sobre uma intimação</h3><p class="hint" style="margin:0 0 10px">Na aba Intimações, cada publicação tem o botão "Perguntar à IA": resumo, providência, rascunho ou explicação ao cliente.</p><div class="acts"><a class="btn" href="#intimacoes">Ir para Intimações</a></div></div>
      <div class="rcard"><h3>Tribunal do Júri</h3><p class="hint" style="margin:0 0 10px">No painel de cada caso: revisar teses, antecipar a acusação, perguntas às testemunhas e fala aos jurados.</p><div class="acts"><a class="btn" href="#juri">Ir para o Júri</a></div></div>
      <div class="rcard"><h3>Carteira da OAB</h3><p class="hint" style="margin:0 0 10px">Prioridades da semana e resumo dos processos encontrados no DJEN.</p><div class="acts"><button class="btn" type="button" id="iaCart">Perguntar sobre a carteira</button></div></div>
      <div class="rcard" style="grid-column:1/-1"><h3>Pergunta livre</h3><p class="hint" style="margin:0 0 10px">Dúvida jurídica ou de redação sem dados de cliente (ex.: "requisitos do auxílio-acidente", "melhore este parágrafo").</p>
        <div class="acts"><button class="btn" type="button" id="iaLivre">Fazer uma pergunta</button></div></div>
    </div>`;},
  after(){
    if(!$('#iaIrProc'))return;
    $('#iaIrProc').onclick=()=>{const v=$('#iaSelProc').value;if(!v)return toast('Escolha o processo.');iaProcesso(v);};
    $('#iaLivre').onclick=()=>abrirIA({titulo:'Pergunta livre',tipo:'livre',contexto:'(sem dados de processo)'});
  }};
