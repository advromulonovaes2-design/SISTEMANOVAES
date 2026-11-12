'use strict';
/* =====================================================================
   Palha Novaes Advocacia — núcleo: dados, login, telas e formulários
   ===================================================================== */

/* ---------- utilidades ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const SEM=['dom','seg','ter','qua','qui','sex','sáb'];
const fmtD=s=>{if(!s||!/^\d{4}-\d{2}-\d{2}/.test(s))return'—';const d=parseD(s.slice(0,10));return pad(d.getUTCDate())+'/'+pad(d.getUTCMonth()+1)+'/'+d.getUTCFullYear();};
const fmtDS=s=>{if(!s||!/^\d{4}-\d{2}-\d{2}/.test(s))return'—';const d=parseD(s.slice(0,10));return SEM[d.getUTCDay()]+', '+fmtD(s);};
const fmtDT=s=>{if(!s)return'';const d=new Date(s);if(isNaN(d))return'';return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();};
const hojeStr=()=>{const n=new Date();return n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate());};
const diffDias=s=>Math.round((parseD(s.slice(0,10))-parseD(hojeStr()))/864e5);
const iniciais=n=>String(n||'?').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?';
const uid=()=>(crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));
const digits=s=>String(s||'').replace(/\D/g,'');
const brl=n=>(Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}).replace(/\u00a0/g,' ');
function toast(msg,ms){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,ms||3200);}
const areaCls=a=>a==='Previdenciário'?'prev':a==='Criminal'?'crim':a==='Trabalhista'?'trab':'adm';
const areaChip=a=>a?`<span class="chip c-${areaCls(a)}">${esc(a)}</span>`:'';
const vazio=(titulo,texto,col,btn)=>`<div class="empty"><b>${titulo}</b><span>${texto}</span>${col?`<button class="btn pri" data-new="${col}" type="button">${btn}</button>`:''}</div>`;
const fmtCNJ=v=>{const d=digits(v);return d.length===20?`${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16)}`:String(v||'').trim();};
const fmtCPF=v=>{const d=digits(v);return d.length===11?`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`:String(v||'').trim();};
const fmtCEP=v=>{const d=digits(v);return d.length===8?`${d.slice(0,5)}-${d.slice(5)}`:String(v||'').trim();};
function copiar(txt){
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(()=>toast('Copiado.'),()=>toast('Não deu para copiar. Selecione o texto e copie.'));}
  else toast('Selecione o texto e copie.');
}

/* ---------- dados ---------- */
const VERSAO='3.12 · 12/11/2026';
let PAPEL='equipe';const ehGestor=()=>PAPEL==='gestor';
const SO_GESTOR=['financeiro','relatorios','historico','acessos'];
const TABS=['equipe','clientes','processos','prazos','tarefas','honorarios','documentos','eventos','juri','modelos'];
const TABS_NOVAS=['eventos','juri','modelos'];
const S={equipe:[],clientes:[],processos:[],prazos:[],tarefas:[],honorarios:[],documentos:[],eventos:[],juri:[],config:{},intimacoes:[],movs:{}};
let sb=null,me=null,lastSync=null,syncErr=false,carregado=false;
const NOME_PADRAO='Palha Novaes Advocacia';
// logo padrão do escritório para procuração e contrato (pode ser trocada nos Ajustes)
function carregarLogoPadrao(){if(window.LOGO_PADRAO)return;fetch('logo-documento.png').then(r=>r.ok?r.blob():null).then(b=>{if(!b)return;const fr=new FileReader();fr.onload=()=>{window.LOGO_PADRAO=fr.result;};fr.readAsDataURL(b);}).catch(()=>{});}
const byId=(c,id)=>id?S[c].find(x=>x.id===id):null;
const rowToRec=r=>({...(r.dados||{}),id:r.id,criadoEm:r.criado_em,atualizadoEm:r.atualizado_em});
const limpa=rec=>{const o={...rec};delete o.id;delete o.criadoEm;delete o.atualizadoEm;return o;};

async function carregar(t){const{data,error}=await sb.from(t).select('*');if(error){if(TABS_NOVAS.includes(t)&&/does not exist|42P01|PGRST205|schema cache/i.test((error.message||'')+' '+(error.code||''))){S[t]=[];S.faltaTabela=true;return;}throw error;}S[t]=data.map(rowToRec);}
const INT_COLS='hash,origem,oab,cliente_id,responsavel_id,numero,tribunal,orgao,classe,tipo,tipo_documento,data_disponibilizacao,link,partes,ultima_mov,ultima_mov_data,status,processo_id,criado_em';
async function lerIntimacoes(cols){
  let out=[];
  for(let ini=0;ini<5000;ini+=1000){ // o Supabase entrega no máximo 1000 por vez
    const{data,error}=await sb.from('intimacoes').select(cols).order('data_disponibilizacao',{ascending:false}).order('hash').range(ini,ini+999);
    if(error)return{error};out=out.concat(data||[]);if(!data||data.length<1000)break;
  }
  return{data:out};
}
async function carregarIntimacoes(){
  // versão leve: sem o texto das publicações (o banco já classifica arquivamento, sentença e audiência)
  let r=await lerIntimacoes(INT_COLS+',f_arq,f_sent,f_aud,aud_data');
  if(r.error){ // banco ainda sem a atualização: carrega do jeito antigo, com o texto
    r=await lerIntimacoes(INT_COLS+',texto');if(r.error)throw r.error;S.intLeve=false;S.intimacoes=r.data;return;}
  S.intLeve=true;
  // o texto só das novas (é o que aparece na lista e sugere o prazo)
  const novas=r.data.filter(i=>i.status==='nova').map(i=>i.hash);
  const txt={};
  for(let k=0;k<novas.length;k+=200){const{data}=await sb.from('intimacoes').select('hash,texto').in('hash',novas.slice(k,k+200));(data||[]).forEach(x=>txt[x.hash]=x.texto);}
  r.data.forEach(i=>{if(i.hash in txt)i.texto=txt[i.hash];});
  S.intimacoes=r.data;
}
async function carregarTextos(hashes){
  const falta=hashes.filter(h=>{const i=S.intimacoes.find(x=>x.hash===h);return i&&i.texto===undefined;});
  for(let k=0;k<falta.length;k+=200){const{data,error}=await sb.from('intimacoes').select('hash,texto').in('hash',falta.slice(k,k+200));if(error)return false;
    (data||[]).forEach(x=>{const i=S.intimacoes.find(y=>y.hash===x.hash);if(i)i.texto=x.texto||'';});}
  return true;
}
async function carregarTudo(){
  try{
    await Promise.all([
      ...TABS.map(carregar),
      sb.from('config').select('*').eq('id','geral').maybeSingle().then(({data,error})=>{if(error)throw error;S.config=data?.dados||{};}),
      carregarIntimacoes(),
      ...(window.HOOKS_CARREGAR||[]).map(f=>f()),
      sb.from('movimentacoes').select('*').then(({data,error})=>{if(error)throw error;S.movs={};(data||[]).forEach(m=>S.movs[m.numero]=m);})
    ]);
    carregado=true;syncErr=false;lastSync=new Date();applyConfig();
  }catch(e){console.error(e);syncErr=true;toast('Não foi possível carregar os dados. Verifique a internet.');}
  setSync();body_();
}
function setSync(){
  const dot=$('#syncDot'),n=$('#syncNote');if(!dot)return;dot.className='dot';
  if(syncErr){dot.classList.add('err');n.innerHTML='Sem conexão · <button type="button" id="btnSync">tentar de novo</button>';}
  else if(lastSync){dot.classList.add('on');n.innerHTML=`Atualizado às ${pad(lastSync.getHours())}:${pad(lastSync.getMinutes())} · <button type="button" id="btnSync">atualizar</button>`;}
  else n.textContent='Carregando…';
  const b=$('#btnSync');if(b)b.onclick=carregarTudo;
}
function applyConfig(){setFeriadosLocais(S.config.feriados||'');if(typeof setSuspensoes==='function')setSuspensoes(S.config.suspensoes||[]);$('#officeName').textContent=S.config.nome||NOME_PADRAO;document.title=S.config.nome||NOME_PADRAO;}
function erroGravar(e){
  console.error(e);const m=String(e&&(e.message||e.error_description||e)||'');
  if(/row-level|permission|42501|policy/i.test(m+(e&&e.code)))toast(ehGestor()?'Seu e-mail não tem permissão para gravar. Confira a aba Acessos.':'Isso só os gestores podem fazer. Peça a um deles.');
  else if(/Failed to fetch|NetworkError/i.test(m))toast('Sem internet. Nada foi salvo; tente de novo.');
  else toast('Não foi possível salvar: '+m.slice(0,120));
}
async function salvar(col,id,data,novoId){
  const now=new Date().toISOString();
  try{
    if(id){const{error}=await sb.from(col).update({dados:limpa(data),atualizado_em:now}).eq('id',id);if(error)throw error;await carregar(col);body_();return id;}
    const row={dados:limpa(data)};if(novoId)row.id=novoId;
    const{data:r,error}=await sb.from(col).insert(row).select('id').single();if(error)throw error;await carregar(col);body_();return r.id;
  }catch(e){erroGravar(e);return null;}
}
async function atualizar(col,id,patch){const r=byId(col,id);if(!r)return false;return !!(await salvar(col,id,{...r,...patch}));}
async function excluir(col,id){if(!ehGestor()&&col!=='tarefas'){toast('Só os gestores podem excluir. Peça a um deles.');return false;}try{const{error}=await sb.from(col).delete().eq('id',id);if(error)throw error;await carregar(col);body_();return true;}catch(e){erroGravar(e);return false;}}
async function salvarConfig(cfg){try{const{error}=await sb.from('config').upsert({id:'geral',dados:cfg});if(error)throw error;S.config=cfg;applyConfig();body_();return true;}catch(e){erroGravar(e);return false;}}
async function mudarIntimacao(hash,patch){try{const{error}=await sb.from('intimacoes').update(patch).eq('hash',hash);if(error)throw error;const it=S.intimacoes.find(x=>x.hash===hash);if(it)Object.assign(it,patch);body_();return true;}catch(e){erroGravar(e);return false;}}

/* ---------- arquivos (Supabase Storage, pasta privada) ---------- */
async function enviarArquivo(file,pasta){
  if(typeof prepararArquivo==='function')file=await prepararArquivo(file);
  if(file.size>15*1024*1024){toast('Arquivo maior que 15 MB. Reduza ou tire outra foto.');return null;}
  const ext=((file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,5))||'bin';
  const path=`${pasta}/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;
  const{error}=await sb.storage.from('arquivos').upload(path,file,{upsert:false,contentType:file.type||undefined});
  if(error){erroGravar(error);return null;}
  return path;
}
async function linkArquivo(path,segundos){let b='arquivos';if(/^envios:/.test(path)){b='envios';path=path.slice(7);}const{data,error}=await sb.storage.from(b).createSignedUrl(path,segundos||300);if(error){erroGravar(error);return null;}return data.signedUrl;}
async function abrirArquivo(path){
  const w=window.open('','_blank');const url=await linkArquivo(path,300);
  if(!url){if(w)w.close();return;}
  if(w)w.location=url;else location.href=url;
}
function escolherArquivo(accept){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept=accept||'image/*,application/pdf';i.onchange=()=>res(i.files&&i.files[0]||null);i.click();});}

/* ---------- login ---------- */
function showLogin(msg,ok){
  $('#app').hidden=true;const L=$('#login');L.hidden=false;
  L.innerHTML=`<div class="box">
    <img class="marca" src="icone-192.png" alt="">
    <h1>${esc(S.config.nome||NOME_PADRAO)}</h1>
    <p id="lgSub">Entre com o e-mail liberado pelo escritório.</p>
    ${msg?`<div class="msg ${ok?'ok':''}">${esc(msg)}</div>`:''}
    <div class="fld"><label for="lgEmail">E-mail</label><input class="input" id="lgEmail" type="email" autocomplete="email"></div>
    <div class="fld"><label for="lgSenha">Senha</label><input class="input" id="lgSenha" type="password" autocomplete="current-password"></div>
    <button class="btn pri" id="lgEntrar" type="button">Entrar</button>
    <div class="links"><button class="lnk" id="lgCriar" type="button">Primeiro acesso: criar senha</button><button class="lnk" id="lgEsqueci" type="button">Esqueci a senha</button></div>
    ${me?`<button class="btn" id="lgSair" type="button">Sair desta conta</button>`:''}
  </div>`;
  const em=()=>$('#lgEmail').value.trim(),se=()=>$('#lgSenha').value;
  $('#lgEntrar').onclick=async()=>{if(!em()||!se())return showLogin('Preencha e-mail e senha.');const{error}=await sb.auth.signInWithPassword({email:em(),password:se()});if(error)showLogin(/confirm/i.test(error.message)?'Confirme seu e-mail pelo link que enviamos antes de entrar.':'E-mail ou senha incorretos.');};
  $('#lgSenha').onkeydown=e=>{if(e.key==='Enter')$('#lgEntrar').click();};
  $('#lgCriar').onclick=async()=>{if(!em()||se().length<8)return showLogin('Para criar a senha, digite seu e-mail e uma senha com pelo menos 8 caracteres e toque de novo em "Primeiro acesso".');const{error}=await sb.auth.signUp({email:em(),password:se(),options:{emailRedirectTo:location.origin+location.pathname}});if(error)return showLogin('Não foi possível criar: '+error.message);showLogin('Pronto! Abra o e-mail que enviamos e toque no link de confirmação. Depois volte aqui e entre.',true);};
  $('#lgEsqueci').onclick=async()=>{if(!em())return showLogin('Digite seu e-mail e toque de novo em "Esqueci a senha".');const{error}=await sb.auth.resetPasswordForEmail(em(),{redirectTo:location.origin+location.pathname});if(error)return showLogin('Não foi possível enviar: '+error.message);showLogin('Enviamos um link para criar uma nova senha. Confira seu e-mail.',true);};
  const s=$('#lgSair');if(s)s.onclick=sairDaConta;
}
function showNovaSenha(){
  $('#app').hidden=true;const L=$('#login');L.hidden=false;
  L.innerHTML=`<div class="box"><h1>Nova senha</h1><p>Digite a nova senha (mínimo 8 caracteres).</p>
  <div class="fld"><label for="nsSenha">Nova senha</label><input class="input" id="nsSenha" type="password" autocomplete="new-password"></div>
  <button class="btn pri" id="nsOk" type="button">Salvar nova senha</button></div>`;
  $('#nsOk').onclick=async()=>{const p=$('#nsSenha').value;if(p.length<8)return toast('Use pelo menos 8 caracteres.');const{error}=await sb.auth.updateUser({password:p});if(error)return toast('Não foi possível: '+error.message);toast('Senha alterada.');history.replaceState(null,'',location.pathname);const{data}=await sb.auth.getSession();if(data.session)entrar(data.session);};
}
let entrando=false;
// não recarrega a tela enquanto alguém está com um formulário aberto ou escrevendo no editor
function podeAtualizar(){return !SH&&!document.querySelector('.ed-area')&&!document.querySelector('[data-semrecarga]');}
async function entrar(session){
  if(entrando)return;entrando=true;me=session.user;
  try{
    let estado='ok';
    const r=await sb.rpc('estado_acesso');
    if(r.error){const{data:ok,error}=await sb.rpc('autorizado');estado=(!error&&ok)?'ok':'sem_permissao';}else estado=r.data;
    if(estado==='sem_permissao'){showLogin(`O e-mail ${me.email} ainda não foi liberado. Peça a um gestor do escritório para liberar na aba Acessos.`);return;}
    if(estado==='codigo'){showCodigoMFA();return;}
    if(estado==='cadastrar_mfa'){showCadastroMFA();return;}
    try{const p=await sb.rpc('meu_papel');PAPEL=p.error?'gestor':(p.data==='gestor'?'gestor':'equipe');}catch(_){PAPEL='gestor';}
    document.body.classList.toggle('equipe',!ehGestor());document.querySelectorAll('header [data-cfg]').forEach(b=>b.textContent=ehGestor()?'Ajustes':'Minha conta');
    $('#login').hidden=true;$('#app').hidden=false;
    go(location.hash.slice(1));
    await carregarTudo();
    if(!entrar._timer){entrar._timer=setInterval(()=>{if(document.visibilityState==='visible'&&podeAtualizar())carregarTudo();},120000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&me&&podeAtualizar()&&(!lastSync||Date.now()-lastSync>60000))carregarTudo();});}
  }finally{entrando=false;}
}
function boot(){
  const C=window.CONFIG||{};
  if(!window.supabase||!C.SUPABASE_URL||/COLE-AQUI/.test(C.SUPABASE_URL+C.SUPABASE_ANON_KEY)){
    $('#login').hidden=false;$('#login').innerHTML=`<div class="box"><h1>Falta configurar</h1><p>Abra o arquivo <b>config.js</b> e cole a Project URL e a chave pública do Supabase. O passo a passo explica onde encontrar.</p></div>`;return;
  }
  sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
  carregarLogoPadrao();
  sb.auth.onAuthStateChange((ev,s)=>{
    if(ev==='PASSWORD_RECOVERY'){setTimeout(showNovaSenha,0);return;}
    if(s){if(!me||me.id!==s.user.id||$('#app').hidden)setTimeout(()=>entrar(s),0);}
    else{me=null;carregado=false;if(typeof trancarCofre==='function')trancarCofre();setTimeout(()=>showLogin(),0);}
  });
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
}

/* ---------- prazos ---------- */
const comTribunal=p=>{const pr=byId('processos',p.processoId);return pr&&pr.tribunal?{...p,tribunal:pr.tribunal}:p;};
function prazoCalc(p){ // vencimento calculado, ou o ajustado à mão
  const r=calcPrazo(comTribunal(p));
  if(p.vencManual&&/^\d{4}-\d{2}-\d{2}$/.test(p.vencManual))return{...(r||{}),venc:p.vencManual,manual:true,calculado:r?r.venc:''};
  return r;
}
function prazoInfo(p){
  const r=prazoCalc(p);if(!r)return{r:null,dd:null,st:'mute',txt:'Sem data'};
  const dd=diffDias(r.venc);
  if(p.cumprido)return{r,dd,st:'ok',txt:'Cumprido'};
  let st='ok',txt=dd===0?'Vence hoje':dd===1?'Vence amanhã':dd>1?`Faltam ${dd} dias`:`Venceu há ${-dd} ${-dd===1?'dia':'dias'}`;
  if(dd<0)st='danger';else if(dd<=3)st='warn';
  return{r,dd,st,txt};
}
const regraTxt=p=>`${p.dias||'?'} ${p.contagem==='corridos'?'dias corridos · CPP':'dias úteis'}${p.justica==='federal'?' · JF':p.justica==='trabalho'?' · JT':''}`;
function procLabel(pr){if(!pr)return'';const c=byId('clientes',pr.clienteId);return (pr.numero||'Sem número')+(c?' — '+c.nome:'');}

/* ---------- checklist de documentos por caso ---------- */
const CK_SEMPRE=[['procuracao','Procuração assinada'],['contrato','Contrato de honorários assinado'],['identidade','RG e CPF (ou CNH)'],['residencia','Comprovante de residência']];
const CK_CRIM=[['bo','Boletim de ocorrência ou auto de prisão em flagrante'],['autos','Cópia do inquérito ou da ação penal'],['antecedentes','Certidões de antecedentes criminais'],['trabalho','Comprovante de trabalho ou ocupação lícita'],['dependentes','Certidões dos filhos / dependentes'],['testemunhas','Rol de testemunhas com contato'],['hipossuf','Declaração de hipossuficiência (se pedir gratuidade)']];
const CK_PREV=[['cnis','CNIS (extrato previdenciário)'],['ctps','Carteiras de trabalho (todas as páginas)'],['decisaoinss','Protocolo e decisão do INSS'],['hipossuf','Declaração de hipossuficiência (se pedir gratuidade)']];
const CK_INCAP=[['laudos','Laudos, atestados e relatórios médicos (com CID)'],['exames','Exames e receitas'],['internacao','Comprovantes de internação ou cirurgia (se houver)']];
const CK_ESP={
  B21:[['obito','Certidão de óbito do segurado'],['vinculo','Certidão de casamento ou provas de união estável'],['docfalecido','Documentos do falecido'],['filhos','Certidões de nascimento dos dependentes']],
  B25:[['recolhimento','Certidão de recolhimento prisional atualizada'],['vinculo','Certidão de casamento ou provas de união estável'],['filhos','Certidões de nascimento dos dependentes'],['docsegurado','Documentos do segurado recluso']],
  B31:CK_INCAP,B32:CK_INCAP,
  B36:[...CK_INCAP,['cat','CAT – Comunicação de Acidente de Trabalho']],
  B91:[...CK_INCAP,['cat','CAT – Comunicação de Acidente de Trabalho']],
  B41:[['carnes','Guias de contribuição (GPS) e carnês'],['rural','Provas de atividade rural, se for o caso (autodeclaração, ITR, notas, sindicato)']],
  B42:[['carnes','Guias de contribuição (GPS) e carnês'],['ctc','Certidão de tempo de contribuição (se teve serviço público)'],['pppper','PPP dos períodos especiais (se houver)']],
  B46:[['ppp','PPP – Perfil Profissiográfico Previdenciário'],['ltcat','LTCAT / laudos técnicos'],['funcoes','Registros das funções exercidas']],
  B57:[['magisterio','Declaração de tempo de magistério'],['carnes','Guias de contribuição (GPS) e carnês']],
  B80:[['nascimento','Certidão de nascimento da criança'],['atividade','Provas da atividade (rural, MEI ou contribuinte individual)']],
  B87:[['cadunico','CadÚnico atualizado'],['laudos','Laudos e relatórios médicos (com CID)'],['renda','Comprovantes de renda da família'],['familia','Documentos de quem mora na casa']],
  B88:[['cadunico','CadÚnico atualizado'],['renda','Comprovantes de renda da família'],['familia','Documentos de quem mora na casa']],
  REV:[['concessao','Carta de concessão e memória de cálculo'],['periodo','Documentos do período a revisar']]
};
const TRAB_TIPOS=['Verbas rescisórias / reclamação geral','Vínculo sem carteira assinada','Horas extras e jornada','Acidente ou doença do trabalho','Insalubridade / periculosidade','Assédio moral / dano moral','Rescisão indireta','Gestante / estabilidade'];
const CK_TRAB=[['ctps','Carteira de trabalho (física e digital, todas as páginas)'],['contracheques','Contracheques / holerites'],['trct','TRCT e guias da rescisão (se houver)'],['fgts','Extrato do FGTS'],['contrato_trab','Contrato de trabalho e aditivos (se houver)'],['provas_trab','Provas: mensagens, e-mails, áudios, fotos'],['testemunhas','Rol de testemunhas com contato'],['hipossuf','Declaração de hipossuficiência (justiça gratuita)']];
const CK_TRAB_TIPO={
  'Vínculo sem carteira assinada':[['pagamentos','Comprovantes de pagamento (Pix, depósitos, recibos)'],['uniforme','Fotos de uniforme, crachá ou local de trabalho'],['cnis','CNIS (extrato previdenciário)']],
  'Horas extras e jornada':[['ponto','Cartões de ponto, escalas ou registros de login/GPS'],['jornada','Anotação da jornada real (horários de entrada, saída e intervalo)']],
  'Acidente ou doença do trabalho':[['cat','CAT – Comunicação de Acidente de Trabalho'],['laudos','Laudos, atestados e exames (com CID)'],['aso','ASOs (admissional, periódicos, demissional)'],['ppp','PPP – Perfil Profissiográfico Previdenciário'],['afastamento','Comprovante de afastamento pelo INSS (B91/B31)']],
  'Insalubridade / periculosidade':[['ppp','PPP – Perfil Profissiográfico Previdenciário'],['ltcat','LTCAT / PGR / laudos ambientais (se tiver)'],['epi','Fichas de entrega de EPI'],['fotos_local','Fotos do local e descrição das atividades']],
  'Assédio moral / dano moral':[['laudos_psi','Atestados ou relatórios médicos/psicológicos'],['bo','Boletim de ocorrência (se houver)']],
  'Rescisão indireta':[['falta_grave','Provas da falta do empregador (salários atrasados, FGTS sem depósito, etc.)']],
  'Gestante / estabilidade':[['gestacao','Exame ou ultrassom com a data da gestação'],['nascimento','Certidão de nascimento (se já nasceu)']]
};
function checklistItens(v){
  const it=[...CK_SEMPRE];const add=l=>l.forEach(x=>{if(!it.some(y=>y[0]===x[0]))it.push(x);});
  if(v.area==='Criminal')add(CK_CRIM);
  else if(v.area==='Previdenciário'){add(CK_PREV);const e=String(v.especie||'');add(CK_ESP[e.split(' ')[0]]||(e.startsWith('Revisão')?CK_ESP.REV:[]));}
  else if(v.area==='Trabalhista'){add(CK_TRAB);add(CK_TRAB_TIPO[v.tipoTrab]||[]);}
  return it;
}
/* o caso escolhido no cadastro do cliente, ex.: "Previdenciário|B87 BPC/LOAS…" */
function ckCasoDe(c){
  const[a,x]=String(c&&c.ckCaso||'').split('|');
  if(a==='Previdenciário')return{area:a,especie:x||''};
  if(a==='Trabalhista')return{area:a,tipoTrab:x||''};
  if(a==='Criminal')return{area:a};
  return{area:c&&['Previdenciário','Criminal','Trabalhista'].includes(c.area)?c.area:''};
}
const docAssinado=(k,f)=>S.documentos.find(x=>x.tipo===k&&x.status==='assinado'&&x.assinado&&f(x));
function ckAuto(k,v){ // itens que já vêm marcados de outros cadastros (formulário de processo)
  const cli=byId('clientes',v.clienteId);
  if(k==='identidade'&&cli&&cli.docIdentidade)return{arquivo:cli.docIdentidade,origem:'cadastro do cliente'};
  if(k==='residencia'&&cli&&cli.comprovante)return{arquivo:cli.comprovante,origem:'cadastro do cliente'};
  if(k==='procuracao'||k==='contrato'){const d=docAssinado(k,x=>(SH&&SH.id&&x.processoId===SH.id)||(!x.processoId&&cli&&x.clienteId===cli.id));if(d)return{arquivo:d.assinado,origem:'aba Documentos'};}
  const cc=cli&&cli.checklist&&cli.checklist[k];if(cc&&cc.ok)return{arquivo:cc.arquivo||'',origem:'cadastro do cliente'};
  return null;
}
function ckAutoCliente(k){ // formulário do cliente
  if(k==='identidade'&&SH.files.docIdentidade)return{arquivo:SH.files.docIdentidade,origem:'campo RG e CPF'};
  if(k==='residencia'&&SH.files.comprovante)return{arquivo:SH.files.comprovante,origem:'campo comprovante'};
  if((k==='procuracao'||k==='contrato')&&SH.id){const d=docAssinado(k,x=>x.clienteId===SH.id);if(d)return{arquivo:d.assinado,origem:'aba Documentos'};}
  return null;
}
function ckResumoCliente(c){
  const itens=checklistItens(ckCasoDe(c)),ck=c.checklist||{};let ok=0;
  itens.forEach(([k])=>{if((ck[k]&&ck[k].ok)||(k==='identidade'&&c.docIdentidade)||(k==='residencia'&&c.comprovante)||((k==='procuracao'||k==='contrato')&&docAssinado(k,x=>x.clienteId===c.id)))ok++;});
  return{ok,total:itens.length};
}
function ckResumo(pr){
  const itens=checklistItens(pr);const ck=pr.checklist||{};
  let ok=0;itens.forEach(([k])=>{if((ck[k]&&ck[k].ok)||ckAutoFor(k,pr))ok++;});
  return{ok,total:itens.length};
}
function ckAutoFor(k,pr){const cli=byId('clientes',pr.clienteId);if(k==='identidade'&&cli&&cli.docIdentidade)return true;if(k==='residencia'&&cli&&cli.comprovante)return true;if((k==='procuracao'||k==='contrato')&&S.documentos.some(x=>x.tipo===k&&x.status==='assinado'&&(x.processoId===pr.id||(!x.processoId&&cli&&x.clienteId===cli.id))))return true;const cc=cli&&cli.checklist&&cli.checklist[k];return !!(cc&&cc.ok);}

/* ---------- linhas das listas ---------- */
function rowPrazo(p){
  const i=prazoInfo(p),pr=byId('processos',p.processoId),cli=pr?byId('clientes',pr.clienteId):null,resp=byId('equipe',p.responsavelId);
  const d=i.r?parseD(i.r.venc):null;
  const blk=d?`<div class="dateblk ${p.cumprido?'':i.st==='danger'?'danger':i.st==='warn'?'warn':''}"><b>${pad(d.getUTCDate())}</b><span>${MES[d.getUTCMonth()]}</span></div>`:`<div class="dateblk"><b>—</b><span>data</span></div>`;
  return `<div class="row click a-${pr?areaCls(pr.area):'adm'} ${p.cumprido?'done':''}" data-edit="prazos" data-id="${esc(p.id)}" role="button" tabindex="0">
    ${blk}
    <div class="main">
      <div class="t">${esc(p.descricao||'Prazo sem descrição')}</div>
      <div class="m">${pr?`<span class="mono">${esc(pr.numero||'Sem número')}</span>`:'Sem processo vinculado'}${cli?' · '+esc(cli.nome):''}</div>
      <div class="chips"><span class="chip c-${i.st}">${esc(i.txt)}</span><span class="chip c-mute">${esc(regraTxt(p))}</span>${i.r&&i.r.manual?'<span class="chip c-warn">Ajustado à mão</span>':''}${p.reuPreso&&p.contagem==='corridos'?'<span class="chip c-preso">Réu preso</span>':''}${resp?`<span class="chip c-mute">${esc(resp.nome)}</span>`:''}${typeof chipConferencia==='function'?chipConferencia(p):''}</div>
    </div>
    <div class="side">${typeof botaoConferir==='function'?botaoConferir(p):''}<button class="btn sm ${p.cumprido?'':'pri'}" data-done="${esc(p.id)}" type="button">${p.cumprido?'Reabrir':'Cumprido'}</button></div>
  </div>`;
}
function rowProcesso(pr){
  const c=byId('clientes',pr.clienteId),resp=byId('equipe',pr.responsavelId);
  const abertos=S.prazos.filter(p=>p.processoId===pr.id&&!p.cumprido).length;
  const fase=pr.area==='Previdenciário'?pr.fasePrev:pr.area==='Criminal'?pr.faseCrim:pr.area==='Trabalhista'?pr.faseTrab:pr.faseOutro;
  const presc=pr.area==='Trabalhista'&&pr.demissao&&/Antes de ajuizar/.test(pr.faseTrab||'')?prescricaoBienal(pr.demissao):null;
  const extra=pr.area==='Previdenciário'?[pr.especie,pr.nb?'NB '+pr.nb:''].filter(Boolean).join(' · '):pr.area==='Criminal'?(pr.tipoPenal||''):pr.area==='Trabalhista'?[pr.tipoTrab,pr.reclamada?'contra '+pr.reclamada:''].filter(Boolean).join(' · '):'';
  const mv=S.movs[digits(pr.numero)];const ck=ckResumo(pr);
  return `<div class="row click a-${areaCls(pr.area)}" data-edit="processos" data-id="${esc(pr.id)}" role="button" tabindex="0">
    <div class="main">
      <div class="t mono">${esc(pr.numero||'Sem número')}</div>
      <div class="m">${c?esc(c.nome):'Cliente não informado'}${pr.vara?' · '+esc(pr.vara):''}${pr.tribunal?' · '+esc(pr.tribunal):''}</div>
      ${extra?`<div class="m">${esc(extra)}</div>`:''}
      ${mv&&mv.nome?`<div class="mov"><b>Última movimentação</b>${esc(mv.nome)}${mv.data?' — '+fmtDT(mv.data):''}</div>`:''}
      <div class="chips">${areaChip(pr.area)}${pr.area==='Criminal'&&pr.reuPreso?'<span class="chip c-preso">Réu preso</span>':''}${fase?`<span class="chip c-mute">${esc(fase)}</span>`:''}${abertos?`<span class="chip c-warn">${abertos} ${abertos===1?'prazo aberto':'prazos abertos'}</span>`:''}<span class="chip ${ck.ok===ck.total?'c-ok':'c-mute'}">Docs ${ck.ok}/${ck.total}</span>${presc?`<span class="chip ${presc.dd<=120?'c-danger':'c-warn'}">Ajuizar até ${fmtD(presc.lim)} (prescrição bienal)</span>`:''}${resp?`<span class="chip c-mute">${esc(resp.nome)}</span>`:''}</div>
      ${typeof acoesProcesso==='function'?acoesProcesso(pr):''}
    </div>
  </div>`;
}
function rowCliente(c){
  const n=S.processos.filter(p=>p.clienteId===c.id).length;
  const ck=ckResumoCliente(c),caso=ckCasoDe(c);const multi=['Ambos','Mais de uma área'].includes(c.area);
  const areas=multi?[...new Set(S.processos.filter(p=>p.clienteId===c.id).map(p=>p.area).filter(a=>a&&a!=='Outro'))]:[c.area];
  const casoTxt=caso.especie||caso.tipoTrab||'';
  return `<div class="row click a-${multi?'adm':areaCls(c.area)}" data-edit="clientes" data-id="${esc(c.id)}" role="button" tabindex="0">
    <div class="main">
      <div class="t">${esc(c.nome||'Sem nome')}</div>
      <div class="m">${[c.cpf?`<span class="mono">${esc(c.cpf)}</span>`:'',esc(c.telefone),esc(c.email)].filter(Boolean).join(' · ')||'Sem contato cadastrado'}</div>
      ${c.cidade?`<div class="m">${esc(c.cidade)}${c.uf?'/'+esc(c.uf):''}</div>`:''}
      ${casoTxt?`<div class="m">${esc(casoTxt)}</div>`:''}
      <div class="chips">${areas.length?areas.map(areaChip).join(''):'<span class="chip c-mute">Mais de uma área</span>'}<span class="chip c-mute">${n} ${n===1?'processo':'processos'}</span><span class="chip ${ck.ok===ck.total?'c-ok':ck.ok?'c-warn':'c-danger'}">Documentos ${ck.ok}/${ck.total}</span>${c.monitorar?'<span class="chip c-mute">Monitorado no DJEN</span>':''}${c.govSenha&&c.govSenha.ct?'<span class="chip c-mute">gov.br no cofre</span>':''}</div>
      ${typeof acoesCliente==='function'?acoesCliente(c):''}
    </div>
  </div>`;
}
function rowEquipe(m){
  const pz=S.prazos.filter(p=>p.responsavelId===m.id&&!p.cumprido).length;
  const tf=S.tarefas.filter(t=>t.responsavelId===m.id&&t.coluna!=='concluido').length;
  const canais=[m.email?'E-mail':'',m.telegram?'Telegram':'',m.callmebot?'WhatsApp':''].filter(Boolean);
  return `<div class="row click ${m.ativo===false?'soft':''}" data-edit="equipe" data-id="${esc(m.id)}" role="button" tabindex="0">
    <span class="av" style="width:40px;height:40px;font-size:14px;margin-left:4px">${esc(iniciais(m.nome))}</span>
    <div class="main">
      <div class="t">${esc(m.nome||'Sem nome')}${m.ativo===false?' <span class="chip c-mute">Inativo</span>':''}</div>
      <div class="m">${esc(m.funcao||'Função não informada')}${m.oab?' · OAB <span class="mono">'+esc(m.oab)+'</span>':''}</div>
      <div class="chips"><span class="chip ${pz?'c-warn':'c-mute'}">${pz} ${pz===1?'prazo':'prazos'}</span><span class="chip c-mute">${tf} ${tf===1?'tarefa':'tarefas'}</span>${canais.length?`<span class="chip c-ok">Avisos: ${canais.join(', ')}</span>`:'<span class="chip c-warn">Sem canal de aviso</span>'}${typeof chipAcesso==='function'?chipAcesso(m):''}</div>
    </div>
  </div>`;
}
function guessArea(it){
  const s=[it.tribunal,it.orgao,it.classe,it.tipo_documento].join(' ').toLowerCase();
  if(/crim|penal|j[úu]ri|cust[óo]dia|inqu[ée]rito|flagrante|habeas/.test(s))return'Criminal';
  if(/trabalh|reclama[çc][ãa]o trabalhista|\btrt\b|vara do trabalho/.test(s)||/^trt/i.test(it.tribunal||''))return'Trabalhista';
  if(/previd|inss|benef|juizado especial federal|jef|aposentad|aux[íi]lio|loas|bpc/.test(s)||/^trf/i.test(it.tribunal||''))return'Previdenciário';
  return'Outro';
}
function rowIntimacao(it){
  const st=it.status||'nova',resp=byId('equipe',it.responsavel_id),cli=byId('clientes',it.cliente_id),area=guessArea(it);
  const txt=String(it.texto||'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();const longo=txt.length>320;
  const link=/^https?:\/\//.test(it.link||'')?it.link:'';
  const jaProc=digits(it.numero)?S.processos.find(p=>digits(p.numero)===digits(it.numero)):null;
  return `<div class="row a-${areaCls(area)} ${st==='nova'?'':'soft'}">
    ${st==='nova'?`<label class="selint" title="Selecionar"><input type="checkbox" data-selint="${esc(it.hash)}" ${UI.selInt&&UI.selInt.has(it.hash)?'checked':''} aria-label="Selecionar intimação"></label>`:''}
    <div class="main">
      <div class="chips"><span class="chip ${st==='nova'?'c-warn':st==='cadastrada'?'c-ok':'c-mute'}">${st==='nova'?'Nova':st==='cadastrada'?'Cadastrada':st==='antiga'?'Antiga':st==='excluida'?'Excluída':'Ignorada'}</span>${it.tribunal?`<span class="chip c-mute">${esc(it.tribunal)}</span>`:''}${it.tipo_documento||it.tipo?`<span class="chip c-mute">${esc(it.tipo_documento||it.tipo)}</span>`:''}${area!=='Outro'?areaChip(area):''}${jaProc?'<span class="chip c-ok">Processo já cadastrado</span>':''}</div>
      <div class="t mono">${esc(it.numero||'Sem número')}</div>
      <div class="m">Disponibilizada em ${fmtDS(it.data_disponibilizacao)}${it.orgao?' · '+esc(it.orgao):''}</div>
      ${it.classe?`<div class="m">${esc(it.classe)}</div>`:''}
      ${it.partes?`<div class="m">Partes: ${esc(it.partes)}</div>`:''}
      <div class="m">Encontrada pela ${it.origem==='nome'?'busca do cliente'+(cli?' '+esc(cli.nome):''):'OAB '+esc(it.oab||'')}${resp?' · '+esc(resp.nome):''}</div>
      ${it.ultima_mov?`<div class="mov"><b>Última movimentação</b>${esc(it.ultima_mov)}${it.ultima_mov_data?' — '+fmtDT(it.ultima_mov_data):''}</div>`:''}
      ${it.texto===undefined?`<div><button class="lnk" type="button" data-inttxt="${esc(it.hash)}">Mostrar o texto da publicação</button></div>`:''}
      ${txt?`<div class="teor" data-teor-box><span>${esc(longo?txt.slice(0,320)+'…':txt)}</span><span hidden>${esc(txt)}</span>${longo?' <button class="lnk" data-teor type="button">Ler tudo</button>':''}</div>`:''}
      <div class="acts">${st==='nova'?`<button class="btn pri sm" data-cad="${esc(it.hash)}" type="button">${jaProc?'Lançar prazo':'Cadastrar'}</button><button class="btn sm" data-ign="${esc(it.hash)}" type="button">Ignorar</button>`:st==='ignorada'?`<button class="btn sm" data-reab="${esc(it.hash)}" type="button">Voltar para novas</button>`:''}${link?`<a class="btn sm ghost" href="${esc(link)}" target="_blank" rel="noopener">Abrir no DJEN</a>`:''}<button class="btn sm ghost" type="button" data-iaint="${esc(it.hash)}">Perguntar à IA</button></div>
    </div>
  </div>`;
}

/* ---------- telas ---------- */
const UI={prazoF:'abertos',resp:'',respT:'',q:{processos:'',clientes:''},area:'',intF:'nova',finF:'parcelas'};
const respOptions=sel=>`<option value="">Toda a equipe</option>`+S.equipe.filter(m=>m.ativo!==false).map(m=>`<option value="${esc(m.id)}" ${sel===m.id?'selected':''}>${esc(m.nome)}</option>`).join('');
const VIEWS={};
let cur='inicio';

VIEWS.inicio={t:'Início',
  tools(){const n=new Date();return `<div class="sub">${SEM[n.getDay()]}, ${n.getDate()} de ${MESES[n.getMonth()]} de ${n.getFullYear()}</div>`;},
  body(){
    const ab=S.prazos.filter(p=>!p.cumprido).map(p=>({p,i:prazoInfo(p)})).filter(x=>x.i.r);
    const venc=ab.filter(x=>x.i.dd<0).length,hoje=ab.filter(x=>x.i.dd===0).length,sem=ab.filter(x=>x.i.dd>0&&x.i.dd<=7).length;
    const presos=S.processos.filter(p=>p.area==='Criminal'&&p.reuPreso).length;
    const novas=S.intimacoes.filter(i=>(i.status||'nova')==='nova').length;
    const atras=typeof parcelasTodas==='function'?parcelasTodas().filter(x=>!x.p.pago&&diffDias(x.p.venc)<0):[];
    const prox=ab.filter(x=>x.i.dd<=7).sort((a,b)=>a.i.r.venc.localeCompare(b.i.r.venc)).slice(0,8);
    const tAb=S.tarefas.filter(t=>t.coluna!=='concluido');const porResp={};tAb.forEach(t=>{porResp[t.responsavelId||'']=(porResp[t.responsavelId||'']||0)+1;});
    const vazioTudo=!S.equipe.length&&!S.clientes.length&&!S.processos.length;
    return `<div class="stats">
      <a class="stat ${venc?'alert':''}" href="#prazos"><span>Prazos vencidos</span><b>${venc}</b></a>
      <a class="stat ${hoje?'warn':''}" href="#prazos"><span>Vencem hoje</span><b>${hoje}</b></a>
      <a class="stat" href="#prazos"><span>Próx. 7 dias</span><b>${sem}</b></a>
      <a class="stat ${novas?'warn':''}" href="#intimacoes"><span>Intimações novas</span><b>${novas}</b></a>
      <a class="stat ${presos?'alert':''}" href="#processos"><span>Réus presos</span><b>${presos}</b></a>
      <a class="stat so-gestor ${atras.length?'alert':''}" href="#financeiro"><span>Parcelas atrasadas</span><b>${atras.length}</b></a>
    </div>
    ${vazioTudo?`<div class="sec"><h2>Primeiros passos</h2><div class="list">
      <button class="row click" data-cfg type="button"><div class="main"><div class="t">1. Preencha os Ajustes</div><div class="m">Nome do escritório, endereço, logo e feriados locais.</div></div></button>
      <button class="row click" data-new="equipe" type="button"><div class="main"><div class="t">2. Cadastre a equipe</div><div class="m">Você e os colegas, com OAB e canais de aviso.</div></div></button>
      <button class="row click" data-new="clientes" type="button"><div class="main"><div class="t">3. Cadastre um cliente</div><div class="m">Qualificação completa, documentos e endereço.</div></div></button>
      <button class="row click" data-new="processos" type="button"><div class="main"><div class="t">4. Vincule um processo</div><div class="m">O checklist de documentos aparece conforme o caso.</div></div></button>
    </div></div>`:''}
    <div class="sec"><h2>Prazos até ${fmtD(ymd(addD(parseD(hojeStr()),7)))} <a href="#prazos">Ver todos</a></h2>
      ${prox.length?`<div class="list">${prox.map(x=>rowPrazo(x.p)).join('')}</div>`:vazio('Nenhum prazo vencendo nesta semana','Os prazos dos próximos 7 dias e os vencidos aparecem aqui.')}</div>
    <div class="sec"><h2>Tarefas em aberto <a href="#tarefas">Abrir quadro</a></h2>
      ${tAb.length?`<div class="list">${Object.entries(porResp).sort((a,b)=>b[1]-a[1]).map(([id,n])=>{const m=byId('equipe',id);return `<div class="row"><span class="av" style="margin-left:4px">${esc(m?iniciais(m.nome):'—')}</span><div class="main"><div class="t">${esc(m?m.nome:'Sem responsável')}</div></div><div class="side"><span class="chip c-mute">${n} ${n===1?'tarefa':'tarefas'}</span></div></div>`;}).join('')}</div>`:vazio('Nenhuma tarefa em aberto','Crie tarefas no quadro e distribua para a equipe.')}</div>`;
  }};

VIEWS.intimacoes={t:'Intimações',
  tools(){return `<div class="sub">O robô consulta o DJEN pelas OABs da equipe e pelos clientes monitorados, de segunda a sexta às 7h e às 16h.</div><div class="tools"><div class="seg" id="segInt"><button data-f="nova" type="button">Novas</button><button data-f="cadastrada" type="button">Cadastradas</button><button data-f="ignorada" type="button">Ignoradas</button><button data-f="todas" type="button">Todas</button><button data-f="processos" type="button">Processos da OAB</button></div></div>`;},
  bind(){$('#segInt').onclick=e=>{const b=e.target.closest('button');if(b){UI.intF=b.dataset.f;body_();}};},
  body(){
    document.querySelectorAll('#segInt button').forEach(x=>x.classList.toggle('on',x.dataset.f===UI.intF));
    if(UI.intF==='processos'&&typeof processosDaOab==='function')return processosDaOab();
    const norm=o=>String(o||'').toUpperCase().replace(/\s+/g,' ').replace(/ 0+(\d)/,' $1');
    const l=S.intimacoes.filter(i=>UI.intF==='todas'?i.status!=='excluida':(i.status||'nova')===UI.intF)
      .filter(i=>!UI.intOab||norm(i.oab)===UI.intOab).filter(i=>!UI.intResp||i.responsavel_id===UI.intResp).slice(0,400);
    const oabs=[...new Set(S.intimacoes.map(i=>norm(i.oab)).filter(Boolean))].sort();
    const sel=UI.selInt||(UI.selInt=new Set());[...sel].forEach(h=>{if(!l.some(i=>i.hash===h&&(i.status||'nova')==='nova'))sel.delete(h);});
    const novasVis=l.filter(i=>(i.status||'nova')==='nova');
    const filtros=`<div class="tools intfiltros"><select class="input" id="intOab" aria-label="Filtrar por OAB"><option value="">Todas as OABs</option>${oabs.map(o=>`<option ${o===UI.intOab?'selected':''}>${esc(o)}</option>`).join('')}</select><select class="input" id="intResp" aria-label="Filtrar por responsável">${respOptions(UI.intResp)}</select>${novasVis.length?`<label class="chk"><input type="checkbox" id="intTodas" ${sel.size&&sel.size===novasVis.length?'checked':''}>Selecionar todas</label>`:''}${sel.size?`<button class="btn sm" id="intIgnSel" type="button">Ignorar selecionadas (${sel.size})</button>`:''}</div>`;
    if(l.length)return filtros+`<div class="list">${l.map(rowIntimacao).join('')}</div>`;
    if(UI.intOab||UI.intResp)return filtros+vazio('Nada com esses filtros','Troque a OAB ou o responsável acima.');
    if(!S.intimacoes.length)return vazio('Nenhuma intimação ainda','Cadastre as OABs na aba Equipe. Depois que o robô rodar, as intimações aparecem aqui para você cadastrar com um toque.');
    return vazio('Nada neste filtro','Troque o filtro acima para ver as outras.');
  }};

VIEWS.prazos={t:'Prazos',
  tools(){return `<div class="tools"><div class="seg" id="segPrazo"><button data-f="abertos" type="button">Abertos</button><button data-f="cumpridos" type="button">Cumpridos</button><button data-f="todos" type="button">Todos</button></div><select class="input" id="fResp" aria-label="Responsável"></select><button class="btn pri push" data-new="prazos" type="button">+ Novo prazo</button></div>`;},
  bind(){$('#segPrazo').onclick=e=>{const b=e.target.closest('button');if(b){UI.prazoF=b.dataset.f;body_();}};$('#fResp').onchange=e=>{UI.resp=e.target.value;body_();};},
  body(){
    $('#fResp').innerHTML=respOptions(UI.resp);
    document.querySelectorAll('#segPrazo button').forEach(x=>x.classList.toggle('on',x.dataset.f===UI.prazoF));
    const l=S.prazos.filter(p=>UI.prazoF==='todos'||(UI.prazoF==='cumpridos'?p.cumprido:!p.cumprido)).filter(p=>!UI.resp||p.responsavelId===UI.resp);
    l.sort((a,b)=>(prazoInfo(a).r?.venc||'9999').localeCompare(prazoInfo(b).r?.venc||'9999'));
    return l.length?`<div class="list">${l.map(rowPrazo).join('')}</div>`:(S.prazos.length?vazio('Nada por aqui','Nenhum prazo neste filtro.'):vazio('Nenhum prazo cadastrado','Informe a data da publicação ou intimação e o sistema calcula o vencimento.','prazos','+ Cadastrar primeiro prazo'));
  }};

const COLUNAS=[['afazer','A fazer'],['andamento','Em andamento'],['aguardando','Aguardando cliente/órgão'],['concluido','Concluído']];
VIEWS.tarefas={t:'Tarefas',
  tools(){return `<div class="tools"><select class="input" id="fRespT" aria-label="Responsável"></select><span class="muted" style="font-size:13px">No computador, arraste os cartões entre as colunas.</span><button class="btn pri push" data-new="tarefas" type="button">+ Nova tarefa</button></div>`;},
  bind(){$('#fRespT').onchange=e=>{UI.respT=e.target.value;body_();};},
  body(){
    $('#fRespT').innerHTML=respOptions(UI.respT);
    const l=S.tarefas.filter(t=>!UI.respT||t.responsavelId===UI.respT);
    return `<div class="boardwrap"><div class="board">${COLUNAS.map(([k,nome],ci)=>{
      const cs=l.filter(t=>(t.coluna||'afazer')===k).sort((a,b)=>(a.dataLimite||'9999').localeCompare(b.dataLimite||'9999'));
      return `<div class="col" data-col="${k}"><div class="colh"><b>${nome}</b><span class="n">${cs.length}</span></div>
        ${cs.map(t=>{const m=byId('equipe',t.responsavelId),pr=byId('processos',t.processoId);
          let dl='';if(t.dataLimite){const dd=diffDias(t.dataLimite);const st=k==='concluido'?'mute':dd<0?'danger':dd<=2?'warn':'mute';dl=`<span class="chip c-${st}">${fmtD(t.dataLimite).slice(0,5)}</span>`;}
          return `<div class="card" draggable="true" data-task="${esc(t.id)}" tabindex="0">
            <div class="t">${esc(t.titulo||'Tarefa sem título')}</div>
            ${pr?`<div class="mono" style="font-size:12px;color:var(--muted);overflow-wrap:anywhere">${esc(pr.numero||'')}</div>`:''}
            <div class="ft"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${areaChip(t.area)}${dl}</div>
            <div style="display:flex;gap:6px;align-items:center"><div class="mv">${ci>0?`<button data-mv="-1" data-id="${esc(t.id)}" type="button" aria-label="Mover para a coluna anterior">‹</button>`:''}${ci<COLUNAS.length-1?`<button data-mv="1" data-id="${esc(t.id)}" type="button" aria-label="Mover para a próxima coluna">›</button>`:''}</div>${m?`<span class="av" title="${esc(m.nome)}">${esc(iniciais(m.nome))}</span>`:''}</div></div>
          </div>`;}).join('')}
        <button class="addcard" data-new="tarefas" data-colnew="${k}" type="button">+ Adicionar tarefa</button></div>`;}).join('')}</div></div>`;
  }};

VIEWS.processos={t:'Processos',
  tools(){return `<div class="tools"><input class="input grow" id="fq" type="search" placeholder="Buscar por número, cliente, vara, NB…" value="${esc(UI.q.processos)}"><div class="seg" id="segArea"><button data-a="" type="button">Todos</button><button data-a="Previdenciário" type="button">Prev.</button><button data-a="Criminal" type="button">Criminal</button><button data-a="Trabalhista" type="button">Trab.</button></div><button class="btn pri" data-new="processos" type="button">+ Novo processo</button></div>`;},
  bind(){$('#fq').oninput=e=>{UI.q.processos=e.target.value;body_();};$('#segArea').onclick=e=>{const b=e.target.closest('button');if(b){UI.area=b.dataset.a;body_();}};},
  body(){
    document.querySelectorAll('#segArea button').forEach(x=>x.classList.toggle('on',x.dataset.a===UI.area));
    const q=UI.q.processos.toLowerCase().trim();
    const l=S.processos.filter(p=>!UI.area||p.area===UI.area).filter(p=>!q||[p.numero,digits(p.numero),p.vara,p.tribunal,p.nb,byId('clientes',p.clienteId)?.nome].join(' ').toLowerCase().includes(q));
    l.sort((a,b)=>(b.atualizadoEm||'').localeCompare(a.atualizadoEm||''));
    return l.length?`<div class="list">${l.map(rowProcesso).join('')}</div>`:(S.processos.length?vazio('Nenhum processo encontrado','Tente outro termo de busca.'):vazio('Nenhum processo cadastrado','Cadastre o cliente primeiro e depois vincule o processo a ele.','processos','+ Cadastrar processo'));
  }};

VIEWS.clientes={t:'Clientes',
  tools(){return `<div class="tools"><input class="input grow" id="fq" type="search" placeholder="Buscar por nome, CPF, telefone…" value="${esc(UI.q.clientes)}"><button class="btn pri" data-new="clientes" type="button">+ Novo cliente</button></div>`;},
  bind(){$('#fq').oninput=e=>{UI.q.clientes=e.target.value;body_();};},
  body(){
    const q=UI.q.clientes.toLowerCase().trim();
    const l=S.clientes.filter(c=>!q||[c.nome,c.cpf,digits(c.cpf),c.telefone,c.email].join(' ').toLowerCase().includes(q)).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));
    return l.length?`<div class="grid2">${l.map(rowCliente).join('')}</div>`:(S.clientes.length?vazio('Nenhum cliente encontrado','Tente outro termo de busca.'):vazio('Nenhum cliente cadastrado','Comece pela qualificação: nome, CPF, RG e endereço. Ela é usada na procuração e no contrato.','clientes','+ Cadastrar cliente'));
  }};

VIEWS.equipe={t:'Equipe',
  tools(){return `<div class="tools"><span class="muted" style="font-size:13.5px">A OAB de cada advogado é usada pelo robô para buscar intimações. Os canais de aviso recebem prazos e novidades.</span><button class="btn pri push" data-new="equipe" type="button">+ Novo membro</button></div>`;},
  body(){
    const l=[...S.equipe].sort((a,b)=>(a.ativo===false)-(b.ativo===false)||String(a.nome).localeCompare(String(b.nome),'pt-BR'));
    return l.length?`<div class="grid2">${l.map(rowEquipe).join('')}</div>`:vazio('Ninguém cadastrado na equipe','Comece por você: nome, função, OAB e onde quer receber os avisos.','equipe','+ Cadastrar membro');
  }};

function go(v){
  if(!VIEWS[v]||(!ehGestor()&&SO_GESTOR.includes(v)))v='inicio';cur=v;
  document.querySelectorAll('#nav [data-v]').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  const mais=$('#navMais');if(mais)mais.classList.toggle('on',!['inicio','prazos','intimacoes','clientes'].includes(v));
  const V=VIEWS[v];
  $('#view').innerHTML=`<div class="vhead"><h1>${V.t}</h1>${V.tools?V.tools():''}</div><div id="vbody"></div>`;
  if(V.bind)V.bind();
  window.scrollTo(0,0);body_();
}
function body_(){
  const b=$('#vbody');
  const venc=S.prazos.filter(p=>!p.cumprido&&(prazoInfo(p).dd??1)<=0).length;
  const novas=S.intimacoes.filter(i=>(i.status||'nova')==='nova').length;
  const setB=(id,n)=>{const e=$(id);if(e){e.hidden=!n;e.textContent=n;}};
  setB('#badgePrazos',venc);setB('#badgeInt',novas);
  if(!b)return;
  if(!carregado){b.innerHTML='<p class="loading">Carregando dados do escritório…</p>';return;}
  b.innerHTML=(S.faltaTabela?'<div class="banner">Falta atualizar o banco: rode o arquivo <b>banco/2-atualizacao.sql</b> no SQL Editor do Supabase para liberar o Calendário, o Júri e a Linha do tempo.</div>':'')+VIEWS[cur].body();
  if(VIEWS[cur].after)VIEWS[cur].after();
}

/* ---------- formulários ---------- */
const ESPECIES=['B21 Pensão por morte','B25 Auxílio-reclusão','B31 Auxílio por incapacidade temporária','B32 Aposentadoria por incapacidade permanente','B36 Auxílio-acidente','B41 Aposentadoria por idade','B42 Aposentadoria por tempo de contribuição','B46 Aposentadoria especial','B57 Aposentadoria do professor','B80 Salário-maternidade','B87 BPC/LOAS à pessoa com deficiência','B88 BPC/LOAS à pessoa idosa','B91 Auxílio por incapacidade acidentário','Revisão de benefício','Outro'];
const FASE_PREV=['Requerimento no INSS','Exigência / cumprimento','Indeferido — avaliar recurso','Recurso administrativo (CRPS)','Petição inicial','Perícia / audiência','Sentença','Recurso (Turma Recursal / TRF)','Cumprimento / RPV / precatório','Benefício implantado','Arquivado'];
const FASE_CRIM=['Inquérito policial','Audiência de custódia','Denúncia / queixa','Resposta à acusação','Instrução','Alegações finais','Sentença','Recurso','Tribunal do Júri','Execução penal','Arquivado'];
const UFS=['','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SE','SP','TO'];
const isPrev=f=>f.area==='Previdenciário',isCrim=f=>f.area==='Criminal',isTrab=f=>f.area==='Trabalhista';
const isPrevCli=f=>['Previdenciário','Mais de uma área','Ambos'].includes(f.area);
const FASE_TRAB=['Antes de ajuizar (coleta de documentos)','Reclamação ajuizada','Audiência inicial / una','Perícia','Audiência de instrução','Sentença','Recurso ordinário (TRT)','Recurso de revista (TST)','Liquidação / cálculos','Execução','Acordo homologado','Arquivado'];
const CK_CASOS=[['','— Escolha o caso —'],{g:'Previdenciário',o:ESPECIES.map(e=>['Previdenciário|'+e,e])},{g:'Criminal',o:[['Criminal|','Criminal (documentos padrão)']]},{g:'Trabalhista',o:TRAB_TIPOS.map(t=>['Trabalhista|'+t,t])}];
function prescricaoBienal(saida){const d=parseD(saida);const lim=ymd(new Date(Date.UTC(d.getUTCFullYear()+2,d.getUTCMonth(),d.getUTCDate())));return{lim,dd:diffDias(lim)};}
const FORMS={
  equipe:{t:'Membro da equipe',f:[
    {k:'nome',l:'Nome completo',t:'text',req:1},
    {k:'funcao',l:'Função',t:'select',o:['Advogado(a)','Estagiário(a)','Secretário(a)','Financeiro','Outro'],half:1},
    {k:'oab',l:'OAB (UF e número)',t:'text',ph:'PA 012345',half:1,show:f=>/Advog|Estagi/.test(f.funcao||''),hint:'O robô busca intimações por esta OAB.'},
    {g:'Avisos de prazos e intimações'},
    {k:'email',l:'E-mail',t:'email',half:1},{k:'telefone',l:'WhatsApp (com DDD)',t:'tel',ph:'91 98888-7777',half:1},
    {k:'telegram',l:'Telegram: ID do chat',t:'text',half:1,mono:1,hint:'Toque em Iniciar no bot do escritório e peça o ID ao @userinfobot.'},
    {k:'callmebot',l:'WhatsApp: chave CallMeBot',t:'text',half:1,mono:1,hint:'Opcional e não oficial. Veja o passo a passo.'},
    {g:'No escritório'},
    {k:'ativo',l:'Ativo no escritório',t:'check',def:true},
    {k:'_acesso',t:'html',id:'acessoBox'}]},
  clientes:{t:'Cliente',f:[
    {g:'Qualificação'},
    {k:'nome',l:'Nome completo',t:'text',req:1},
    {k:'nacionalidade',l:'Nacionalidade',t:'text',half:1,def:'brasileiro(a)'},
    {k:'estadoCivil',l:'Estado civil',t:'select',o:['','solteiro(a)','casado(a)','em união estável','divorciado(a)','separado(a)','viúvo(a)'],half:1},
    {k:'profissao',l:'Profissão',t:'text',half:1},{k:'nascimento',l:'Data de nascimento',t:'date',half:1},
    {k:'cpf',l:'CPF',t:'text',ph:'000.000.000-00',half:1,fmt:'cpf',mono:1},
    {k:'rg',l:'RG',t:'text',half:1,mono:1},{k:'rgOrgao',l:'Órgão emissor / UF',t:'text',ph:'SSP/PA',half:1},
    {k:'mae',l:'Nome da mãe',t:'text',half:1},
    {g:'Contato e endereço'},
    {k:'telefone',l:'Telefone / WhatsApp',t:'tel',half:1},{k:'email',l:'E-mail',t:'email',half:1},
    {k:'cep',l:'CEP',t:'text',half:1,fmt:'cep',mono:1,hint:'Digite o CEP e o endereço é preenchido.'},
    {k:'logradouro',l:'Rua / avenida',t:'text',half:1},
    {k:'numero',l:'Número',t:'text',half:1},{k:'complemento',l:'Complemento',t:'text',half:1},
    {k:'bairro',l:'Bairro',t:'text',half:1},{k:'cidade',l:'Cidade',t:'text',half:1},
    {k:'uf',l:'UF',t:'select',o:UFS,half:1},
    {k:'area',l:'Área',t:'select',o:['Previdenciário','Criminal','Trabalhista','Mais de uma área'],half:1},
    {g:'Documentos pessoais'},
    {k:'docIdentidade',l:'RG e CPF (ou CNH)',t:'file'},
    {k:'comprovante',l:'Comprovante de residência',t:'file'},
    {g:'Checklist de documentos'},
    {k:'ckCaso',l:'Qual caso você vai trabalhar?',t:'select',o:CK_CASOS,hint:'A lista abaixo muda conforme o caso. Procuração, contrato, RG/CPF e comprovante de residência estão sempre nela.'},
    {k:'checklist',l:'Checklist',t:'checklist'},
    {k:'_envios',t:'html',id:'enviosBox'},
    {k:'_acomp',t:'html',id:'acompBox'},
    {g:'Previdenciário',show:isPrevCli},
    {k:'nit',l:'NIT / PIS',t:'text',half:1,mono:1,show:isPrevCli},
    {k:'meuInss',l:'Tem acesso ao Meu INSS?',t:'select',o:['Não sei','Sim','Não'],half:1,show:isPrevCli},
    {g:'Acompanhamento'},
    {k:'monitorar',l:'Procurar intimações pelo nome deste cliente no DJEN',t:'check'},
    {k:'obs',l:'Observações',t:'area',hint:'O modo de pagamento dos honorários fica na aba Financeiro.'}]},
  processos:{t:'Processo',f:[
    {k:'numero',l:'Número (CNJ) ou protocolo do INSS',t:'text',ph:'0000000-00.0000.0.00.0000',fmt:'cnj',mono:1,hint:'Cole os 20 dígitos que o sistema formata. A última movimentação vem da API do CNJ.'},
    {k:'_cnj',t:'html',id:'cnjBox'},
    {k:'clienteId',l:'Cliente',t:'ref',col:'clientes',lab:c=>c.nome,novo:'＋ Cadastrar cliente novo…'},
    {k:'area',l:'Área',t:'select',o:['Previdenciário','Criminal','Trabalhista','Outro'],half:1},
    {k:'responsavelId',l:'Responsável',t:'ref',col:'equipe',lab:m=>m.nome,half:1},
    {k:'tribunal',l:'Tribunal / órgão',t:'text',ph:'TRF1, TJPA, INSS…',half:1},{k:'vara',l:'Vara / juízo',t:'text',ph:'1ª Vara Federal / JEF…',half:1},
    {g:'Previdenciário',show:isPrev},
    {k:'especie',l:'Espécie de benefício',t:'select',o:ESPECIES,show:isPrev},
    {k:'nb',l:'NB',t:'text',half:1,mono:1,show:isPrev},{k:'der',l:'DER',t:'date',half:1,show:isPrev},
    {k:'fasePrev',l:'Fase',t:'select',o:FASE_PREV,show:isPrev},
    {k:'dib',l:'DIB',t:'date',half:1,show:isPrev,hint:'Data de início do benefício.'},{k:'dip',l:'DIP',t:'date',half:1,show:isPrev,hint:'Data de início do pagamento.'},
    {k:'rmi',l:'RMI (R$)',t:'number',half:1,show:isPrev},{k:'atrasados',l:'Atrasados previstos (R$)',t:'number',half:1,show:isPrev},
    {g:'Criminal',show:isCrim},
    {k:'tipoPenal',l:'Tipificação',t:'text',ph:'Art. 155 do CP…',show:isCrim},
    {k:'faseCrim',l:'Fase',t:'select',o:FASE_CRIM,half:1,show:isCrim},
    {k:'reuPreso',l:'Réu preso',t:'check',half:1,show:isCrim},
    {k:'custodia',l:'Local de custódia',t:'text',show:f=>isCrim(f)&&f.reuPreso},
    {g:'Trabalhista',show:isTrab},
    {k:'tipoTrab',l:'Tipo de causa',t:'select',o:TRAB_TIPOS,show:isTrab},
    {k:'reclamada',l:'Reclamada (empresa)',t:'text',half:1,show:isTrab},{k:'cnpjReclamada',l:'CNPJ da reclamada',t:'text',half:1,mono:1,show:isTrab},
    {k:'admissao',l:'Admissão',t:'date',half:1,show:isTrab},{k:'demissao',l:'Saída da empresa',t:'date',half:1,show:isTrab,hint:'Prazo para ajuizar: 2 anos após a saída (art. 7º, XXIX, da CF).'},
    {k:'faseTrab',l:'Fase',t:'select',o:FASE_TRAB,half:1,show:isTrab},{k:'valorCausa',l:'Valor da causa (R$)',t:'number',half:1,show:isTrab},
    {k:'faseOutro',l:'Fase',t:'text',show:f=>f.area==='Outro'},
    {g:'Documentos do caso'},
    {k:'checklist',l:'Checklist',t:'checklist'},
    {k:'obs',l:'Observações',t:'area'}]},
  prazos:{t:'Prazo',calc:1,f:[
    {k:'descricao',l:'O que deve ser feito',t:'text',req:1,ph:'Contestação, apelação, resposta à acusação…'},
    {k:'processoId',l:'Processo',t:'ref',col:'processos',lab:procLabel},
    {k:'gatilho',l:'A data abaixo é…',t:'select',o:[['djen','Disponibilização no DJEN'],['ciencia','Intimação / ciência']]},
    {k:'dataInicio',l:'Data',t:'date',half:1,req:1},{k:'dias',l:'Prazo (dias)',t:'number',half:1,req:1,ph:'15'},
    {k:'contagem',l:'Contagem',t:'select',o:[['uteis','Dias úteis (CPC, CLT, JEF, Lei 9.099)'],['corridos','Dias corridos (CPP)']],half:1},
    {k:'justica',l:'Justiça',t:'select',o:[['estadual','Estadual'],['federal','Federal (Lei 5.010/66)'],['trabalho','do Trabalho (Lei 5.010/66)']],half:1},
    {k:'reuPreso',l:'Réu preso (prazo corre no recesso)',t:'check',show:f=>f.contagem==='corridos'},
    {k:'vencManual',l:'Ajustar vencimento à mão (opcional)',t:'date',hint:'Use se o tribunal suspendeu prazos ou se o cálculo não se aplica. No calendário, arrastar o prazo faz o mesmo.'},
    {k:'responsavelId',l:'Responsável',t:'ref',col:'equipe',lab:m=>m.nome},
    {k:'cumprido',l:'Cumprido',t:'check'},
    {k:'_conf',t:'html',id:'confBox'},
    {k:'obs',l:'Observações',t:'area'}]},
  tarefas:{t:'Tarefa',f:[
    {k:'titulo',l:'Tarefa',t:'text',req:1,ph:'Pedir CNIS ao cliente, protocolar recurso…'},
    {k:'coluna',l:'Coluna',t:'select',o:COLUNAS,half:1},
    {k:'area',l:'Etiqueta',t:'select',o:[['','Sem etiqueta'],'Previdenciário','Criminal','Trabalhista','Administrativo'],half:1},
    {k:'responsavelId',l:'Responsável',t:'ref',col:'equipe',lab:m=>m.nome,half:1},
    {k:'dataLimite',l:'Data limite',t:'date',half:1},
    {k:'processoId',l:'Processo',t:'ref',col:'processos',lab:procLabel},
    {k:'descricao',l:'Detalhes',t:'area'}]}
};

function fieldHtml(fd,val){
  if(fd.g)return `<div class="grouph" data-k="__g${esc(fd.g)}">${esc(fd.g)}</div>`;
  const id='f_'+fd.k,cls='fld'+(fd.half?' half':'');let inp='';
  if(fd.t==='select'){const opt=o=>{const[v,l]=Array.isArray(o)?o:[o,o||'—'];return `<option value="${esc(v)}" ${String(val??'')===String(v)?'selected':''}>${esc(l)}</option>`;};
    inp=`<select class="input" id="${id}">${fd.o.map(o=>o&&o.g?`<optgroup label="${esc(o.g)}">${o.o.map(opt).join('')}</optgroup>`:opt(o)).join('')}</select>`;}
  else if(fd.t==='ref'){const items=[...S[fd.col]].filter(x=>(fd.col!=='equipe'||x.ativo!==false||x.id===val)&&(!fd.filtro||fd.filtro(x)||x.id===val)).sort((a,b)=>String(fd.lab(a)).localeCompare(String(fd.lab(b)),'pt-BR'));inp=`<select class="input" id="${id}"><option value="">— Nenhum —</option>${fd.novo?`<option value="__novo">${esc(fd.novo)}</option>`:''}${items.map(x=>`<option value="${esc(x.id)}" ${val===x.id?'selected':''}>${esc(fd.lab(x))}</option>`).join('')}</select>`;}
  else if(fd.t==='area')inp=`<textarea class="input" id="${id}">${esc(val)}</textarea>`;
  else if(fd.t==='check')return `<div class="${cls}" data-k="${fd.k}"><label class="chk" for="${id}"><input type="checkbox" id="${id}" ${val?'checked':''}>${esc(fd.l)}</label>${fd.hint?`<span class="hint">${esc(fd.hint)}</span>`:''}</div>`;
  else if(fd.t==='gov')return `<div class="${cls}" data-k="${fd.k}"><span class="lab">${esc(fd.l)}</span>${htmlGov('f_'+fd.k)}</div>`;
  else if(fd.t==='html')return `<div class="${cls}" data-k="${fd.k}"><div id="${esc(fd.id)}"></div></div>`;
  else if(fd.t==='file')return `<div class="${cls}" data-k="${fd.k}"><span class="lab">${esc(fd.l)}</span><div class="filebox" id="${id}"></div></div>`;
  else if(fd.t==='checklist')return `<div class="${cls}" data-k="${fd.k}"><div class="cklist" id="${id}"></div><span class="hint">Marque o que já foi entregue. Anexe o arquivo para guardar a cópia no sistema.</span></div>`;
  else inp=`<input class="input${fd.mono?' mono':''}" id="${id}" type="${fd.t}" ${fd.t==='number'?'inputmode="decimal" min="0" step="any"':''} value="${esc(val)}" placeholder="${esc(fd.ph||'')}">`;
  return `<div class="${cls}" data-k="${fd.k}"><label for="${id}">${esc(fd.l)}${fd.req?' *':''}</label>${inp}${fd.hint?`<span class="hint">${esc(fd.hint)}</span>`:''}</div>`;
}
function collect(fs){
  const o={};
  fs.forEach(fd=>{if(fd.g||fd.t==='html')return;
    if(fd.t==='file'){o[fd.k]=SH.files[fd.k]||'';return;}
    if(fd.t==='checklist'){o[fd.k]=JSON.parse(JSON.stringify(SH.ck||{}));return;}
    const el=document.getElementById('f_'+fd.k);if(!el)return;
    if(fd.t==='check')o[fd.k]=el.checked;else if(fd.t==='number')o[fd.k]=el.value===''?'':Number(el.value);else o[fd.k]=el.value.trim();});
  return o;
}
function renderFile(fd){
  const box=document.getElementById('f_'+fd.k);if(!box)return;const p=SH.files[fd.k];
  box.innerHTML=p?`<span class="nm">Arquivo anexado</span><button class="btn sm" type="button" data-fver="${esc(fd.k)}">Ver</button><button class="btn sm" type="button" data-fup="${esc(fd.k)}">Trocar</button><button class="btn sm ghost" type="button" data-frm="${esc(fd.k)}">Remover</button>`
    :`<span class="nm">Nenhum arquivo</span><button class="btn sm" type="button" data-fup="${esc(fd.k)}">Anexar foto ou PDF</button>`;
}
function renderChecklist(v){
  const box=$('#f_checklist');if(!box)return;const cli=SH.col==='clientes';
  const ctx=cli?ckCasoDe(v):v;const itens=checklistItens(ctx);
  const ok=itens.filter(([k])=>(SH.ck[k]&&SH.ck[k].ok)||(cli?ckAutoCliente(k):ckAuto(k,v))).length;
  const cab=`<div class="ckrow" style="background:var(--sunk)"><b style="flex:1">${ok} de ${itens.length} entregues</b>${cli&&!ctx.area?'<span class="tag">Escolha o caso para ver a lista completa</span>':''}</div>`;
  box.innerHTML=cab+itens.map(([k,l])=>{
    const it=SH.ck[k]||{},auto=cli?ckAutoCliente(k):ckAuto(k,v);const ok=!!(it.ok||auto);const arq=it.arquivo||(auto&&auto.arquivo);
    return `<div class="ckrow"><label><input type="checkbox" data-ck="${esc(k)}" ${ok?'checked':''} ${auto&&!it.ok?'disabled':''}>${esc(l)}</label>
      ${auto&&!it.ok?`<span class="tag">Do ${esc(auto.origem)}</span>`:''}
      ${arq?`<button class="btn sm" type="button" data-ckver="${esc(arq)}">Ver</button>`:''}
      ${auto&&!it.ok?'':`<button class="btn sm ghost" type="button" data-ckup="${esc(k)}">${it.arquivo?'Trocar':'Anexar'}</button>`}</div>`;}).join('');
}

let SH=null;
function openForm(col,id,preset,onSaved){
  if(!ehGestor()){
    if(col==='honorarios')return toast('Só os gestores mexem no financeiro.');
    if(col==='equipe'){const r=id&&byId('equipe',id);if(!r)return toast('Só os gestores cadastram pessoas na equipe.');if(String(r.email||'').toLowerCase()!==String(me&&me.email||'').toLowerCase())return toast('Só os gestores alteram o cadastro de outras pessoas.');}
  }
  const F=FORMS[col],rec=id?byId(col,id):null;
  const vals={...(rec||{})};
  if(!rec){F.f.forEach(fd=>{if(fd.def!==undefined)vals[fd.k]=fd.def;});if(col==='prazos'){vals.gatilho='djen';vals.contagem='uteis';vals.justica='estadual';}Object.assign(vals,preset||{});}
  SH={col,id,F,novoId:rec?null:uid(),files:{},ck:JSON.parse(JSON.stringify(vals.checklist||{})),onSaved,preset};
  F.f.forEach(fd=>{if(fd.t==='file')SH.files[fd.k]=vals[fd.k]||'';});
  const sh=$('#sheet');
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="shT">
    <div class="ph"><h3 id="shT">${rec?'Editar':'Novo'}: ${esc(F.t.toLowerCase())}</h3><button class="btn ghost sm" id="shX" type="button">Fechar</button></div>
    <form class="pb" id="shF" novalidate>${F.f.map(fd=>fieldHtml(fd,fd.g?'':vals[fd.k])).join('')}${F.calc?'<div class="calc" id="calcBox"></div>':''}</form>
    <div class="pf">${rec&&(ehGestor()||col==='tarefas')?'<button class="btn danger" id="shDel" type="button">Excluir</button>':''}<div class="r"><button class="btn" id="shC" type="button">Cancelar</button><button class="btn pri" id="shS" type="button">Salvar</button></div></div>
  </div>`;
  sh.hidden=false;
  F.f.forEach(fd=>{if(fd.t==='file')renderFile(fd);});
  if(F.f.some(fd=>fd.t==='gov')){
    SH.gov={enc:vals.govSenha&&vals.govSenha.ct?vals.govSenha:null,vinculo:id||SH.novoId,nova:null,claro:null,
      info:vals.govSenhaEm?`Guardada em ${fmtDT(vals.govSenhaEm)}${vals.govSenhaPor?' por '+vals.govSenhaPor:''}.`:''};
    if(!vals.govLogin&&vals.cpf){const el=$('#f_govLogin');if(el)el.placeholder=vals.cpf;}
    renderGov('f_govSenha');
  }
  const refresh=()=>{const v=collect(F.f);F.f.forEach(fd=>{const k=fd.g?'__g'+fd.g:fd.k;const el=sh.querySelector(`[data-k="${CSS.escape(k)}"]`);if(el)el.hidden=fd.show?!fd.show(v):false;});if(F.calc)renderCalc(v);if(col==='processos'||col==='clientes')renderChecklist(v);if(F.after)F.after(v);};
  SH.refresh=refresh;
  const form=$('#shF');
  form.addEventListener('input',e=>{if(e.target.dataset.ck)return;refresh();});
  form.addEventListener('change',e=>{
    if(e.target.value==='__novo'&&e.target.tagName==='SELECT'){novoClienteDoForm(e.target);return;}
    if(e.target.dataset.ck){const k=e.target.dataset.ck;SH.ck[k]={...(SH.ck[k]||{}),ok:e.target.checked};if(SH.refresh)SH.refresh();return;}
    if(col==='prazos'&&e.target.id==='f_processoId'){const pr=byId('processos',e.target.value);if(pr){if(pr.area==='Criminal'){$('#f_contagem').value='corridos';$('#f_reuPreso').checked=!!pr.reuPreso;}else if(pr.area==='Previdenciário'){$('#f_contagem').value='uteis';if(/TRF|Federal|JEF|INSS/i.test((pr.tribunal||'')+(pr.vara||'')))$('#f_justica').value='federal';}}}
    if(col==='clientes'&&e.target.id==='f_cep')buscaCEP(e.target.value);
    if(col==='clientes'&&e.target.id==='f_area'){const ck=$('#f_ckCaso');if(ck&&!ck.value){const a=e.target.value;if(a==='Criminal')ck.value='Criminal|';else if(a==='Trabalhista')ck.value='Trabalhista|'+TRAB_TIPOS[0];}}
    if(col==='processos'&&e.target.id==='f_clienteId'&&!SH.id){const cc=ckCasoDe(byId('clientes',e.target.value));if(cc.area){$('#f_area').value=cc.area;if(cc.especie&&$('#f_especie'))$('#f_especie').value=cc.especie;if(cc.tipoTrab&&$('#f_tipoTrab'))$('#f_tipoTrab').value=cc.tipoTrab;}}
    if(col==='prazos'&&e.target.id==='f_processoId'){const pr=byId('processos',e.target.value);if(pr&&pr.area==='Trabalhista'){$('#f_contagem').value='uteis';$('#f_justica').value='trabalho';}}
    refresh();});
  form.addEventListener('submit',e=>{e.preventDefault();doSave();});
  form.addEventListener('click',formClick);
  refresh();
  $('#shX').onclick=$('#shC').onclick=closeForm;
  $('#shS').onclick=doSave;
  const del=$('#shDel');if(del){let armed=false;del.onclick=async()=>{if(!armed){armed=true;del.textContent='Toque de novo para excluir';setTimeout(()=>{armed=false;if(del.isConnected)del.textContent='Excluir';},4000);return;}if(await excluir(col,id)){closeForm();toast('Excluído.');}};}
  if(preset&&preset._focus)setTimeout(()=>{const el=document.getElementById('f_'+preset._focus);if(el)el.focus();},80);
}
async function formClick(e){
  const b=e.target.closest('button');if(!b||!SH)return;
  if(b.dataset.gov){cliqueGov(b.dataset.gov,b.closest('[data-govbox]'));return;}
  const pasta=`${SH.col}/${SH.id||SH.novoId}`;
  if(b.dataset.fup){const k=b.dataset.fup;const f=await escolherArquivo();if(!f)return;b.disabled=true;b.textContent='Enviando…';const p=await enviarArquivo(f,pasta);if(p){SH.files[k]=p;toast('Arquivo anexado. Toque em Salvar para gravar o cadastro.');}renderFile({k});if(SH.refresh)SH.refresh();return;}
  if(b.dataset.fver){abrirArquivo(SH.files[b.dataset.fver]);return;}
  if(b.dataset.frm){SH.files[b.dataset.frm]='';renderFile({k:b.dataset.frm});if(SH.refresh)SH.refresh();return;}
  if(b.dataset.ckver){abrirArquivo(b.dataset.ckver);return;}
  if(b.dataset.ckup){const k=b.dataset.ckup;const f=await escolherArquivo();if(!f)return;b.disabled=true;b.textContent='Enviando…';const p=await enviarArquivo(f,pasta);if(p){SH.ck[k]={ok:true,arquivo:p};toast('Documento anexado. Toque em Salvar para gravar.');}SH.refresh();return;}
}
async function buscaCEP(v){
  const c=digits(v);if(c.length!==8)return;
  try{const r=await fetch(`https://viacep.com.br/ws/${c}/json/`);const j=await r.json();if(j.erro)return toast('CEP não encontrado.');
    const set=(k,x)=>{const el=$('#f_'+k);if(el&&!el.value&&x)el.value=x;};
    set('logradouro',j.logradouro);set('bairro',j.bairro);set('cidade',j.localidade);const uf=$('#f_uf');if(uf&&!uf.value&&j.uf)uf.value=j.uf;$('#f_numero')&&$('#f_numero').focus();
  }catch(e){}
}
/* cadastrar cliente novo sem perder o processo que está sendo preenchido */
function novoClienteDoForm(sel){
  const k=sel.id.replace(/^f_/,'');const v=collect(SH.F.f);v[k]=SH.id?(byId(SH.col,SH.id)||{})[k]||'':'';
  const volta={col:SH.col,id:SH.id,onSaved:SH.onSaved,vals:{...v,checklist:SH.ck},k};
  const reabrir=cid=>{
    if(volta.id){openForm(volta.col,volta.id,null,volta.onSaved);const s=$('#f_'+k);if(s&&cid){s.value=cid;s.dispatchEvent(new Event('change',{bubbles:true}));}}
    else openForm(volta.col,null,{...volta.vals,[k]:cid||volta.vals[k]||''},volta.onSaved);
    if(cid)setTimeout(()=>toast('Cliente salvo e escolhido. Confira e salve o processo.'),200);
  };
  openForm('clientes',null,{},novo=>reabrir(novo));
  if(SH)SH.aoCancelar=()=>reabrir('');
}
function closeForm(){const volta=SH&&!SH.salvou&&SH.aoCancelar;$('#sheet').hidden=true;$('#sheet').innerHTML='';SH=null;if(volta)setTimeout(volta,0);if(window.__pendente&&podeAtualizar()){window.__pendente=false;body_();}}
async function doSave(){
  if(!SH)return;const{col,id,F}=SH;const v=collect(F.f);
  for(const fd of F.f){if(fd.req&&(v[fd.k]===''||v[fd.k]==null)&&(!fd.show||fd.show(v))){toast(`Preencha o campo “${fd.l}”.`);document.getElementById('f_'+fd.k)?.focus();return;}}
  F.f.forEach(fd=>{if(fd.fmt==='cnj'&&v[fd.k])v[fd.k]=fmtCNJ(v[fd.k]);if(fd.fmt==='cpf'&&v[fd.k])v[fd.k]=fmtCPF(v[fd.k]);if(fd.fmt==='cep'&&v[fd.k])v[fd.k]=fmtCEP(v[fd.k]);if(fd.show&&!fd.show(v)&&!fd.g)delete v[fd.k];});
  if(col==='prazos'){const r=prazoCalc(v);v.vencimento=r?r.venc:'';}
  if(col==='tarefas'&&!v.coluna)v.coluna='afazer';
  if(F.beforeSave){const ok=await F.beforeSave(v,id);if(ok===false)return;}
  const old=id?byId(col,id):null;
  const btn=$('#shS');btn.disabled=true;btn.textContent='Salvando…';
  const novo=await salvar(col,id,{...(old||{}),...v},SH.novoId);
  if(!novo){if(btn.isConnected){btn.disabled=false;btn.textContent='Salvar';}return;}
  const cb=SH&&SH.onSaved;if(SH)SH.salvou=true;closeForm();toast('Salvo.');
  if(cb)cb(novo,v);
}
function renderCalc(v){
  const box=$('#calcBox');if(!box)return;const r=calcPrazo(comTribunal(v));
  if(v.vencManual){box.innerHTML=`<span class="muted" style="font-size:12.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:600">Vencimento ajustado à mão</span><div class="big">${fmtDS(v.vencManual)}</div>${r?`<span class="warnline">O cálculo automático daria ${fmtDS(r.venc)}. Apague o ajuste para voltar ao cálculo.</span>`:''}`;return;}
  if(!r){box.innerHTML='<span class="muted" style="font-size:13.5px">Informe a data e a quantidade de dias para calcular o vencimento.</span>';return;}
  const corr=v.contagem==='corridos';
  box.innerHTML=`<span class="muted" style="font-size:12.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:600">Vencimento calculado</span>
   <div class="big">${fmtDS(r.venc)}</div>
   <ol>${r.pub?`<li>Publicação (1º dia útil após a disponibilização): ${fmtDS(r.pub)}</li>`:''}
   <li>Início da contagem: ${fmtDS(r.inicio)}</li>
   <li>${corr?`Contagem em dias corridos (CPP, art. 798)${v.reuPreso?', sem suspensão no recesso':''}`:'Contagem só em dias úteis (CPC, art. 219)'}${r.prorrog?'; vencimento prorrogado para o dia útil seguinte':''}</li></ol>
   <span class="warnline">Considera fins de semana, feriados nacionais, recesso e suspensão de 20/12 a 20/01${v.justica==='federal'||v.justica==='trabalho'?', feriados da Lei 5.010/66 (Justiça Federal e do Trabalho)':''} e os feriados locais dos Ajustes. Confira sempre no sistema do tribunal.</span>`;
}

/* ---------- intimação → cadastro com um toque ---------- */
function cadastrarIntimacao(hash){
  const it=S.intimacoes.find(x=>x.hash===hash);if(!it)return;
  const area=guessArea(it),resp=byId('equipe',it.responsavel_id);
  const existente=S.processos.find(p=>digits(p.numero)&&digits(p.numero)===digits(it.numero));
  const txt=String(it.texto||'').replace(/\s+/g,' ').trim();
  const sug=typeof sugerirDias==='function'?sugerirDias(txt):null;
  if(sug)setTimeout(()=>toast(`Prazo sugerido pelo texto da intimação: ${sug.dias} dias. Confira antes de salvar.`),400);
  const abrirPrazo=(procId)=>openForm('prazos',null,{
    descricao:it.tipo_documento||it.tipo||'Intimação',processoId:procId,gatilho:'djen',dataInicio:it.data_disponibilizacao||'',
    contagem:area==='Criminal'?'corridos':'uteis',justica:/^TRF/i.test(it.tribunal||'')?'federal':/^TRT/i.test(it.tribunal||'')?'trabalho':'estadual',
    reuPreso:area==='Criminal'&&!!byId('processos',procId)?.reuPreso,responsavelId:resp?resp.id:'',
    dias:sug?sug.dias:'',obs:(sug?`Prazo sugerido pelo texto: ${sug.dias} dias (“${sug.trecho}”). Confira.\n`:'')+'Intimação DJEN: '+txt.slice(0,700),_focus:'dias'
  },async()=>{await mudarIntimacao(hash,{status:'cadastrada',processo_id:procId});toast('Intimação cadastrada com prazo.');});
  if(existente){toast('Processo já cadastrado. Agora informe o prazo.');abrirPrazo(existente.id);return;}
  const cli=byId('clientes',it.cliente_id);
  openForm('processos',null,{numero:it.numero||'',tribunal:it.tribunal||'',vara:it.orgao||'',area,responsavelId:resp?resp.id:'',clienteId:cli?cli.id:''},
    (novoId)=>{toast('Processo salvo. Agora informe o prazo.');setTimeout(()=>abrirPrazo(novoId),150);});
}

/* ---------- ajustes ---------- */
function openConfig(){
  if(!ehGestor()&&typeof openMinhaConta==='function')return openMinhaConta();
  const c=S.config||{};const sh=$('#sheet');
  SH={col:'__config',files:{}};
  const f=(k,l,ph,half)=>`<div class="fld${half?' half':''}"><label for="cf_${k}">${l}</label><input class="input" id="cf_${k}" value="${esc(c[k]||'')}" placeholder="${esc(ph||'')}"></div>`;
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="cfT">
    <div class="ph"><h3 id="cfT">Ajustes do escritório</h3><button class="btn ghost sm" id="cfX" type="button">Fechar</button></div>
    <div class="pb">
      <div class="grouph">Escritório (aparece na procuração e no contrato)</div>
      ${f('nome','Nome do escritório','Novaes Advocacia')}
      ${f('sociedade','Sociedade de advogados (se houver)','Fulano Advogados Associados',1)}${f('cnpj','CNPJ','00.000.000/0001-00',1)}
      ${f('registroOab','Registro da sociedade na OAB','OAB/PA nº 0000',1)}${f('telefone','Telefone','(91) 3333-4444',1)}
      ${f('email','E-mail do escritório','contato@escritorio.adv.br',1)}${f('site','Site / Instagram','',1)}
      ${f('endereco','Endereço completo','Av. Nazaré, 100, sala 10, Nazaré, Belém/PA, CEP 66035-000')}
      ${f('cidade','Cidade/UF (local da assinatura e foro)','Belém/PA',1)}${f('chavePix','Chave Pix para honorários','',1)}
      ${f('pixNome','Nome do titular do Pix','Palha Novaes Advocacia',1)}${f('pixCidade','Cidade do titular do Pix','Belém',1)}
      <div class="fld"><span class="lab">Logo</span><div class="filebox"><span class="nm" id="cfLogoNm">${c.logo?'Logo própria cadastrada':'Usando a logo Palha Novaes'}</span>${(c.logo||window.LOGO_PADRAO)?`<img src="${esc(c.logo||window.LOGO_PADRAO)}" alt="Logo atual" style="max-height:52px;background:#fff;border-radius:6px;padding:4px">`:''}<button class="btn sm" id="cfLogo" type="button">${c.logo?'Trocar':'Enviar logo'}</button>${c.logo?'<button class="btn sm ghost" id="cfLogoRm" type="button">Remover</button>':''}</div><span class="hint">Aparece no topo da procuração e do contrato. Se remover, volta a logo Palha Novaes.</span></div>
      <div class="grouph">Prazos</div>
      <div class="fld"><label for="cf_feriados">Feriados locais e pontos facultativos</label><textarea class="input" id="cf_feriados" style="min-height:120px" placeholder="15/08 Adesão do Pará&#10;08/12 N. Sra. da Conceição&#10;30/10/2026 Ponto facultativo do TJ">${esc(c.feriados||'')}</textarea><span class="hint">Um por linha. “dd/mm” repete todo ano; “dd/mm/aaaa” vale só naquele dia.</span></div>
      <div class="grouph">Modelos de documentos</div>
      <div class="fld"><span class="hint">Os modelos de procuração e contrato podem ser editados na aba Documentos, em “Modelos”.</span></div>
      <div class="grouph">Suspensões de prazo dos tribunais</div>
      <div class="fld" id="cfSusp"></div>
      <div class="grouph">Notificações no celular</div>
      <div class="fld" id="cfPush"><span class="hint">Carregando…</span></div>
      <div class="grouph">Verificação em duas etapas</div>
      <div class="fld" id="cfMfa"><span class="hint">Carregando…</span></div>
      <div class="grouph">Cofre de senhas gov.br</div>
      <div class="fld" id="cfCofre"></div>
      <div class="grouph">Cópia de segurança</div>
      <div class="fld"><button class="btn" id="cfBackup" type="button">Baixar cópia de todos os dados (JSON)</button><span class="hint">O robô também faz uma cópia automática toda segunda-feira e manda para o e-mail do escritório. Os arquivos anexados ficam no Supabase.</span></div>
      <div class="grouph">Sobre</div>
      <div class="fld"><span class="hint">Versão ${VERSAO} · o que mudou em cada versão está no arquivo VERSOES.md.</span></div>
    </div>
    <div class="pf"><button class="btn" id="cfSair" type="button">Sair da conta</button><div class="r"><button class="btn" id="cfC" type="button">Cancelar</button><button class="btn pri" id="cfS" type="button">Salvar</button></div></div></div>`;
  sh.hidden=false;let logo=c.logo||'';
  $('#cfX').onclick=$('#cfC').onclick=closeForm;
  $('#cfSair').onclick=()=>{closeForm();sairDaConta();};
  $('#cfBackup').onclick=baixarBackup;
  if(typeof renderMfaAjustes==='function')renderMfaAjustes();
  if(typeof renderSuspensoes==='function')renderSuspensoes();
  if(typeof renderPushAjustes==='function')renderPushAjustes();
  renderCofreAjustes();
  $('#cfLogo').onclick=async()=>{const fl=await escolherArquivo('image/png,image/jpeg,image/webp');if(!fl)return;logo=await reduzirImagem(fl,600);$('#cfLogoNm').textContent='Nova logo pronta. Toque em Salvar.';};
  const rm=$('#cfLogoRm');if(rm)rm.onclick=()=>{logo='';$('#cfLogoNm').textContent='Logo será removida ao salvar.';};
  $('#cfS').onclick=async()=>{const cfg={...c};['nome','sociedade','cnpj','registroOab','telefone','email','site','endereco','cidade','chavePix','pixNome','pixCidade','feriados'].forEach(k=>cfg[k]=$('#cf_'+k).value.trim());cfg.logo=logo;if(await salvarConfig(cfg)){closeForm();toast('Ajustes salvos.');}};
}
function renderCofreAjustes(){
  const box=$('#cfCofre');if(!box)return;
  const aviso='<span class="hint">A senha do cofre embaralha as senhas gov.br antes de irem para o banco. Combine com a equipe e guarde num lugar seguro: se for esquecida, as senhas guardadas não podem ser recuperadas.</span>';
  if(!cofreSuportado()){box.innerHTML='<span class="hint">Abra o sistema pelo endereço https para usar o cofre.</span>';return;}
  if(!cofreCriado()){
    box.innerHTML=`<label for="cfM1">Criar senha do cofre (mínimo 10 caracteres)</label><input class="input" id="cfM1" type="password" autocomplete="new-password"><label for="cfM2">Repita a senha</label><input class="input" id="cfM2" type="password" autocomplete="new-password">${aviso}<div><button class="btn pri" id="cfMok" type="button">Criar cofre</button></div>`;
    $('#cfMok').onclick=async()=>{const a=$('#cfM1').value,b=$('#cfM2').value;if(a.length<10)return toast('Use pelo menos 10 caracteres.');if(a!==b)return toast('As duas senhas não conferem.');const bt=$('#cfMok');bt.disabled=true;bt.textContent='Criando…';if(await criarCofre(a)){toast('Cofre criado e destrancado.');renderCofreAjustes();}else{bt.disabled=false;bt.textContent='Criar cofre';}};
    return;
  }
  const n=S.clientes.filter(c=>c.govSenha&&c.govSenha.ct).length;
  if(!cofreAberto()){
    box.innerHTML=`<span class="hint">Cofre criado · ${n} ${n===1?'senha guardada':'senhas guardadas'} · trancado.</span><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="cfMa" type="password" placeholder="Senha do cofre" autocomplete="off" style="flex:1;min-width:160px"><button class="btn" id="cfMab" type="button">Destrancar para trocar a senha</button></div>`;
    $('#cfMab').onclick=async()=>{const bt=$('#cfMab');bt.disabled=true;if(await abrirCofre($('#cfMa').value)){renderCofreAjustes();}else{bt.disabled=false;toast('Senha do cofre incorreta.');}};
    return;
  }
  box.innerHTML=`<span class="hint">Cofre destrancado · ${n} ${n===1?'senha guardada':'senhas guardadas'}.</span><label for="cfN1">Nova senha do cofre</label><input class="input" id="cfN1" type="password" autocomplete="new-password"><label for="cfN2">Repita a nova senha</label><input class="input" id="cfN2" type="password" autocomplete="new-password">${aviso}<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="cfNok" type="button">Trocar senha do cofre</button><button class="btn ghost" id="cfTr" type="button">Trancar</button></div>`;
  $('#cfTr').onclick=()=>{trancarCofre();renderCofreAjustes();};
  $('#cfNok').onclick=async()=>{const a=$('#cfN1').value,b=$('#cfN2').value;if(a.length<10)return toast('Use pelo menos 10 caracteres.');if(a!==b)return toast('As duas senhas não conferem.');const bt=$('#cfNok');bt.disabled=true;
    try{const q=await trocarSenhaCofre(a,(i,t)=>{bt.textContent=`Regravando ${i}/${t}…`;});toast(`Senha do cofre trocada. ${q} ${q===1?'senha regravada':'senhas regravadas'}.`);renderCofreAjustes();}
    catch(e){console.error(e);bt.disabled=false;bt.textContent='Trocar senha do cofre';toast('Não foi possível trocar: '+(e.message||'erro')+'.');}};
}
function reduzirImagem(file,max){return new Promise(res=>{const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height));const cv=document.createElement('canvas');cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);const cx=cv.getContext('2d');cx.drawImage(img,0,0,cv.width,cv.height);res(cv.toDataURL('image/png'));};img.onerror=()=>res('');img.src=fr.result;};fr.readAsDataURL(file);});}
function baixarBackup(){
  const data={geradoEm:new Date().toISOString(),...S};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`backup-escritorio-${hojeStr()}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}
function openMais(){
  const sh=$('#sheet');SH={col:'__mais'};
  const ic=id=>document.querySelector(`#nav [data-v="${id}"] svg`)?.outerHTML||'';
  const it=(v,l)=>`<a href="#${v}" data-close>${ic(v)}${l}</a>`;
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="ph"><h3 id="mT">Mais</h3><button class="btn ghost sm" id="mX" type="button">Fechar</button></div>
  <div class="pb"><div class="maisgrid">${it('tarefas','Tarefas')}${it('processos','Processos')}${it('juri','Júri')}${it('previdenciario','Previdenciário')}${ehGestor()?it('financeiro','Financeiro'):''}${it('documentos','Documentos')}${it('assistente','Assistente')}${it('equipe','Equipe')}${ehGestor()?it('acessos','Acessos')+it('relatorios','Relatórios')+it('historico','Histórico'):''}<a href="#" data-cfg>${ic('inicio')}Ajustes</a></div></div></div>`;
  sh.hidden=false;$('#mX').onclick=closeForm;
}

/* ---------- eventos globais ---------- */
document.addEventListener('click',e=>{
  if(e.target.closest('[data-close]')){closeForm();return;}
  if(e.target.closest('[data-cfg]')){e.preventDefault();closeForm();openConfig();return;}
  if(e.target.closest('#navMais')){openMais();return;}
  if(e.target.closest('#sheet .panel'))return; // cliques dentro da folha são tratados lá
  if(e.target.id==='sheet'){closeForm();return;}
  const teor=e.target.closest('[data-teor]');if(teor){const box=teor.closest('[data-teor-box]');const[a,b]=box.querySelectorAll('span');a.hidden=!a.hidden;b.hidden=!b.hidden;teor.textContent=a.hidden?'Mostrar menos':'Ler tudo';return;}
  const cad=e.target.closest('[data-cad]');if(cad){cadastrarIntimacao(cad.dataset.cad);return;}
  const ign=e.target.closest('[data-ign]');if(ign){mudarIntimacao(ign.dataset.ign,{status:'ignorada'}).then(ok=>ok&&toast('Intimação ignorada.'));return;}
  const reab=e.target.closest('[data-reab]');if(reab){mudarIntimacao(reab.dataset.reab,{status:'nova'});return;}
  const done=e.target.closest('[data-done]');if(done){e.stopPropagation();const p=byId('prazos',done.dataset.done);if(p)atualizar('prazos',p.id,{cumprido:!p.cumprido,cumpridoEm:p.cumprido?'':hojeStr()}).then(ok=>ok&&toast(p.cumprido?'Prazo reaberto.':'Prazo marcado como cumprido.'));return;}
  const mv=e.target.closest('[data-mv]');if(mv){e.stopPropagation();const t=byId('tarefas',mv.dataset.id);if(!t)return;const i=COLUNAS.findIndex(c=>c[0]===(t.coluna||'afazer'));const n=COLUNAS[i+Number(mv.dataset.mv)];if(n)atualizar('tarefas',t.id,{coluna:n[0]});return;}
  const nw=e.target.closest('[data-new]');if(nw){const col=nw.dataset.new;if(VIEWS[cur]&&VIEWS[cur].novo&&VIEWS[cur].novo(col,nw))return;openForm(col,null,nw.dataset.colnew?{coluna:nw.dataset.colnew}:(cur==='tarefas'&&UI.respT?{responsavelId:UI.respT}:null));return;}
  const ed=e.target.closest('[data-edit]');if(ed){if(VIEWS[cur]&&VIEWS[cur].editar&&VIEWS[cur].editar(ed.dataset.edit,ed.dataset.id))return;openForm(ed.dataset.edit,ed.dataset.id);return;}
  const card=e.target.closest('[data-task]');if(card){openForm('tarefas',card.dataset.task);return;}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!$('#sheet').hidden)closeForm();
  if(e.key==='Enter'&&(e.target.matches('[data-edit]')||e.target.matches('[data-task]')))e.target.click();
});
window.addEventListener('hashchange',()=>{if(me)go(location.hash.slice(1));});
let dragId=null;
document.addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('[data-task]');if(c){dragId=c.dataset.task;e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragId);}catch(_){}}});
document.addEventListener('dragover',e=>{const col=e.target.closest&&e.target.closest('.col');if(col&&dragId){e.preventDefault();document.querySelectorAll('.col.over').forEach(x=>x!==col&&x.classList.remove('over'));col.classList.add('over');}});
document.addEventListener('dragleave',e=>{const col=e.target.closest&&e.target.closest('.col');if(col&&!col.contains(e.relatedTarget))col.classList.remove('over');});
document.addEventListener('drop',e=>{const col=e.target.closest&&e.target.closest('.col');document.querySelectorAll('.col.over').forEach(x=>x.classList.remove('over'));if(col&&dragId){e.preventDefault();const t=byId('tarefas',dragId);if(t&&(t.coluna||'afazer')!==col.dataset.col)atualizar('tarefas',dragId,{coluna:col.dataset.col});}dragId=null;});
document.addEventListener('dragend',()=>{dragId=null;document.querySelectorAll('.col.over').forEach(x=>x.classList.remove('over'));});
