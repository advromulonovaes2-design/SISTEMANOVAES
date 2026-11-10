'use strict';
/* =====================================================================
   Assistente de IA (Claude) dentro do sistema: conversa na própria tela,
   com os dados do processo, da intimação ou do júri. A chave da API fica
   no Supabase (função "ia"); sem chave, oferece levar o pedido ao Claude.
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

/* ---------- assistente dentro do sistema (função "ia" no Supabase) ---------- */
const IA_ST={info:null};
async function statusIA(forcar){
  if(IA_ST.info&&!forcar)return IA_ST.info;
  try{const{data,error}=await sb.functions.invoke('ia',{body:{status:true}});IA_ST.info=error?{erro:true}:data;}catch(_){IA_ST.info={erro:true};}
  return IA_ST.info;
}
function mdLeve(t){
  const linhas=esc(t).split('\n');let html='',lista='';
  const fecha=()=>{if(lista){html+=`</${lista}>`;lista='';}};
  for(let l of linhas){
    l=l.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<i>$2</i>').replace(/`([^`]+)`/g,'<code>$1</code>');
    let m;
    if((m=l.match(/^#{1,4}\s+(.*)/))){fecha();html+=`<h4>${m[1]}</h4>`;}
    else if((m=l.match(/^\s*[-•]\s+(.*)/))){if(lista!=='ul'){fecha();html+='<ul>';lista='ul';}html+=`<li>${m[1]}</li>`;}
    else if((m=l.match(/^\s*\d+[.)]\s+(.*)/))){if(lista!=='ol'){fecha();html+='<ol>';lista='ol';}html+=`<li>${m[1]}</li>`;}
    else if(!l.trim()){fecha();}
    else{fecha();html+=`<p>${l}</p>`;}
  }
  fecha();return html;
}
function abrirIA({titulo,tipo,contexto,nomes=[],clienteId='',processoId='',telefone=''}){
  const tarefas=[...(IA_TAREFAS[tipo]||[]),...IA_TAREFAS.livre];
  const sh=$('#sheet');SH={col:'__ia'};const conv=[];let enviando=false;
  let anon=(()=>{try{return localStorage.getItem('ia_anon')!=='0';}catch(_){return true;}})();
  sh.innerHTML=`<div class="panel ia-panel" role="dialog" aria-modal="true" aria-labelledby="iaT" style="max-width:860px"><div class="ph"><h3 id="iaT">Assistente de IA</h3><button class="btn ghost sm" id="iaX" type="button">Fechar</button></div>
    <div class="pb ia-pb" style="display:block">
      <p class="hint" style="margin:0 0 10px">${esc(titulo||'')}</p>
      <div class="ia-tarefas" role="group" aria-label="Pedidos prontos">${tarefas.map(([l],i)=>`<button type="button" class="cart-chip" data-iatar="${i}">${esc(l)}</button>`).join('')}</div>
      <div class="ia-conv" id="iaConv" aria-live="polite"></div>
      <div id="iaAviso"></div>
    </div>
    <div class="pf ia-pf"><div class="ia-entrada"><textarea class="input" id="ia_q" rows="2" placeholder="Escreva o que você precisa ou escolha um pedido pronto acima" spellcheck="true" lang="pt-BR"></textarea><button class="btn pri" id="iaEnviar" type="button">Enviar</button></div>
      <div class="ia-rodape"><label class="chk"><input type="checkbox" id="ia_anon" ${anon?'checked':''}>Trocar nomes por iniciais e esconder CPF/CNPJ</label><span class="hint" id="iaUso"></span></div></div></div>`;
  sh.hidden=false;
  const ctx=()=>$('#ia_anon').checked?anonimizar(contexto,nomes):contexto;
  const conv$=$('#iaConv');
  const pintar=()=>{
    conv$.innerHTML=conv.map((m,i)=>m.role==='user'?`<div class="ia-msg eu">${esc(m.content)}</div>`
      :`<div class="ia-msg ia">${m.content?mdLeve(m.content):'<span class="hint">Pensando…</span>'}${m.fim?`<div class="acts ia-acts"><button class="btn sm" type="button" data-iacop="${i}">Copiar</button>${processoId||clienteId?`<button class="btn sm" type="button" data-iapeca="${i}">Salvar como petição</button>`:''}${telefone&&foneWa(telefone)?`<a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/${foneWa(telefone)}?text=${encodeURIComponent(m.content.slice(0,3000))}">Mandar no WhatsApp</a>`:''}</div>`:''}</div>`).join('');
    conv$.scrollTop=conv$.scrollHeight;const pb=sh.querySelector('.ia-pb');if(pb)pb.scrollTop=pb.scrollHeight;
  };
  const aviso=html=>{$('#iaAviso').innerHTML=html||'';};
  const semChave=()=>aviso(`<div class="banner" style="display:block;margin:10px 0 0"><b>O assistente ainda não está ligado.</b> Um gestor precisa colocar a chave da API da Anthropic no Supabase (veja o passo a passo, "Assistente de IA dentro do sistema"). Enquanto isso, você pode levar este pedido para o Claude:<div class="acts" style="margin:8px 0 0"><button class="btn sm" type="button" id="iaFora">Abrir no Claude</button></div></div>`);
  const enviar=async texto=>{
    texto=String(texto||'').trim();if(!texto||enviando)return;
    enviando=true;$('#iaEnviar').disabled=true;aviso('');
    conv.push({role:'user',content:texto});const resp={role:'assistant',content:''};conv.push(resp);pintar();$('#ia_q').value='';
    try{
      const{data:{session}}=await sb.auth.getSession();const C=window.CONFIG||{};
      const r=await fetch(`${C.SUPABASE_URL}/functions/v1/ia`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(session&&session.access_token||''),apikey:C.SUPABASE_ANON_KEY},
        body:JSON.stringify({contexto:ctx(),mensagens:conv.filter(m=>m!==resp).map(({role,content})=>({role,content}))})});
      if(!r.ok){let e={};try{e=await r.json();}catch(_){}conv.pop();conv.pop();pintar();$('#ia_q').value=texto;
        if(e.erro==='sem_chave')return semChave();
        const msg={limite:`Você chegou ao limite de ${e.limite||''} pedidos por dia. Amanhã libera de novo.`,sem_credito:'A conta da API da Anthropic está sem crédito. Um gestor precisa colocar crédito no Console da Anthropic.',
          chave_invalida:'A chave da API da Anthropic foi recusada. Um gestor precisa conferir o secret ANTHROPIC_API_KEY no Supabase.',ocupado:'A IA está ocupada agora. Tente de novo em alguns segundos.',
          modelo:'O modelo configurado não existe mais. Um gestor precisa ajustar o secret IA_MODELO no Supabase.',sem_permissao:'Seu login não tem permissão para usar o assistente.'}[e.erro]||'Não foi possível falar com a IA agora. Tente de novo.';
        return aviso(`<div class="banner" style="display:block;margin:10px 0 0">${esc(msg)}</div>`);}
      const leitor=r.body.getReader(),dec=new TextDecoder();let ult=0;
      while(true){const{value,done}=await leitor.read();if(done)break;resp.content+=dec.decode(value,{stream:true});const ag=Date.now();if(ag-ult>120){ult=ag;pintar();}}
      resp.fim=true;pintar();statusIA(true).then(mostrarUso);
    }catch(err){console.error(err);if(!resp.content){conv.pop();conv.pop();$('#ia_q').value=texto;}else resp.fim=true;pintar();aviso('<div class="banner" style="display:block;margin:10px 0 0">A conexão caiu no meio da resposta. Confira a internet e tente de novo.</div>');}
    finally{enviando=false;const b=$('#iaEnviar');if(b)b.disabled=false;}
  };
  const mostrarUso=info=>{const el=$('#iaUso');if(!el||!info||info.erro)return;el.textContent=info.chave?`Hoje: ${info.usadosHoje} de ${info.limite} pedidos`:'';};
  sh.querySelectorAll('[data-iatar]').forEach(b=>b.onclick=()=>{const t=tarefas[+b.dataset.iatar];if(t[1])enviar(t[1]);else $('#ia_q').focus();});
  $('#iaEnviar').onclick=()=>enviar($('#ia_q').value);
  $('#ia_q').onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();enviar($('#ia_q').value);}};
  $('#ia_anon').onchange=()=>{try{localStorage.setItem('ia_anon',$('#ia_anon').checked?'1':'0');}catch(_){}};
  $('#iaX').onclick=closeForm;
  sh.addEventListener('click',e=>{
    const c=e.target.closest('[data-iacop]');if(c){copiarTexto(conv[+c.dataset.iacop].content);toast('Copiado.');return;}
    const p=e.target.closest('[data-iapeca]');if(p&&typeof abrirPeca==='function'){const t=conv[+p.dataset.iapeca].content.replace(/^#{1,4}\s+/gm,'# ').replace(/\*\*(.+?)\*\*/g,'$1');
      const cli=byId('clientes',clienteId)||byId('clientes',(byId('processos',processoId)||{}).clienteId);
      abrirPeca(null,{titulo:'Rascunho da IA – '+((cli&&cli.nome)||titulo||''),html:textoParaHtml(t),clienteId:(cli&&cli.id)||clienteId,processoId});return;}
    if(e.target.id==='iaFora'){const q=(conv.find(m=>m.role==='user')||{}).content||$('#ia_q').value||'';const t=`${IA_BASE()}\n\nTAREFA:\n${q}\n\nDADOS (copiados do sistema do escritório):\n${ctx()}`;copiarTexto(t);window.open(encodeURIComponent(t).length<7000?`${IA_URL}?q=${encodeURIComponent(t)}`:IA_URL,'_blank','noopener');toast('Pedido copiado. Se não aparecer pronto no Claude, cole (Ctrl+V).',6000);}
  });
  statusIA().then(info=>{if(info&&!info.erro&&!info.chave)semChave();mostrarUso(info);});
  setTimeout(()=>{const q=$('#ia_q');if(q&&innerWidth>620)q.focus();},50);
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
  abrirIA({titulo:`Publicação de ${fmtD(it.data_disponibilizacao)} · ${it.numero||''}`,tipo:'intimacao',contexto:ctxIntimacaoTxt(it),nomes:nomesDe(nomesDoTexto(it.partes),c&&c.nome),clienteId:c?c.id:'',processoId:p?p.id:'',telefone:c?c.telefone:''});
}
async function iaProcesso(id){
  const p=byId('processos',id);if(!p)return;
  const hs=S.intimacoes.filter(i=>digits(i.numero)&&digits(i.numero)===digits(p.numero)).map(i=>i.hash);
  if(hs.length&&typeof carregarTextos==='function')await carregarTextos(hs.slice(0,8));
  const c=byId('clientes',p.clienteId);
  abrirIA({titulo:`Processo ${p.numero||''}`,tipo:'processo',contexto:ctxProcessoTxt(p),nomes:nomesDe(c&&c.nome,p.reclamada),clienteId:c?c.id:'',processoId:p.id,telefone:c?c.telefone:''});
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
  tools(){return `<div class="sub">Converse com a IA aqui mesmo, com os dados do processo, da intimação ou do júri já incluídos. A IA pode errar: revise tudo antes de usar.</div>`;},
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

/* ---------- Saúde do sistema: assistente ligado? ---------- */
(window.HOOKS_CARREGAR=window.HOOKS_CARREGAR||[]).push(async()=>{if(typeof ehGestor==='function'&&ehGestor())statusIA(true).catch(()=>{});});
if(typeof itensSaude==='function'){
  const _itensIA=itensSaude;
  itensSaude=function(){
    const it=_itensIA();const i=IA_ST.info;if(!i)return it;
    if(i.erro)it.push({st:'warn',t:'Assistente de IA',d:'Não foi possível consultar o assistente agora.'});
    else it.push(i.chave?{st:'ok',t:'Assistente de IA',d:`Ligado (modelo ${i.modelo}). Limite de ${i.limite} pedidos por pessoa por dia.`}
      :{st:'warn',t:'Assistente de IA',d:'Ainda sem a chave da API da Anthropic. Veja o passo a passo, "Assistente de IA dentro do sistema".'});
    return it;
  };
}
