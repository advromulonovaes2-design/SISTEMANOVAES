'use strict';
/* =====================================================================
   Gestores e equipe: aba Acessos (só gestores), "Minha conta" para a
   equipe e saída da conta sem derrubar os outros aparelhos
   ===================================================================== */
S.acessos=[];
async function carregarAcessos(){
  if(!ehGestor()){S.acessos=[];return;}
  const{data,error}=await sb.rpc('acessos_info');
  S.acessos=error?[]:(data||[]);S.acessosErro=!!error;
}
(window.HOOKS_CARREGAR=window.HOOKS_CARREGAR||[]).push(carregarAcessos);
const meuEmail=()=>String(me&&me.email||'').toLowerCase();
const acessoDe=email=>S.acessos.find(a=>a.email===String(email||'').toLowerCase()&&a.liberado);
const membroPorEmail=email=>S.equipe.find(m=>String(m.email||'').toLowerCase()===String(email||'').toLowerCase());

/* sai só deste aparelho; os outros aparelhos e os outros logins continuam como estão */
async function sairDaConta(){
  try{if(typeof trancarCofre==='function')trancarCofre();}catch(_){}
  try{await sb.auth.signOut({scope:'local'});}catch(_){}
  location.replace(location.pathname);
}

function chipAcesso(m){
  if(!ehGestor()||!m.email)return'';
  const a=acessoDe(m.email);
  if(!a)return'<span class="chip c-mute">Sem acesso ao sistema</span>';
  return a.gestor?'<span class="chip c-ok">Gestor</span>':'<span class="chip c-mute">Acessa como equipe</span>';
}

/* quadro dentro do cadastro da equipe */
FORMS.equipe.after=function(v){
  const box=$('#acessoBox');if(!box)return;
  const email=String((v&&v.email)||'').trim().toLowerCase();
  if(!ehGestor()){box.innerHTML='<span class="hint">Você entra no sistema como <b>equipe</b>. Pode mudar aqui seus canais de aviso. O e-mail, a função e o acesso só os gestores mudam.</span>';
    const em=$('#f_email');if(em)em.readOnly=true;return;}
  if(!email){box.innerHTML='<span class="hint">Informe o e-mail para poder liberar o acesso ao sistema.</span>';return;}
  const a=acessoDe(email);
  box.innerHTML=a?`<span class="hint">Acesso ao sistema: <b>${a.gestor?'gestor':'equipe'}</b>. Para mudar ou tirar o acesso, use a aba <a href="#acessos" data-close>Acessos</a>.</span>`
    :`<span class="hint">Este e-mail ainda <b>não</b> entra no sistema.</span><div class="acts" style="margin:4px 0 0"><button class="btn sm" type="button" data-liberar="${esc(email)}" data-g="0">Liberar como equipe</button><button class="btn sm ghost" type="button" data-liberar="${esc(email)}" data-g="1">Liberar como gestor</button></div>`;
};

async function liberarAcesso(email,gestor){
  email=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast('Digite um e-mail válido.');
  const{error}=await sb.from('acesso').upsert({email,gestor:!!gestor});
  if(error)return erroAcesso(error);
  await carregarAcessos();toast(`${email} liberado como ${gestor?'gestor':'equipe'}.`);return true;
}
async function mudarPapel(email,gestor){
  const{error}=await sb.from('acesso').update({gestor:!!gestor}).eq('email',email);
  if(error)return erroAcesso(error);
  await carregarAcessos();toast(gestor?'Agora é gestor.':'Agora é equipe.');body_();
}
async function tirarAcesso(email){
  const{error}=await sb.from('acesso').delete().eq('email',email);
  if(error)return erroAcesso(error);
  await carregarAcessos();toast('Acesso retirado. A pessoa não consegue mais ver nada do sistema.');body_();
}
function erroAcesso(e){const m=String(e&&e.message||'');if(/próprio acesso/.test(m))toast(m);else erroGravar(e);return false;}

VIEWS.acessos={t:'Acessos',
  tools(){return `<div class="sub">Quem entra no sistema e com qual papel. Cada pessoa usa o próprio e-mail e senha; sair de um aparelho não derruba os outros.</div>
    <div class="tools"><form class="acc-form" id="accForm" autocomplete="off"><input class="input" id="acc_email" type="email" placeholder="e-mail da pessoa" aria-label="E-mail"><select class="input" id="acc_papel" aria-label="Papel"><option value="0">Equipe</option><option value="1">Gestor</option></select><button class="btn pri" type="submit">Liberar acesso</button></form></div>`;},
  bind(){$('#accForm').onsubmit=async e=>{e.preventDefault();if(await liberarAcesso($('#acc_email').value,$('#acc_papel').value==='1')){$('#acc_email').value='';body_();}};},
  body(){
    if(S.acessosErro)return '<div class="banner">Para usar esta aba, rode o arquivo banco/2-atualizacao.sql no Supabase.</div>';
    const lib=S.acessos.filter(a=>a.liberado),pend=S.acessos.filter(a=>!a.liberado);
    const eu=meuEmail();
    const quando=a=>a.ultimo_acesso?'Último acesso '+fmtDT(a.ultimo_acesso):a.conta?'Conta criada, ainda não entrou':'Ainda não criou a senha';
    const linha=a=>{const m=membroPorEmail(a.email);const sou=a.email===eu;
      return `<div class="row a-${a.gestor?'adm':'prev'}"><span class="av" style="width:40px;height:40px;font-size:14px;margin-left:4px">${esc(iniciais(m?m.nome:a.email))}</span><div class="main">
        <div class="t">${esc(m?m.nome:a.email)}${sou?' <span class="chip c-mute">você</span>':''}</div>
        <div class="m">${m?esc(a.email)+' · ':''}${esc(quando(a))}</div>
        <div class="chips">${a.gestor?'<span class="chip c-ok">Gestor</span>':'<span class="chip c-mute">Equipe</span>'}${a.duas_etapas?'<span class="chip c-ok">Duas etapas ativas</span>':'<span class="chip c-warn">Sem duas etapas</span>'}${m?'':'<span class="chip c-mute">Não está na Equipe</span>'}</div>
        ${sou?'<span class="hint">Você não pode tirar o seu próprio acesso de gestor. Peça ao outro gestor, se precisar.</span>':`<div class="acts">${a.gestor?`<button class="btn sm" type="button" data-papel="${esc(a.email)}" data-g="0">Tornar equipe</button>`:`<button class="btn sm" type="button" data-papel="${esc(a.email)}" data-g="1">Tornar gestor</button>`}<button class="btn sm ghost" type="button" data-tirar="${esc(a.email)}">Tirar acesso</button>${m?'':`<button class="btn sm ghost" type="button" data-cadequipe="${esc(a.email)}">Cadastrar na Equipe</button>`}</div>`}
      </div></div>`;};
    const g=lib.filter(a=>a.gestor).length,e=lib.length-g;
    return `<div class="sec"><h2>Liberados · ${g} ${g===1?'gestor':'gestores'} e ${e} da equipe</h2><div class="list">${lib.map(linha).join('')||'<span class="muted">Ninguém liberado.</span>'}</div></div>
      ${pend.length?`<div class="sec"><h2>Criaram conta, mas não estão liberados</h2><span class="hint" style="display:block;margin-bottom:8px">Essas pessoas fizeram o "Primeiro acesso", mas não veem nada do sistema. Libere só quem você conhece.</span><div class="list">${pend.map(a=>`<div class="row"><div class="main"><div class="t">${esc(a.email)}</div><div class="m">Conta criada em ${fmtDT(a.desde)}${a.confirmado?'':' · e-mail ainda não confirmado'}</div><div class="acts"><button class="btn sm pri" type="button" data-liberar="${esc(a.email)}" data-g="0">Liberar como equipe</button><button class="btn sm" type="button" data-liberar="${esc(a.email)}" data-g="1">Liberar como gestor</button></div></div></div>`).join('')}</div></div>`:''}
      <div class="sec"><h2>O que cada um pode fazer</h2><div class="grid2">
        <div class="row"><div class="main"><div class="t">Gestor</div><div class="m">Tudo: Ajustes do escritório, Equipe, Acessos, Financeiro, Relatórios, Histórico e excluir registros.</div></div></div>
        <div class="row"><div class="main"><div class="t">Equipe</div><div class="m">Clientes, processos, prazos, intimações, tarefas, júri, documentos e agenda: vê, cadastra e edita. Não vê financeiro, relatórios nem histórico, e não exclui (só cartões de tarefa). Muda só os próprios canais de aviso.</div></div></div>
      </div><span class="hint" style="display:block;margin-top:8px">As regras valem no próprio banco de dados: mesmo quem tentar por fora do sistema não consegue passar delas.</span></div>`;
  }};

document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-liberar],[data-papel],[data-tirar],[data-cadequipe]');if(!t||!ehGestor())return;
  e.preventDefault();e.stopPropagation();
  if(t.dataset.liberar){if(await liberarAcesso(t.dataset.liberar,t.dataset.g==='1')){if(SH&&SH.refresh)SH.refresh();else if(FORMS.equipe.after&&$('#acessoBox'))FORMS.equipe.after({email:t.dataset.liberar});body_();}return;}
  if(t.dataset.papel){if(!t.dataset.armed){t.dataset.armed='1';t.textContent=t.dataset.g==='1'?'Confirmar: tornar gestor':'Confirmar: tornar equipe';return;}return mudarPapel(t.dataset.papel,t.dataset.g==='1');}
  if(t.dataset.tirar){if(!t.dataset.armed){t.dataset.armed='1';t.textContent='Toque de novo para tirar';return;}return tirarAcesso(t.dataset.tirar);}
  if(t.dataset.cadequipe){openForm('equipe',null,{email:t.dataset.cadequipe});}
},true);

/* "Minha conta" para quem é da equipe */
function openMinhaConta(){
  const sh=$('#sheet');SH={col:'__conta'};const m=membroPorEmail(meuEmail());
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="mcT"><div class="ph"><h3 id="mcT">Minha conta</h3><button class="btn ghost sm" id="mcX" type="button">Fechar</button></div>
    <div class="pb">
      <div class="fld"><span class="hint">Você entrou como <b>${esc(meuEmail())}</b> · papel: <b>equipe</b>. Os ajustes do escritório, o financeiro e os acessos ficam com os gestores.</span>${m?`<div><button class="btn sm" type="button" id="mcEq">Meus canais de aviso (Telegram, WhatsApp)</button></div>`:''}</div>
      <div class="grouph">Notificações no celular</div><div class="fld" id="cfPush"><span class="hint">Carregando…</span></div>
      <div class="grouph">Verificação em duas etapas</div><div class="fld" id="cfMfa"><span class="hint">Carregando…</span></div>
      <div class="grouph">Sobre</div><div class="fld"><span class="hint">Versão ${VERSAO}.</span></div>
    </div>
    <div class="pf"><button class="btn" id="mcSair" type="button">Sair da conta neste aparelho</button><div class="r"><button class="btn pri" id="mcOk" type="button">Fechar</button></div></div></div>`;
  sh.hidden=false;
  $('#mcX').onclick=$('#mcOk').onclick=closeForm;$('#mcSair').onclick=()=>{closeForm();sairDaConta();};
  const eq=$('#mcEq');if(eq)eq.onclick=()=>{closeForm();openForm('equipe',m.id);};
  if(typeof renderPushAjustes==='function')renderPushAjustes();
  if(typeof renderMfaAjustes==='function')renderMfaAjustes();
}

/* botão Sair no topo e nome de quem está logado */
function mostrarQuemSou(){
  const q=$('#quemSou');if(!q||!me)return;const m=membroPorEmail(meuEmail());
  q.textContent=(m&&m.nome?m.nome.split(' ')[0]:meuEmail())+' · '+(ehGestor()?'gestor':'equipe');q.title=meuEmail();
}
(window.HOOKS_CARREGAR=window.HOOKS_CARREGAR||[]).push(async()=>{setTimeout(mostrarQuemSou,0);});
document.addEventListener('click',e=>{
  const b=e.target.closest('#btnSair');if(!b)return;
  if(!b.dataset.armed){b.dataset.armed='1';b.textContent='Sair mesmo?';setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='Sair';}},4000);return;}
  sairDaConta();
});
