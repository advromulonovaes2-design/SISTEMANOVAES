'use strict';
/* =====================================================================
   Segurança: verificação em duas etapas, histórico de alterações e lixeira
   ===================================================================== */

/* ---------- verificação em duas etapas (aplicativo autenticador) ---------- */
async function fatoresTotp(){
  const{data,error}=await sb.auth.mfa.listFactors();if(error)throw error;
  const all=(data&&data.all)||[];
  return{verificados:(data&&data.totp)||all.filter(f=>f.factor_type==='totp'&&f.status==='verified'),todos:all};
}
const qrSrc=q=>!q?'':/^data:/.test(q)?q:'data:image/svg+xml;utf-8,'+encodeURIComponent(q);
function caixaLogin(html){$('#app').hidden=true;const L=$('#login');L.hidden=false;L.innerHTML=`<div class="box"><img class="marca" src="icone-192.png" alt="">${html}</div>`;return L;}

function showCodigoMFA(msg){
  caixaLogin(`<h1>Código de verificação</h1>
    <p>Abra o aplicativo autenticador (Google Authenticator, Microsoft Authenticator…) e digite o código de 6 dígitos de ${esc(S.config.nome||NOME_PADRAO)}.</p>
    ${msg?`<div class="msg">${esc(msg)}</div>`:''}
    <div class="fld"><label for="mfaCod">Código</label><input class="input mono" id="mfaCod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="font-size:24px;letter-spacing:.3em;text-align:center"></div>
    <button class="btn pri" id="mfaOk" type="button">Confirmar</button>
    <button class="btn" id="mfaSair" type="button">Sair</button>`);
  const inp=$('#mfaCod');setTimeout(()=>inp.focus(),50);
  const ir=async()=>{const code=digits(inp.value);if(code.length!==6)return showCodigoMFA('Digite os 6 números.');
    $('#mfaOk').disabled=true;$('#mfaOk').textContent='Conferindo…';
    try{const f=(await fatoresTotp()).verificados[0];if(!f)throw new Error('sem fator');
      const{error}=await sb.auth.mfa.challengeAndVerify({factorId:f.id,code});if(error)throw error;
      const{data}=await sb.auth.getSession();if(data.session)entrar(data.session);
    }catch(e){showCodigoMFA('Código incorreto ou vencido. Espere o próximo código e tente de novo.');}};
  inp.addEventListener('input',()=>{inp.value=digits(inp.value).slice(0,6);if(inp.value.length===6)ir();});
  $('#mfaOk').onclick=ir;$('#mfaSair').onclick=()=>sb.auth.signOut();
}

/* passo a passo para cadastrar o aplicativo; "caixa" é o elemento onde aparece */
async function cadastrarMFA(caixa,aoTerminar){
  caixa.innerHTML='<p class="muted">Preparando…</p>';
  try{
    const{todos}=await fatoresTotp();
    for(const f of todos.filter(f=>f.factor_type==='totp'&&f.status!=='verified')){try{await sb.auth.mfa.unenroll({factorId:f.id});}catch(_){}}
    const{data,error}=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Celular '+new Date().toLocaleString('pt-BR')});
    if(error)throw error;
    caixa.innerHTML=`<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px;font-size:14px">
      <li>Instale no celular o <b>Google Authenticator</b> ou o <b>Microsoft Authenticator</b> (grátis).</li>
      <li>No aplicativo, toque em <b>+</b> e aponte a câmera para o código abaixo.
        <div style="background:#fff;padding:10px;border-radius:8px;width:max-content;max-width:100%;margin-top:8px"><img src="${esc(qrSrc(data.totp.qr_code))}" alt="Código QR para o aplicativo autenticador" width="190" height="190"></div>
        <span class="hint">Sem câmera? Digite esta chave no aplicativo: <span class="mono" style="overflow-wrap:anywhere">${esc(data.totp.secret)}</span> <button class="lnk" type="button" data-copiarlink="${esc(data.totp.secret)}">Copiar</button></span></li>
      <li>Digite o código de 6 dígitos que aparece no aplicativo:
        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap"><input class="input mono" id="mfaNovo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="width:150px;font-size:20px;letter-spacing:.25em;text-align:center"><button class="btn pri" id="mfaNovoOk" type="button">Ativar</button></div></li></ol>`;
    const inp=caixa.querySelector('#mfaNovo'),bt=caixa.querySelector('#mfaNovoOk');
    inp.addEventListener('input',()=>{inp.value=digits(inp.value).slice(0,6);});
    bt.onclick=async()=>{if(inp.value.length!==6)return toast('Digite os 6 números do aplicativo.');bt.disabled=true;bt.textContent='Conferindo…';
      const{error:e2}=await sb.auth.mfa.challengeAndVerify({factorId:data.id,code:inp.value});
      if(e2){bt.disabled=false;bt.textContent='Ativar';toast('Código incorreto. Confira se o horário do celular está automático e tente o próximo código.');return;}
      toast('Verificação em duas etapas ativada.');if(aoTerminar)aoTerminar();};
  }catch(e){console.error(e);caixa.innerHTML=`<div class="banner" style="margin:0">Não foi possível iniciar o cadastro: ${esc(e.message||'erro')}. No Supabase, confira em Authentication → Multi-Factor se o TOTP está ativado.</div>`;}
}
function showCadastroMFA(){
  caixaLogin(`<h1>Proteja sua conta</h1><p>O escritório exige verificação em duas etapas. Leva 2 minutos e só precisa fazer uma vez.</p><div id="mfaPasso"></div><button class="btn" id="mfaSair" type="button">Sair</button>`);
  $('#mfaSair').onclick=()=>sb.auth.signOut();
  cadastrarMFA($('#mfaPasso'),async()=>{const{data}=await sb.auth.getSession();if(data.session)entrar(data.session);});
}
async function renderMfaAjustes(){
  const box=$('#cfMfa');if(!box)return;
  let f;try{f=await fatoresTotp();}catch(e){box.innerHTML='<span class="hint">Não foi possível consultar a verificação em duas etapas agora.</span>';return;}
  const ativo=f.verificados.length>0;
  box.innerHTML=`${ativo?`<div class="banner" style="margin:0;background:var(--ok-soft);color:var(--ok)">Ativa na sua conta${f.verificados[0].created_at?" desde "+fmtDT(f.verificados[0].created_at):""}. Ao entrar, o sistema pede o código do aplicativo.</div>`
      :`<span class="hint">Além da senha, o sistema pede um código que muda a cada 30 segundos no seu celular. Se alguém descobrir sua senha, não consegue entrar.</span><div id="mfaCad"><button class="btn pri" id="mfaAtivar" type="button">Ativar verificação em duas etapas</button></div>`}
    ${ehGestor()?`<label class="chk"><input type="checkbox" id="cfMfaObrig" ${S.config.mfaObrigatorio?'checked':''} ${ativo?'':'disabled'}>Exigir de toda a equipe</label>
    <span class="hint">${ativo?'Quem ainda não tiver cadastrado vai precisar cadastrar no próximo acesso.':'Ative na sua conta primeiro para poder exigir da equipe.'}</span>`:(S.config.mfaObrigatorio?'<span class="hint">O escritório exige a verificação em duas etapas de todos.</span>':'')}
    ${ativo?'<div><button class="btn sm danger" id="mfaDesativar" type="button">Desativar na minha conta</button></div>':''}`;
  const a=$('#mfaAtivar');if(a)a.onclick=()=>cadastrarMFA($('#mfaCad'),renderMfaAjustes);
  const ob=$('#cfMfaObrig');if(ob)ob.onchange=async()=>{if(await salvarConfig({...S.config,mfaObrigatorio:ob.checked}))toast(ob.checked?'Agora toda a equipe precisa da verificação em duas etapas.':'Verificação em duas etapas opcional.');};
  const d=$('#mfaDesativar');if(d)d.onclick=async()=>{
    if(S.config.mfaObrigatorio)return toast('Desmarque “Exigir de toda a equipe” antes de desativar.');
    if(!d.dataset.armed){d.dataset.armed='1';d.textContent='Toque de novo para desativar';setTimeout(()=>{if(d.isConnected){delete d.dataset.armed;d.textContent='Desativar na minha conta';}},4000);return;}
    for(const x of f.verificados){const{error}=await sb.auth.mfa.unenroll({factorId:x.id});if(error){toast('Não foi possível desativar: '+error.message);return;}}
    toast('Verificação em duas etapas desativada.');renderMfaAjustes();};
}

/* ---------- histórico e lixeira ---------- */
const HIST={l:[],ok:false,err:null,f:'',q:''};
const NOME_TAB={equipe:'membro da equipe',clientes:'cliente',processos:'processo',prazos:'prazo',tarefas:'tarefa',honorarios:'contrato de honorários',documentos:'documento',eventos:'compromisso/evento',juri:'caso do júri',modelos:'modelo de petição',config:'ajustes'};
function rotuloCampo(tab,k){const F=FORMS[tab];const f=F&&F.f.find(x=>x.k===k);return f&&f.l?f.l:({checklist:'checklist',teses:'teses',provas:'provas',testemunhas:'testemunhas',jurados:'jurados',roteiro:'roteiro',parcelas:'parcelas',vencimento:'vencimento',govSenha:'senha gov.br',status:'situação',texto:'texto'}[k]||k);}
async function registrarHist(acao,tabela,id,titulo){try{await sb.from('historico').insert({usuario:me&&me.email||'',acao,tabela,registro_id:String(id||''),titulo:String(titulo||'').slice(0,200)});}catch(e){}}
async function carregarHist(){
  const{data,error}=await sb.from('historico').select('*').order('quando',{ascending:false}).limit(500);
  HIST.l=data||[];HIST.err=error;HIST.ok=true;if(cur==='historico')body_();
}
VIEWS.historico={t:'Histórico',
  tools(){return `<div class="sub">Quem criou, alterou ou excluiu cada coisa, e quem abriu senhas gov.br. Itens excluídos podem ser restaurados.</div><div class="tools"><input class="input grow" id="hq" type="search" placeholder="Buscar por pessoa, cliente, processo…" value="${esc(HIST.q)}"><div class="seg" id="segHist"><button data-f="" type="button">Tudo</button><button data-f="excluiu" type="button">Exclusões</button><button data-f="senha" type="button">Senhas gov.br</button></div><button class="btn" id="hRec" type="button">Atualizar</button></div>`;},
  bind(){HIST.ok=false;carregarHist();$('#hq').oninput=e=>{HIST.q=e.target.value;body_();};$('#segHist').onclick=e=>{const b=e.target.closest('button');if(b){HIST.f=b.dataset.f;body_();}};$('#hRec').onclick=()=>{HIST.ok=false;body_();carregarHist();};},
  body(){
    document.querySelectorAll('#segHist button').forEach(x=>x.classList.toggle('on',x.dataset.f===HIST.f));
    if(!HIST.ok)return '<p class="loading">Carregando histórico…</p>';
    if(HIST.err)return '<div class="banner">Não foi possível ler o histórico. Se acabou de atualizar o sistema, rode o arquivo banco/2-atualizacao.sql no Supabase.</div>';
    const q=HIST.q.toLowerCase().trim();
    const l=HIST.l.filter(h=>!HIST.f||(HIST.f==='senha'?/senha/.test(h.acao):h.acao===HIST.f)).filter(h=>!q||[h.usuario,h.titulo,h.tabela,h.acao].join(' ').toLowerCase().includes(q));
    if(!l.length)return vazio('Nada no histórico','As próximas alterações aparecem aqui.');
    let dia='',html='';
    l.forEach(h=>{const d=new Date(h.quando);const ds=d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
      if(ds!==dia){dia=ds;html+=`<div class="sec" style="margin:14px 0 6px"><h2>${esc(ds)}</h2></div>`;}
      const podeRest=h.acao==='excluiu'&&h.antes&&h.antes.id&&TABS.includes(h.tabela)&&!byId(h.tabela,h.antes.id);
      const cor=h.acao==='excluiu'?'a-crim':/senha/.test(h.acao)?'a-prev':'';
      html+=`<div class="row ${cor}" style="margin-bottom:6px"><div class="ev-hora" style="width:48px;font-family:var(--f-mono);font-size:13px;padding-top:2px">${pad(d.getHours())}:${pad(d.getMinutes())}</div><div class="main">
        <div class="t" style="font-weight:500"><b>${esc(String(h.usuario||'').split('@')[0])}</b> ${esc(h.acao)} ${esc(NOME_TAB[h.tabela]||h.tabela||'')}${h.titulo?` <span class="muted">“${esc(h.titulo)}”</span>`:''}</div>
        ${h.campos&&h.campos.length?`<div class="m">Campos: ${esc(h.campos.map(k=>rotuloCampo(h.tabela,k)).join(', '))}</div>`:''}
        ${podeRest?`<div class="acts"><button class="btn sm pri" data-restaurar="${esc(h.id)}" type="button">Restaurar</button></div>`:''}</div></div>`;});
    return html;
  }};
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-restaurar]');if(!b||e.target.closest('#sheet .panel'))return;e.stopPropagation();
  const h=HIST.l.find(x=>String(x.id)===b.dataset.restaurar);if(!h)return;
  b.disabled=true;b.textContent='Restaurando…';
  const id=await salvar(h.tabela,null,h.antes.dados||{},h.antes.id);
  if(id){await registrarHist('restaurou',h.tabela,h.antes.id,h.titulo);toast('Restaurado.');carregarHist();}else{b.disabled=false;b.textContent='Restaurar';}
},true);
// copiar dentro de formulários abertos (ex.: chave do autenticador)
document.addEventListener('click',e=>{const c=e.target.closest('#sheet [data-copiarlink], #login [data-copiarlink]');if(c){e.preventDefault();copiar(c.dataset.copiarlink);}});
