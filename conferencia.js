'use strict';
/* =====================================================================
   Dupla conferência de prazos: quem cadastra não confere; outra pessoa
   revê o cálculo e confirma com um toque. Se o cálculo mudar, volta a
   precisar de conferência.
   ===================================================================== */
const CHAVES_CALCULO=['dataInicio','dias','contagem','justica','gatilho','reuPreso','vencManual','processoId'];
const nomeDe=email=>{const m=membroPorEmail(email);return m&&m.nome?m.nome:String(email||'');};
const primeiroNome=email=>nomeDe(email).split(/[ @]/)[0];
const prazoConferido=p=>!!p.conferidoPor;
const precisaConferir=p=>!p.cumprido&&!prazoConferido(p);
// escritório com uma só pessoa com acesso: ela mesma pode conferir
const umaPessoaSo=()=>S.equipe.filter(m=>m.ativo!==false&&m.email).length<=1;
const podeConferir=p=>!p.criadoPor||p.criadoPor!==meuEmail()||umaPessoaSo();

function chipConferencia(p){
  if(p.cumprido)return'';
  return prazoConferido(p)?`<span class="chip c-ok" title="Conferido em ${esc(fmtDT(p.conferidoEm))}">Conferido · ${esc(primeiroNome(p.conferidoPor))}</span>`:'<span class="chip c-warn">Falta conferir</span>';
}
function botaoConferir(p){return precisaConferir(p)?`<button class="btn sm" data-conferir="${esc(p.id)}" type="button">Conferir</button>`:'';}

const BS_PRAZO=FORMS.prazos.beforeSave;
FORMS.prazos.beforeSave=async function(v,id){
  if(BS_PRAZO){const ok=await BS_PRAZO(v,id);if(ok===false)return false;}
  const old=id?byId('prazos',id):null;
  if(!old){v.criadoPor=meuEmail();v.conferidoPor='';v.conferidoEm='';return;}
  if(old.conferidoPor&&CHAVES_CALCULO.some(k=>String(old[k]??'')!==String(v[k]??''))){
    v.conferidoPor='';v.conferidoEm='';
    setTimeout(()=>toast('O cálculo do prazo mudou: ele volta a precisar de conferência.'),400);
  }
};
const AFTER_PRAZO=FORMS.prazos.after;
FORMS.prazos.after=function(v){
  if(AFTER_PRAZO)AFTER_PRAZO(v);
  const box=$('#confBox');if(!box||!SH)return;const p=SH.id?byId('prazos',SH.id):null;
  if(!p){box.innerHTML='<span class="hint">Depois de salvar, outra pessoa do escritório confere o cálculo (botão <b>Conferir</b> na lista de prazos).</span>';return;}
  box.innerHTML=`<span class="hint">${p.criadoPor?'Cadastrado por '+esc(nomeDe(p.criadoPor))+' · ':''}${prazoConferido(p)?`<b style="color:var(--ok)">Conferido por ${esc(nomeDe(p.conferidoPor))}</b> em ${esc(fmtDT(p.conferidoEm))}. Se mudar data, dias ou contagem, volta a precisar de conferência.`:'<b style="color:var(--warn)">Ainda não conferido.</b>'}</span>`;
};

/* tela de conferência: mostra o cálculo para a segunda pessoa rever */
function abrirConferencia(id){
  const p=byId('prazos',id);if(!p)return;
  if(!podeConferir(p))return toast(`Quem cadastrou (${primeiroNome(p.criadoPor)}) não pode conferir o próprio prazo. Peça a outra pessoa.`);
  const i=prazoInfo(p),pr=byId('processos',p.processoId),cli=pr?byId('clientes',pr.clienteId):null;
  const sh=$('#sheet');SH={col:'__conf',id};
  const lin=(l,v)=>`<div class="fld half"><span class="lab">${l}</span><div style="font-weight:600">${v}</div></div>`;
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="cfpT"><div class="ph"><h3 id="cfpT">Conferir prazo</h3><button class="btn ghost sm" id="cfpX" type="button">Fechar</button></div>
    <div class="pb">
      <div class="fld"><span class="lab">O que deve ser feito</span><div style="font-weight:600">${esc(p.descricao||'')}</div><span class="hint">${pr?esc(pr.numero||'')+(cli?' · '+esc(cli.nome):''):'Sem processo vinculado'}${p.criadoPor?' · cadastrado por '+esc(nomeDe(p.criadoPor)):''}</span></div>
      ${lin(p.gatilho==='ciencia'?'Intimação / ciência':'Disponibilização no DJEN',esc(fmtDS(p.dataInicio)))}${lin('Prazo',esc(p.dias||'?')+' dias '+(p.contagem==='corridos'?'corridos':'úteis'))}
      ${lin('Regra',esc(regraTxt(p)))}${lin('Vencimento',`<span style="font-size:20px">${i.r?esc(fmtDS(i.r.venc)):'—'}</span>${i.r&&i.r.manual?' <span class="chip c-warn">ajustado à mão</span>':''}`)}
      ${p.obs?`<div class="fld"><span class="lab">Observações e texto da intimação</span><div class="msgbox" style="max-height:220px;overflow:auto;white-space:pre-wrap">${esc(p.obs)}</div></div>`:''}
      <div class="fld"><span class="hint">Confira no sistema do tribunal a data, a quantidade de dias e a contagem. Se algo estiver errado, toque em <b>Não confere</b> para abrir o prazo e corrigir.</span></div>
    </div>
    <div class="pf"><button class="btn" id="cfpNao" type="button">Não confere, corrigir</button><div class="r"><button class="btn pri" id="cfpOk" type="button">Confere</button></div></div></div>`;
  sh.hidden=false;
  $('#cfpX').onclick=closeForm;
  $('#cfpNao').onclick=()=>{closeForm();openForm('prazos',id);};
  $('#cfpOk').onclick=async()=>{const b=$('#cfpOk');b.disabled=true;
    if(await atualizar('prazos',id,{conferidoPor:meuEmail(),conferidoEm:new Date().toISOString()})){closeForm();toast('Prazo conferido.');}else b.disabled=false;};
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-conferir]');if(!b)return;e.preventDefault();e.stopPropagation();abrirConferencia(b.dataset.conferir);},true);

/* Início: prazos que ainda precisam da segunda conferência */
const INI_CONF=VIEWS.inicio.body;
VIEWS.inicio.body=function(){
  const h=INI_CONF();
  const l=S.prazos.filter(precisaConferir).map(p=>({p,i:prazoInfo(p)})).sort((a,b)=>String(a.i.r?.venc||'9999').localeCompare(String(b.i.r?.venc||'9999')));
  if(!l.length)return h;
  const sec=`<div class="sec"><h2>Prazos aguardando conferência · ${l.length}</h2><div class="list">${l.slice(0,6).map(({p})=>rowPrazo(p)).join('')}</div>${l.length>6?`<a class="lnk" href="#prazos">Ver todos os prazos</a>`:''}</div>`;
  const i=h.indexOf('<div class="sec">');return i<0?h+sec:h.slice(0,i)+sec+h.slice(i);
};
