'use strict';
/* =====================================================================
   Palha Novaes Advocacia — Financeiro (honorários) e Documentos (procuração e contrato)
   ===================================================================== */

/* ---------- números por extenso ---------- */
function numExt(n){
  n=Math.floor(Math.abs(n));
  const u=['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const d=['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const c=['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
  const ate999=x=>x<20?u[x]:x<100?d[Math.floor(x/10)]+(x%10?' e '+u[x%10]:''):x===100?'cem':c[Math.floor(x/100)]+(x%100?' e '+ate999(x%100):'');
  if(n<1000)return ate999(n);
  const bi=Math.floor(n/1e9),mi=Math.floor(n/1e6)%1000,mil=Math.floor(n/1000)%1000,r=n%1000;
  const g=[];
  if(bi)g.push([bi,bi===1?'um bilhão':ate999(bi)+' bilhões']);
  if(mi)g.push([mi,mi===1?'um milhão':ate999(mi)+' milhões']);
  if(mil)g.push([mil,mil===1?'mil':ate999(mil)+' mil']);
  let s=g.map((x,i)=>i===0?x[1]:((x[0]<100||x[0]%100===0)?' e ':', ')+x[1]).join('');
  if(r)s+=(r<100||r%100===0?' e ':' ')+ate999(r);
  return s;
}
function valorExtenso(v){
  const cents=Math.round((Number(v)||0)*100),re=Math.floor(cents/100),ce=cents%100;
  const parts=[];
  if(re)parts.push(numExt(re)+(re===1?' real':(re>=1e6&&re%1e6===0?' de reais':' reais')));
  if(ce)parts.push(numExt(ce)+(ce===1?' centavo':' centavos'));
  return parts.join(' e ')||'zero real';
}
function pctExtenso(p){
  const n=Number(p)||0;const[i,dec]=String(n).split('.');
  return numExt(Number(i))+(dec?' vírgula '+dec.split('').map(x=>numExt(Number(x))).join(' '):'')+' por cento';
}
function dataExtenso(s){const d=s?parseD(s):parseD(hojeStr());const dia=d.getUTCDate();return `${dia===1?'1º':dia} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;}
const round2=x=>Math.round((Number(x)||0)*100)/100;

/* =====================================================================
   FINANCEIRO
   ===================================================================== */
const MODAL=[['avista','À vista'],['parcelado','Parcelado'],['exito','Só êxito (%)'],['entrada_exito','Entrada + êxito'],['parcelado_exito','Parcelado + êxito']];
const modalNome=m=>(MODAL.find(x=>x[0]===m)||[0,'—'])[1];
const temFixo=f=>['avista','parcelado','parcelado_exito'].includes(f.modalidade);
const temParc=f=>['parcelado','parcelado_exito'].includes(f.modalidade);
const temExito=f=>['exito','entrada_exito','parcelado_exito'].includes(f.modalidade);
const temEntrada=f=>f.modalidade==='entrada_exito';
function addMes(s,n){const d=parseD(s);const y=d.getUTCFullYear(),m=d.getUTCMonth()+n,day=d.getUTCDate();const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return ymd(new Date(Date.UTC(y,m,Math.min(day,last))));}
function gerarParcelas(v){
  const out=[];
  if(temEntrada(v)&&Number(v.entrada)>0&&v.entradaVenc)out.push({n:1,desc:'Entrada',venc:v.entradaVenc,valor:round2(v.entrada)});
  if(temFixo(v)&&Number(v.valor)>0&&v.primeiroVenc){
    const N=v.modalidade==='avista'?1:Math.max(1,Math.floor(Number(v.parcelasN)||1));
    const cents=Math.round(Number(v.valor)*100),base=Math.floor(cents/N);
    for(let i=0;i<N;i++)out.push({n:i+1,desc:N===1?'Parcela única':`Parcela ${i+1}/${N}`,venc:addMes(v.primeiroVenc,i),valor:(i===N-1?cents-base*(N-1):base)/100});
  }
  if(temExito(v)&&Number(v.exitoValor)>0&&v.exitoVenc)out.push({n:99,desc:'Êxito',venc:v.exitoVenc,valor:round2(v.exitoValor)});
  return out;
}
function juntarParcelas(nova,velha){ // preserva o que já foi pago
  const key=p=>`${p.desc}|${p.venc}|${p.valor}`;const res=nova.map(p=>{const o=(velha||[]).find(x=>key(x)===key(p));return o?{...p,pago:!!o.pago,pagoEm:o.pagoEm||''}:p;});
  const perdidas=(velha||[]).filter(o=>o.pago&&!res.some(p=>key(p)===key(o)));
  return{res,perdidas};
}
function parcelasTodas(){const out=[];S.honorarios.filter(h=>h.status!=='cancelado').forEach(h=>(h.parcelas||[]).forEach((p,i)=>out.push({h,p,i})));return out;}
const nomeCli=id=>byId('clientes',id)?.nome||'Cliente não informado';

FORMS.honorarios={t:'Contrato de honorários',f:[
  {k:'clienteId',l:'Cliente',t:'ref',col:'clientes',lab:c=>c.nome,req:1},
  {k:'processoId',l:'Processo (se já houver)',t:'ref',col:'processos',lab:procLabel},
  {k:'objeto',l:'Objeto (o que será feito)',t:'area',req:1,ph:'ajuizar e acompanhar ação de concessão de aposentadoria por idade em face do INSS, até decisão final'},
  {k:'modalidade',l:'Modo de pagamento dos honorários',t:'select',o:MODAL},
  {k:'formaPagamento',l:'Forma',t:'select',o:['Pix','Boleto','Transferência bancária','Cartão de crédito','Dinheiro'],half:1},
  {k:'responsavelId',l:'Responsável pela cobrança',t:'ref',col:'equipe',lab:m=>m.nome,half:1},
  {g:'Valor fixo',show:temFixo},
  {k:'valor',l:'Valor total (R$)',t:'number',half:1,show:temFixo,ph:'3000'},
  {k:'parcelasN',l:'Nº de parcelas',t:'number',half:1,show:temParc,ph:'10'},
  {k:'primeiroVenc',l:'Vencimento da 1ª parcela',t:'date',half:1,show:temFixo},
  {g:'Entrada',show:temEntrada},
  {k:'entrada',l:'Valor da entrada (R$)',t:'number',half:1,show:temEntrada},
  {k:'entradaVenc',l:'Vencimento da entrada',t:'date',half:1,show:temEntrada},
  {g:'Êxito',show:temExito},
  {k:'percentual',l:'Percentual (%)',t:'number',half:1,show:temExito,ph:'30'},
  {k:'baseExito',l:'Sobre o quê',t:'text',show:temExito,def:'sobre o proveito econômico obtido, incluídas as parcelas vencidas (atrasados)'},
  {k:'exitoValor',l:'Valor do êxito, quando souber (R$)',t:'number',half:1,show:temExito,hint:'Preencha quando sair a RPV ou o pagamento.'},
  {k:'exitoVenc',l:'Data prevista para receber',t:'date',half:1,show:temExito},
  {k:'_parc',t:'html',id:'parcBox'},
  {k:'status',l:'Situação',t:'select',o:[['ativo','Ativo'],['quitado','Quitado'],['cancelado','Cancelado']],half:1},
  {k:'obs',l:'Observações',t:'area'}],
  after(v){const box=$('#parcBox');if(!box)return;const p=gerarParcelas(v);
    box.innerHTML=p.length?`<span class="lab">Parcelas que entram no controle</span><div class="parcelas">${p.map(x=>`<div><span>${esc(x.desc)} · ${fmtD(x.venc)}</span><span class="money">${brl(x.valor)}</span></div>`).join('')}<div><b>Total</b><b class="money">${brl(p.reduce((s,x)=>s+x.valor,0))}</b></div></div>`
      :`<span class="hint">${temExito(v)&&!temFixo(v)&&!temEntrada(v)?'Só êxito: nenhuma parcela agora. Informe o valor do êxito quando souber.':'Preencha valor e vencimento para ver as parcelas.'}</span>`;},
  beforeSave(v,id){
    const old=id?byId('honorarios',id):null;const{res,perdidas}=juntarParcelas(gerarParcelas(v),old&&old.parcelas);
    if(perdidas.length){v.parcelas=old.parcelas;toast('Há parcelas já recebidas que mudariam. Mantive as parcelas antigas; ajuste direto no Financeiro.');}
    else v.parcelas=res;
    if(v.parcelas.length&&v.parcelas.every(p=>p.pago)&&!temExito(v))v.status='quitado';
  }};

function stParcela(p){if(p.pago)return['ok','Recebida'+(p.pagoEm?' em '+fmtD(p.pagoEm):'')];const dd=diffDias(p.venc);if(dd<0)return['danger',`Atrasada ${-dd} ${-dd===1?'dia':'dias'}`];if(dd===0)return['warn','Vence hoje'];if(dd<=5)return['warn',`Vence em ${dd} dias`];return['mute','A vencer'];}
function rowParcela({h,p,i}){
  const d=parseD(p.venc),[st,txt]=stParcela(p);
  return `<div class="row ${p.pago?'soft':''}">
    <div class="dateblk ${p.pago?'':st==='danger'?'danger':st==='warn'?'warn':''}"><b>${pad(d.getUTCDate())}</b><span>${MES[d.getUTCMonth()]}</span></div>
    <div class="main"><div class="t">${esc(nomeCli(h.clienteId))}</div>
      <div class="m">${esc(p.desc)} · ${esc(h.formaPagamento||'')}</div>
      <div class="chips"><span class="chip c-${st}">${esc(txt)}</span></div></div>
    <div class="side"><span class="money">${brl(p.valor)}</span>
      <div style="display:flex;gap:6px">${p.pago?`<button class="btn sm" data-recibo="${esc(h.id)}" data-i="${i}" type="button">Recibo</button><button class="btn sm ghost" data-pg="${esc(h.id)}" data-i="${i}" type="button">Desfazer</button>`:`<button class="btn sm" data-cobrar="${esc(h.id)}" data-i="${i}" type="button">Cobrar</button><button class="btn sm pri" data-pg="${esc(h.id)}" data-i="${i}" type="button">Recebido</button>`}</div></div>
  </div>`;
}
function rowContrato(h){
  const ps=h.parcelas||[],tot=ps.reduce((s,p)=>s+p.valor,0),pago=ps.filter(p=>p.pago).reduce((s,p)=>s+p.valor,0);
  const atras=ps.some(p=>!p.pago&&diffDias(p.venc)<0);const pr=byId('processos',h.processoId);
  return `<div class="row click a-${pr?areaCls(pr.area):'adm'}" data-edit="honorarios" data-id="${esc(h.id)}" role="button" tabindex="0">
    <div class="main"><div class="t">${esc(nomeCli(h.clienteId))}</div>
      <div class="m">${esc(String(h.objeto||'').slice(0,140))}</div>
      <div class="m">${esc(modalNome(h.modalidade))}${temExito(h)&&h.percentual?' · êxito '+esc(h.percentual)+'%':''}${pr?' · <span class="mono">'+esc(pr.numero||'')+'</span>':''}</div>
      ${tot?`<div class="progress" aria-label="Recebido"><i style="width:${Math.min(100,Math.round(pago/tot*100))}%"></i></div><div class="m">${brl(pago)} recebidos de ${brl(tot)}</div>`:''}
      <div class="chips"><span class="chip ${h.status==='quitado'?'c-ok':h.status==='cancelado'?'c-mute':atras?'c-danger':'c-mute'}">${h.status==='quitado'?'Quitado':h.status==='cancelado'?'Cancelado':atras?'Com atraso':'Ativo'}</span>${temExito(h)&&!h.exitoValor?'<span class="chip c-warn">Êxito pendente</span>':''}</div>
      <div class="acts"><button class="btn sm" data-gerarcontrato="${esc(h.id)}" type="button">Gerar contrato</button></div></div>
  </div>`;
}
VIEWS.financeiro={t:'Financeiro',
  tools(){return `<div class="tools"><div class="seg" id="segFin"><button data-f="parcelas" type="button">Parcelas</button><button data-f="contratos" type="button">Contratos</button></div><button class="btn pri push" data-new="honorarios" type="button">+ Novo contrato de honorários</button></div>`;},
  bind(){$('#segFin').onclick=e=>{const b=e.target.closest('button');if(b){UI.finF=b.dataset.f;body_();}};},
  body(){
    document.querySelectorAll('#segFin button').forEach(x=>x.classList.toggle('on',x.dataset.f===UI.finF));
    const all=parcelasTodas(),mes=hojeStr().slice(0,7);
    const aReceber=all.filter(x=>!x.p.pago&&x.p.venc.slice(0,7)===mes).reduce((s,x)=>s+x.p.valor,0);
    const atras=all.filter(x=>!x.p.pago&&diffDias(x.p.venc)<0).reduce((s,x)=>s+x.p.valor,0);
    const receb=all.filter(x=>x.p.pago&&(x.p.pagoEm||'').slice(0,7)===mes).reduce((s,x)=>s+x.p.valor,0);
    const exitos=S.honorarios.filter(h=>h.status==='ativo'&&temExito(h)&&!h.exitoValor).length;
    const n=new Date();
    let html=`<div class="stats">
      <div class="stat ${atras?'alert':''}"><span>Em atraso</span><b class="money">${brl(atras)}</b></div>
      <div class="stat"><span>A receber em ${MESES[n.getMonth()]}</span><b class="money">${brl(aReceber)}</b></div>
      <div class="stat good"><span>Recebido em ${MESES[n.getMonth()]}</span><b class="money">${brl(receb)}</b></div>
      <div class="stat"><span>Êxitos pendentes</span><b>${exitos}</b></div>
      <div class="stat"><span>Contratos ativos</span><b>${S.honorarios.filter(h=>h.status==='ativo').length}</b></div>
      <div class="stat"><span>Parcelas abertas</span><b>${all.filter(x=>!x.p.pago).length}</b></div></div>`;
    if(!S.honorarios.length)return html+vazio('Nenhum contrato de honorários','Cadastre o modo de pagamento do cliente. As parcelas entram aqui e o robô avisa os vencimentos.','honorarios','+ Cadastrar contrato');
    if(UI.finF==='parcelas'){
      const l=all.filter(x=>!x.p.pago||(x.p.pagoEm||'')>=ymd(addD(parseD(hojeStr()),-30))).sort((a,b)=>((!!a.p.pago)-(!!b.p.pago))||a.p.venc.localeCompare(b.p.venc));
      html+=l.length?`<div class="list">${l.map(rowParcela).join('')}</div>`:vazio('Nenhuma parcela em aberto','Tudo recebido. As parcelas pagas nos últimos 30 dias também aparecem aqui.');
    }else{
      const l=[...S.honorarios].sort((a,b)=>(a.status!=='ativo')-(b.status!=='ativo')||nomeCli(a.clienteId).localeCompare(nomeCli(b.clienteId),'pt-BR'));
      html+=`<div class="grid2">${l.map(rowContrato).join('')}</div>`;
    }
    return html;
  }};

async function marcarParcela(hid,i){
  const h=byId('honorarios',hid);if(!h)return;const ps=(h.parcelas||[]).map(p=>({...p}));const p=ps[i];if(!p)return;
  p.pago=!p.pago;p.pagoEm=p.pago?hojeStr():'';
  const patch={parcelas:ps};if(ps.length&&ps.every(x=>x.pago)&&!temExito(h))patch.status='quitado';else if(h.status==='quitado'&&!p.pago)patch.status='ativo';
  if(await atualizar('honorarios',hid,patch))toast(p.pago?'Parcela marcada como recebida.':'Recebimento desfeito.');
}
function foneWa(t){let d=digits(t);if(!d)return'';if(!d.startsWith('55'))d='55'+d;return d;}
function abrirMensagem(titulo,texto,fone,emailAssunto,email,extraBtn){
  const sh=$('#sheet');SH={col:'__msg'};const wa=foneWa(fone);
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="msT"><div class="ph"><h3 id="msT">${esc(titulo)}</h3><button class="btn ghost sm" id="msX" type="button">Fechar</button></div>
    <div class="pb"><div class="fld"><span class="lab">Mensagem pronta</span><div class="msgbox" id="msTxt">${esc(texto)}</div>${wa?'':'<span class="hint">Cadastre o telefone do cliente para abrir direto no WhatsApp.</span>'}</div>${extraBtn?`<div class="fld">${extraBtn}</div>`:''}</div>
    <div class="pf"><div class="r"><button class="btn" id="msCp" type="button">Copiar</button>${email?`<a class="btn" href="mailto:${esc(email)}?subject=${encodeURIComponent(emailAssunto||'')}&body=${encodeURIComponent(texto)}">E-mail</a>`:''}${wa?`<a class="btn pri" id="msWa" href="https://wa.me/${wa}?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">Abrir no WhatsApp</a>`:''}</div></div></div>`;
  sh.hidden=false;$('#msX').onclick=closeForm;$('#msCp').onclick=()=>copiar(texto);
}
function cobrar(hid,i){
  const h=byId('honorarios',hid),p=h&&h.parcelas[i];if(!p)return;const c=byId('clientes',h.clienteId)||{};
  const pix=S.config.chavePix;
  const txt=`Olá, ${(c.nome||'').split(' ')[0]||'tudo bem'}! Passando para lembrar da ${p.desc.toLowerCase()} dos honorários, no valor de ${brl(p.valor)}, com vencimento em ${fmtD(p.venc)}.${pix&&/pix/i.test(h.formaPagamento||'Pix')?`\nChave Pix: ${pix}${typeof pixCopiaECola==='function'?(()=>{const cc=pixCopiaECola(p.valor,'HON'+String(h.id).replace(/[^A-Za-z0-9]/g,'').slice(0,10)+(i+1));return cc?`\n\nPix copia e cola (já com o valor):\n${cc}`:'';})():''}`:''}\nSe já pagou, por favor desconsidere e me envie o comprovante. Obrigado!\n${S.config.nome||''}`;
  abrirMensagem('Cobrança da parcela',txt,c.telefone,'Lembrete de pagamento',c.email);
}

/* =====================================================================
   DOCUMENTOS: procuração e contrato
   ===================================================================== */
const MODELO_PROCURACAO=`PROCURAÇÃO AD JUDICIA ET EXTRA

OUTORGANTE: {{OUTORGANTE}}.

OUTORGADO(S): {{OUTORGADOS}}{{SOCIEDADE}}, com endereço profissional em {{ESCRITORIO_ENDERECO}}{{ESCRITORIO_CONTATO}}, onde recebem intimações.

PODERES: Pelo presente instrumento particular de mandato, o(a) OUTORGANTE nomeia e constitui o(s) OUTORGADO(S) seu(s) bastante(s) procurador(es), conferindo-lhe(s) os poderes da cláusula ad judicia et extra para o foro em geral, em qualquer juízo, instância ou tribunal, podendo propor as ações competentes e defendê-lo(a) nas contrárias, seguindo umas e outras até final decisão, usando os recursos legais e acompanhando-os, e praticar todos os atos necessários ao fiel cumprimento deste mandato{{PODERES_AREA}}{{PODERES_ESPECIAIS}}{{SUBSTABELECER}}{{FINALIDADE}}.

{{CIDADE}}, {{DATA_EXTENSO}}.



______________________________________________
{{CLIENTE_NOME}}
CPF {{CLIENTE_CPF}}`;

const MODELO_CONTRATO=`CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E DE HONORÁRIOS

CONTRATANTE: {{CONTRATANTE}}.

CONTRATADO(S): {{OUTORGADOS}}{{SOCIEDADE}}, com endereço profissional em {{ESCRITORIO_ENDERECO}}{{ESCRITORIO_CONTATO}}.

As partes acima qualificadas celebram o presente contrato, regido pelas cláusulas abaixo, pela Lei nº 8.906/1994 (Estatuto da Advocacia e da OAB) e pelo Código de Ética e Disciplina da OAB.

CLÁUSULA 1ª – DO OBJETO
O(s) CONTRATADO(S) prestará(ão) serviços advocatícios ao CONTRATANTE para {{OBJETO}}.

CLÁUSULA 2ª – DOS HONORÁRIOS
{{HONORARIOS}}

CLÁUSULA 3ª – DA FORMA DE PAGAMENTO
{{PAGAMENTO}}

CLÁUSULA 4ª – DO ATRASO
O atraso no pagamento de qualquer valor implicará multa de 2% (dois por cento), juros de mora de 1% (um por cento) ao mês e correção monetária pelo IPCA, contados do vencimento.

CLÁUSULA 5ª – DAS DESPESAS
Custas, taxas, perícias, cópias, certidões, deslocamentos para fora da comarca e demais despesas necessárias ao andamento do caso correm por conta do CONTRATANTE, não estão incluídas nos honorários e serão informadas previamente.

CLÁUSULA 6ª – DOS HONORÁRIOS DE SUCUMBÊNCIA
Os honorários de sucumbência pertencem ao(s) CONTRATADO(S), nos termos dos arts. 22 e 23 da Lei nº 8.906/1994, sem prejuízo dos honorários contratados neste instrumento.

CLÁUSULA 7ª – DAS OBRIGAÇÕES DO CONTRATANTE
O CONTRATANTE se obriga a fornecer, com veracidade e no prazo solicitado, os documentos e as informações necessários, a manter atualizados seus dados de contato e a comunicar qualquer fato relevante para o caso.{{AUTORIZACAO_GOV}}

CLÁUSULA 8ª – DA REVOGAÇÃO E DA RESCISÃO
Revogado o mandato ou rescindido este contrato sem culpa do(s) CONTRATADO(S), serão devidos os honorários vencidos e os proporcionais ao trabalho já realizado, bem como os honorários de êxito, se o resultado vier a ser obtido, ainda que posteriormente.

CLÁUSULA 9ª – DA PROTEÇÃO DE DADOS
O CONTRATANTE autoriza o tratamento de seus dados pessoais, inclusive sensíveis, exclusivamente para a execução deste contrato e para o exercício regular de direitos em processo judicial ou administrativo, nos termos dos arts. 7º, V e VI, e 11, II, "d", da Lei nº 13.709/2018 (LGPD), obrigando-se o(s) CONTRATADO(S) a guardar sigilo.

CLÁUSULA 10ª – DO TÍTULO EXECUTIVO E DO FORO
Este contrato constitui título executivo extrajudicial (art. 24 da Lei nº 8.906/1994). Fica eleito o foro da comarca de {{FORO}} para dirimir eventuais controvérsias.

E, por estarem de acordo, as partes assinam este instrumento, inclusive por assinatura eletrônica, nos termos da Lei nº 14.063/2020.

{{CIDADE}}, {{DATA_EXTENSO}}.



______________________________________________
CONTRATANTE: {{CLIENTE_NOME}} – CPF {{CLIENTE_CPF}}



______________________________________________
CONTRATADO(S): {{ASSINATURA_ADVOGADOS}}{{TESTEMUNHAS}}`;

const PODERES=[
  ['citacao','receber citação'],['confessar','confessar'],['reconhecer','reconhecer a procedência do pedido'],['transigir','transigir'],
  ['desistir','desistir'],['renunciar','renunciar ao direito sobre o qual se funda a ação'],['quitacao','receber valores e dar quitação, inclusive levantar alvarás, RPVs e precatórios'],
  ['compromisso','firmar compromisso'],['hipossuf','assinar declaração de hipossuficiência econômica']];
const PODERES_PADRAO=['citacao','transigir','desistir','quitacao','compromisso','hipossuf'];
const PODER_AREA={
  'Previdenciário':'; inclusive perante o Instituto Nacional do Seguro Social – INSS e demais órgãos da Administração Pública, podendo requerer benefícios, revisões, certidões, cópias e vista de processos administrativos, cumprir exigências, agendar e acompanhar perícias e interpor recursos ao Conselho de Recursos da Previdência Social – CRPS',
  'Criminal':'; inclusive perante autoridades policiais, o Ministério Público e órgãos do sistema prisional, podendo acompanhar inquéritos e atos de investigação, requerer liberdade provisória, relaxamento de prisão e revogação de prisão preventiva, impetrar habeas corpus e atuar na execução penal',
  'Trabalhista':'; inclusive perante a Justiça do Trabalho, o Ministério do Trabalho e Emprego, as Superintendências Regionais do Trabalho, o Ministério Público do Trabalho e a Caixa Econômica Federal, podendo propor reclamações trabalhistas, participar de audiências e mediações, requerer o levantamento de FGTS, seguro-desemprego e alvarás',
  'Geral':''};
const listaE=a=>a.length<=1?(a[0]||''):a.slice(0,-1).join(', ')+' e '+a[a.length-1];
function parseOab(s){const t=String(s||'').toUpperCase();const uf=(t.match(/(?<![A-Z])[A-Z]{2}(?![A-Z])/g)||[]).find(u=>UFS.includes(u))||'';const n=(t.replace(/\./g,'').match(/\d+[A-Z]?/)||[''])[0];return{uf,num:n};}
function qualificacao(c){
  if(!c)return'(selecione o cliente)';
  const p=[(c.nome||'(nome)').toUpperCase()];[c.nacionalidade,c.estadoCivil,c.profissao].forEach(x=>x&&p.push(x));
  if(c.rg)p.push(`portador(a) do RG nº ${c.rg}${c.rgOrgao?' '+c.rgOrgao:''}`);
  if(c.cpf)p.push(`inscrito(a) no CPF sob o nº ${c.cpf}`);
  const end=[c.logradouro,c.numero?'nº '+c.numero:'',c.complemento,c.bairro,c.cidade?c.cidade+(c.uf?'/'+c.uf:''):'',c.cep?'CEP '+c.cep:''].filter(Boolean).join(', ');
  if(end)p.push('residente e domiciliado(a) em '+end);
  if(c.email)p.push('e-mail '+c.email);
  if(c.telefone)p.push('telefone '+c.telefone);
  return p.join(', ');
}
function faltaQualif(c){if(!c)return['cliente'];const m={cpf:'CPF',rg:'RG',estadoCivil:'estado civil',profissao:'profissão',logradouro:'endereço',cidade:'cidade'};return Object.keys(m).filter(k=>!c[k]).map(k=>m[k]);}
function advogados(){return S.equipe.filter(m=>m.ativo!==false&&/Advog/.test(m.funcao||'')&&m.oab);}
function outorgados(ids){const l=ids.map(id=>byId('equipe',id)).filter(Boolean).map(m=>{const o=parseOab(m.oab);return `${m.nome.toUpperCase()}, advogado(a) inscrito(a) na OAB/${o.uf} sob o nº ${o.num}`;});return l.length?l.join('; '):'(selecione os advogados)';}
function textoHonorarios(h){
  if(!h)return'(selecione o contrato de honorários)';
  const fixo=Number(h.valor)||0,N=Math.max(1,Math.floor(Number(h.parcelasN)||1)),pct=Number(h.percentual)||0,ent=Number(h.entrada)||0;
  const base=h.baseExito||'sobre o proveito econômico obtido';
  const exito=`honorários de êxito correspondentes a ${String(pct).replace('.',',')}% (${pctExtenso(pct)}) ${base}, devidos somente em caso de resultado favorável e pagos em até 5 (cinco) dias do recebimento dos valores pelo CONTRATANTE`;
  const ini='Pelos serviços objeto deste contrato, o CONTRATANTE pagará ao(s) CONTRATADO(S) ';
  switch(h.modalidade){
    case'avista':return ini+`honorários no valor de ${brl(fixo)} (${valorExtenso(fixo)}).`;
    case'parcelado':return ini+`honorários no valor total de ${brl(fixo)} (${valorExtenso(fixo)}), divididos em ${N} (${numExt(N)}) parcelas mensais.`;
    case'exito':return ini+exito+'. Não havendo êxito, nada será devido a título de honorários contratuais, ressalvado o disposto na cláusula 8ª.';
    case'entrada_exito':return ini+`honorários compostos de: (a) entrada de ${brl(ent)} (${valorExtenso(ent)}), não reembolsável; e (b) ${exito}.`;
    case'parcelado_exito':return ini+`honorários compostos de: (a) valor fixo de ${brl(fixo)} (${valorExtenso(fixo)}), dividido em ${N} (${numExt(N)}) parcelas mensais; e (b) ${exito}.`;
  }
  return'(defina o modo de pagamento no Financeiro)';
}
function textoPagamento(h){
  if(!h)return'';
  const forma=(h.formaPagamento||'Pix')==='Pix'?'Pix':(h.formaPagamento||'').toLowerCase();const pix=S.config.chavePix&&/pix/i.test(h.formaPagamento||'Pix')?`, chave ${S.config.chavePix}`:'';
  const ps=(h.parcelas||[]).filter(p=>p.desc!=='Êxito');const parts=[];
  if(ps.length===1)parts.push(`O pagamento será feito por ${forma}${pix}, em ${fmtD(ps[0].venc)}, no valor de ${brl(ps[0].valor)}.`);
  else if(ps.length>1&&ps.length<=12)parts.push(`O pagamento será feito por ${forma}${pix}, conforme o cronograma: ${ps.map(p=>`${p.desc.toLowerCase()}, de ${brl(p.valor)}, com vencimento em ${fmtD(p.venc)}`).join('; ')}.`);
  else if(ps.length>12){const v=ps[0].valor,last=ps[ps.length-1].valor;parts.push(`O pagamento será feito por ${forma}${pix}, em ${ps.length} (${numExt(ps.length)}) parcelas mensais e sucessivas de ${brl(v)}${last!==v?`, sendo a última de ${brl(last)}`:''}, vencendo-se a primeira em ${fmtD(ps[0].venc)} e as demais no mesmo dia dos meses seguintes.`);}
  if(temExito(h))parts.push(`Os honorários de êxito serão pagos por ${forma}${pix}, inclusive quando os valores forem recebidos por RPV, precatório ou pagamento administrativo, podendo o(s) CONTRATADO(S) requerer o destaque dos honorários contratuais no momento da expedição (art. 22, § 4º, da Lei nº 8.906/1994).`);
  return parts.join(' ')||'Conforme combinado entre as partes.';
}
function dadosModelo(o){
  const c=byId('clientes',o.clienteId),cfg=S.config||{};
  const soc=cfg.sociedade?`, integrante(s) da sociedade ${cfg.sociedade}${cfg.cnpj?', inscrita no CNPJ sob o nº '+cfg.cnpj:''}${cfg.registroOab?', registrada na '+cfg.registroOab:''}`:'';
  const contato=[cfg.email?'e-mail '+cfg.email:'',cfg.telefone?'telefone '+cfg.telefone:''].filter(Boolean);
  const esp=PODERES.filter(([k])=>(o.poderes||[]).includes(k)).map(x=>x[1]);
  const h=byId('honorarios',o.honorariosId);
  const advs=(o.advs||[]).map(id=>byId('equipe',id)).filter(Boolean);
  return{
    OUTORGANTE:qualificacao(c),CONTRATANTE:qualificacao(c),CLIENTE_NOME:c?(c.nome||'').toUpperCase():'(cliente)',CLIENTE_CPF:c?(c.cpf||'___.___.___-__'):'',
    OUTORGADOS:outorgados(o.advs||[]),SOCIEDADE:soc,ESCRITORIO_ENDERECO:cfg.endereco||'(endereço do escritório — preencha nos Ajustes)',ESCRITORIO_CONTATO:contato.length?', '+contato.join(', '):'',
    PODERES_AREA:PODER_AREA[o.caso]||'',PODERES_ESPECIAIS:esp.length?`; conferindo-lhe(s), ainda, poderes especiais para ${listaE(esp)}, nos termos do art. 105 do Código de Processo Civil`:'',
    SUBSTABELECER:o.substabelecer?', podendo substabelecer, com ou sem reserva de poderes':'',
    FINALIDADE:o.finalidade?`, especialmente para ${o.finalidade.replace(/\.$/,'')}`:'',
    CIDADE:cfg.cidade||'(cidade)',FORO:cfg.cidade||'(cidade)',DATA_EXTENSO:dataExtenso(),
    OBJETO:h?(h.objeto||'').replace(/\.$/,''):'(objeto)',HONORARIOS:textoHonorarios(h),PAGAMENTO:textoPagamento(h),
    ASSINATURA_ADVOGADOS:advs.length?advs.map(m=>{const x=parseOab(m.oab);return `${m.nome.toUpperCase()} – OAB/${x.uf} ${x.num}`;}).join(' / '):'(advogados)',
    AUTORIZACAO_GOV:c&&c.govAutorizado?'\nParágrafo único. O CONTRATANTE autoriza o(s) CONTRATADO(S) a guardar, de forma criptografada e sigilosa, suas credenciais de acesso à plataforma gov.br (Meu INSS), para uso exclusivo no acompanhamento e na prática de atos relativos ao objeto deste contrato, vedado qualquer outro uso. O CONTRATANTE pode revogar esta autorização e alterar sua senha a qualquer tempo, e as credenciais serão apagadas ao término do contrato.':'',
    TESTEMUNHAS:o.testemunhas?'\n\n\nTESTEMUNHAS:\n\n\n1. ________________________________  CPF:\n\n\n2. ________________________________  CPF:':''
  };
}
const modeloDe=tipo=>tipo==='procuracao'?(S.config.modeloProcuracao||MODELO_PROCURACAO):(S.config.modeloContrato||MODELO_CONTRATO);
const preencher=(modelo,map)=>modelo.replace(/\{\{([A-Z_]+)\}\}/g,(m,k)=>k in map?map[k]:m);

/* ---------- PDF com a logo (pdf-lib, incluída no sistema) ---------- */
const PDF_TROCA={'→':'->','←':'<-','✓':'v','≤':'<=','≥':'>=',' ':' ',' ':' ','​':'','\t':'    '};
function dataUrlBytes(u){const b=atob(String(u).split(',')[1]||'');const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
async function montarPDF(texto){
  if(!window.PDFLib)throw new Error('O gerador de PDF não carregou. Recarregue a página.');
  const{PDFDocument,StandardFonts,rgb}=PDFLib;
  const pdf=await PDFDocument.create();
  pdf.setTitle(String(texto).trim().split('\n')[0].slice(0,120));pdf.setCreator(S.config.nome||NOME_PADRAO);pdf.setLanguage('pt-BR');
  const fR=await pdf.embedFont(StandardFonts.TimesRoman),fB=await pdf.embedFont(StandardFonts.TimesRomanBold),fH=await pdf.embedFont(StandardFonts.Helvetica);
  const MM=72/25.4,W=595.28,H=841.89,ML=25*MM,MR=20*MM,MT=16*MM,MB=26*MM,LW=W-ML-MR,cfg=S.config||{};
  const TAM=11.5,LH=5.6*MM;
  // largura somando letra por letra (o desenho não aplica o ajuste entre pares de letras)
  const cw=new Map();const wid=(t,font,size)=>{let k=cw.get(font);if(!k){k={};cw.set(font,k);}let s=0;for(const ch of t){if(!(ch in k))k[ch]=font.widthOfTextAtSize(ch,1000);s+=k[ch];}return s*size/1000;};
  // troca caracteres que a fonte do PDF não tem
  const cache={};
  const limpa=t=>[...String(t)].map(ch=>{if(ch in cache)return cache[ch];let r=PDF_TROCA[ch];if(r===undefined){try{fR.widthOfTextAtSize(ch,10);r=ch;}catch(e){r=ch.normalize('NFD').replace(/[^\x20-\x7e¡-ÿ]/g,'')||'?';try{fR.widthOfTextAtSize(r,10);}catch(_){r='?';}}}return cache[ch]=r;}).join('');
  let img=null;const logo=cfg.logo||window.LOGO_PADRAO;
  if(logo){try{const by=dataUrlBytes(logo);img=/^data:image\/png/i.test(logo)?await pdf.embedPng(by):await pdf.embedJpg(by);}catch(e){img=null;}}
  let page,y,pg=0;
  const cinza=rgb(0.43,0.43,0.43);
  const quebrar=(t,font,size,larg)=>{const ps=t.split(/ +/);const out=[];let cur='';
    for(const p of ps){const tent=cur?cur+' '+p:p;if(wid(tent,font,size)<=larg||!cur)cur=tent;else{out.push(cur);cur=p;}
      while(wid(cur,font,size)>larg&&cur.length>1){let k=cur.length-1;while(k>1&&wid(cur.slice(0,font,k),size)>larg)k--;out.push(cur.slice(0,k));cur=cur.slice(k);}}
    if(cur)out.push(cur);return out;};
  const rodape=()=>{const linha=limpa([cfg.sociedade||cfg.nome||NOME_PADRAO,cfg.endereco,cfg.telefone,cfg.email].filter(Boolean).join('  •  '));
    const ls=quebrar(linha,fH,8,LW);ls.forEach((l,i)=>{const lw=wid(l,fH,8);page.drawText(l,{x:(W-lw)/2,y:14*MM-(i*9),size:8,font:fH,color:cinza});});
    const n=`Página ${pg}`;page.drawText(n,{x:W-MR-wid(n,fH,8),y:7*MM,size:8,font:fH,color:cinza});};
  const novaPagina=()=>{if(page)rodape();page=pdf.addPage([W,H]);pg++;let hy=MT;
    if(img){let lw=52*MM,lh=img.height*lw/img.width;if(lh>25*MM){lh=25*MM;lw=img.width*lh/img.height;}page.drawImage(img,{x:(W-lw)/2,y:H-hy-lh,width:lw,height:lh});hy+=lh+3*MM;}
    else{const n=limpa(cfg.nome||NOME_PADRAO);const nw=wid(n,fB,14);page.drawText(n,{x:(W-nw)/2,y:H-hy-12,size:14,font:fB});hy+=9*MM;}
    page.drawLine({start:{x:ML,y:H-hy},end:{x:W-MR,y:H-hy},thickness:0.6,color:rgb(0.63,0.63,0.63)});y=hy+9*MM;};
  const cabe=h=>{if(y+h>H-MB)novaPagina();};
  // desenha uma linha justificada (espaços distribuídos), ou alinhada à esquerda/centro
  const linha=(t,font,size,modo)=>{const base=H-y;
    if(modo==='centro'){const tw=wid(t,font,size);page.drawText(t,{x:(W-tw)/2,y:base,size,font});return;}
    const ps=t.split(' ').filter(Boolean);
    if(modo!=='justificar'||ps.length<2){page.drawText(t,{x:ML,y:base,size,font});return;}
    const soma=ps.reduce((s,p)=>s+wid(p,font,size),0);const gap=(LW-soma)/(ps.length-1);
    if(gap>wid(' ',font,size)*4){page.drawText(t,{x:ML,y:base,size,font});return;}
    let x=ML;ps.forEach(p=>{page.drawText(p,{x,y:base,size,font});x+=wid(p,font,size)+gap;});};
  novaPagina();
  const linhas=String(texto).replace(/\r/g,'').split('\n').map(limpa);let tituloFeito=false,centro=false;
  for(const raw of linhas){
    const l=raw.replace(/\s+$/,'');
    if(!l.trim()){y+=LH*0.6;centro=false;continue;}
    if(!tituloFeito){tituloFeito=true;quebrar(l.trim(),fB,13.5,LW).forEach(x=>{cabe(7*MM);y+=0;linha(x,fB,13.5,'centro');y+=7*MM;});y+=3*MM;continue;}
    if(/^_{5,}/.test(l.trim()))centro=true;
    const negrito=/^CL[ÁA]USULA/i.test(l)||(/^(OUTORGANTE|OUTORGADO|PODERES|CONTRATANTE|CONTRATADO|TESTEMUNHAS|RECIBO|EXCELENT)/.test(l)&&l===l.toUpperCase())||/^#{1,3} /.test(l);
    const txt=l.replace(/^#{1,3} /,'');const font=negrito?fB:fR;
    const partes=quebrar(centro?txt.trim():txt,font,TAM,LW);
    partes.forEach((p,i)=>{cabe(LH);linha(p,font,TAM,centro?'centro':(i<partes.length-1?'justificar':'esquerda'));y+=LH;});
    y+=1.2*MM;
  }
  rodape();
  return pdf.save();
}
function nomeArquivo(prefixo,nome){return `${prefixo}-${String(nome||'cliente').toLowerCase().normalize('NFD').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').slice(0,40)}.pdf`;}
function baixarBlob(blob,nome){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nome;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}

/* ---------- gerador ---------- */
function openGerador(tipo,preset){
  const ehP=tipo==='procuracao';
  const o={clienteId:'',processoId:'',honorariosId:'',caso:'Geral',advs:advogados().map(m=>m.id).slice(0,2),poderes:[...PODERES_PADRAO],substabelecer:true,finalidade:'',testemunhas:true,...(preset||{})};
  if(o.honorariosId){const h=byId('honorarios',o.honorariosId);if(h){o.clienteId=o.clienteId||h.clienteId;o.processoId=o.processoId||h.processoId||'';}}
  if(o.processoId){const pr=byId('processos',o.processoId);if(pr){o.clienteId=o.clienteId||pr.clienteId;o.caso=['Previdenciário','Criminal','Trabalhista'].includes(pr.area)?pr.area:'Geral';}}
  const sh=$('#sheet');SH={col:'__doc'};let sujo=false;
  const opt=(arr,sel,lab)=>arr.map(x=>`<option value="${esc(x.id)}" ${x.id===sel?'selected':''}>${esc(lab(x))}</option>`).join('');
  const advs=advogados();
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="gT"><div class="ph"><h3 id="gT">${ehP?'Gerar procuração':'Gerar contrato de honorários'}</h3><button class="btn ghost sm" id="gX" type="button">Fechar</button></div>
  <form class="pb" id="gF" novalidate>
    ${ehP?'':`<div class="fld"><label for="g_hon">Contrato de honorários (aba Financeiro)</label><select class="input" id="g_hon"><option value="">— Escolha —</option>${opt(S.honorarios.filter(h=>h.status!=='cancelado'),o.honorariosId,h=>nomeCli(h.clienteId)+' — '+String(h.objeto||'').slice(0,60))}</select><span class="hint">O modo de pagamento e as parcelas vêm de lá.</span></div>`}
    <div class="fld half"><label for="g_cli">Cliente</label><select class="input" id="g_cli"><option value="">— Escolha —</option>${opt([...S.clientes].sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR')),o.clienteId,c=>c.nome)}</select></div>
    <div class="fld half"><label for="g_pro">Processo (opcional)</label><select class="input" id="g_pro"><option value="">— Nenhum —</option>${opt(S.processos,o.processoId,procLabel)}</select></div>
    <div class="fld" id="g_falta" hidden></div>
    ${ehP?`<div class="fld half"><label for="g_caso">Tipo de caso</label><select class="input" id="g_caso">${['Previdenciário','Criminal','Trabalhista','Geral'].map(x=>`<option ${x===o.caso?'selected':''}>${x}</option>`).join('')}</select></div>`:''}
    <div class="fld"><span class="lab">${ehP?'Outorgados':'Contratados'}</span><div class="multi">${advs.length?advs.map(m=>`<label class="chk"><input type="checkbox" data-adv="${esc(m.id)}" ${o.advs.includes(m.id)?'checked':''}>${esc(m.nome)} · OAB ${esc(m.oab)}</label>`).join(''):'<span class="hint">Cadastre os advogados com OAB na aba Equipe.</span>'}</div></div>
    ${ehP?`<div class="fld"><span class="lab">Poderes especiais (art. 105 do CPC)</span><div class="multi">${PODERES.map(([k,l])=>`<label class="chk"><input type="checkbox" data-pod="${k}" ${o.poderes.includes(k)?'checked':''}>${esc(l.charAt(0).toUpperCase()+l.slice(1))}</label>`).join('')}<label class="chk"><input type="checkbox" id="g_sub" ${o.substabelecer?'checked':''}>Substabelecer, com ou sem reserva</label></div></div>
    <div class="fld"><label for="g_fin">Finalidade específica (opcional)</label><input class="input" id="g_fin" value="${esc(o.finalidade)}" placeholder="ajuizar ação de concessão de BPC/LOAS em face do INSS"><span class="hint">Em queixa-crime, descreva o fato e o querelado (art. 44 do CPP).</span></div>`
    :`<div class="fld"><label class="chk"><input type="checkbox" id="g_test" ${o.testemunhas?'checked':''}>Incluir duas testemunhas</label><span class="hint">Com assinatura eletrônica certificada (como a do gov.br), as testemunhas podem ser dispensadas (art. 784, § 4º, do CPC).</span></div>`}
    <div class="fld"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><label for="g_txt">Texto final (pode editar à vontade)</label><button class="lnk" id="g_refaz" type="button" hidden>Refazer texto a partir das opções</button></div><textarea class="input doc" id="g_txt"></textarea></div>
  </form>
  <div class="pf"><div class="r"><button class="btn" id="gC" type="button">Cancelar</button><button class="btn pri" id="gS" type="button">Gerar PDF</button></div></div></div>`;
  sh.hidden=false;
  const ler=()=>{
    if(!ehP){o.honorariosId=$('#g_hon').value;const h=byId('honorarios',o.honorariosId);if(h&&!$('#g_cli').dataset.mexido){$('#g_cli').value=h.clienteId||'';if(h.processoId)$('#g_pro').value=h.processoId;}}
    o.clienteId=$('#g_cli').value;o.processoId=$('#g_pro').value;
    o.advs=[...sh.querySelectorAll('[data-adv]')].filter(x=>x.checked).map(x=>x.dataset.adv);
    if(ehP){o.caso=$('#g_caso').value;o.poderes=[...sh.querySelectorAll('[data-pod]')].filter(x=>x.checked).map(x=>x.dataset.pod);o.substabelecer=$('#g_sub').checked;o.finalidade=$('#g_fin').value.trim();}
    else o.testemunhas=$('#g_test').checked;
  };
  const montar=()=>{ler();const f=faltaQualif(byId('clientes',o.clienteId));const fb=$('#g_falta');
    if(o.clienteId&&f.length){fb.hidden=false;fb.innerHTML=`<div class="banner" style="margin:0">Faltam dados do cliente: ${esc(f.join(', '))}. <button class="lnk" type="button" data-edcli>Completar cadastro</button></div>`;}else fb.hidden=true;
    if(!sujo)$('#g_txt').value=preencher(modeloDe(tipo),dadosModelo(o));};
  $('#gF').addEventListener('change',e=>{if(e.target.id==='g_cli')e.target.dataset.mexido='1';if(e.target.id==='g_pro'){const pr=byId('processos',e.target.value);if(pr&&ehP)$('#g_caso').value=['Previdenciário','Criminal','Trabalhista'].includes(pr.area)?pr.area:'Geral';}montar();});
  $('#gF').addEventListener('input',e=>{if(e.target.id==='g_txt'){sujo=true;$('#g_refaz').hidden=false;}else if(e.target.id==='g_fin')montar();});
  $('#gF').addEventListener('click',e=>{if(e.target.closest('[data-edcli]')){const id=o.clienteId;closeForm();openForm('clientes',id,null,()=>openGerador(tipo,{...o}));}});
  $('#g_refaz').onclick=()=>{sujo=false;$('#g_refaz').hidden=true;montar();};
  $('#gX').onclick=$('#gC').onclick=closeForm;
  $('#gS').onclick=async()=>{
    ler();if(!o.clienteId)return toast('Escolha o cliente.');if(!o.advs.length)return toast(`Marque pelo menos um advogado.`);if(!ehP&&!o.honorariosId)return toast('Escolha o contrato de honorários.');
    if(!window.PDFLib)return toast('O gerador de PDF não carregou. Recarregue a página.');
    const btn=$('#gS');btn.disabled=true;btn.textContent='Gerando…';
    try{
      const txt=$('#g_txt').value;const bytes=await montarPDF(txt);const c=byId('clientes',o.clienteId);
      const nome=nomeArquivo(ehP?'procuracao':'contrato',c&&c.nome);
      const id=uid();const blob=new Blob([bytes],{type:'application/pdf'});const file=new File([blob],nome,{type:'application/pdf'});
      const path=await enviarArquivo(file,`documentos/${id}`);if(!path)throw new Error('upload');
      const ok=await salvar('documentos',null,{tipo,clienteId:o.clienteId,processoId:o.processoId,honorariosId:o.honorariosId||'',arquivo:path,nomeArquivo:nome,status:'gerado',texto:txt,opcoes:{caso:o.caso,advs:o.advs,poderes:o.poderes,substabelecer:o.substabelecer,finalidade:o.finalidade,testemunhas:o.testemunhas}},id);
      if(!ok)throw new Error('save');
      try{baixarBlob(blob,nome);}catch(_){}
      closeForm();toast('PDF gerado e guardado.');openEnvio(id);
    }catch(e){console.error(e);btn.disabled=false;btn.textContent='Gerar PDF';if(e.message!=='upload'&&e.message!=='save')toast('Não foi possível gerar o PDF.');}
  };
  montar();
}

async function openEnvio(id){
  const d=byId('documentos',id);if(!d)return;const c=byId('clientes',d.clienteId)||{};
  const url=await linkArquivo(d.arquivo,7*24*3600);if(!url)return;
  const nomeDoc=d.tipo==='procuracao'?'a procuração':'o contrato de honorários';
  const txt=`Olá, ${(c.nome||'').split(' ')[0]||'tudo bem'}! Segue ${nomeDoc} para você assinar digitalmente pelo gov.br. É gratuito e tem validade jurídica.\n\n1) Baixe o documento: ${url}\n2) Entre em assinador.iti.br (ou no app gov.br, em "Assinar documento") com sua conta gov.br nível prata ou ouro.\n3) Envie o arquivo, posicione a assinatura e confirme com o código que chega no celular.\n4) Baixe o arquivo assinado e me envie por aqui.\n\nO link vale por 7 dias. Qualquer dúvida, é só chamar.\n${S.config.nome||''}`;
  abrirMensagem('Enviar para assinatura',txt,c.telefone,d.tipo==='procuracao'?'Procuração para assinatura':'Contrato para assinatura',c.email,
    `<button class="btn" type="button" id="msEnv">${d.status==='gerado'?'Marcar como enviado':'Já marcado como enviado'}</button>`);
  const b=$('#msEnv');if(b)b.onclick=async()=>{if(d.status==='gerado'&&await atualizar('documentos',id,{status:'enviado',enviadoEm:hojeStr()}))toast('Marcado como enviado.');closeForm();};
}
async function anexarAssinado(id){
  const d=byId('documentos',id);if(!d)return;const f=await escolherArquivo('application/pdf,image/*');if(!f)return;
  toast('Enviando arquivo assinado…');const p=await enviarArquivo(f,`documentos/${id}`);if(!p)return;
  if(await atualizar('documentos',id,{status:'assinado',assinado:p,assinadoEm:hojeStr()})){
    if(d.processoId){const pr=byId('processos',d.processoId);if(pr){const ck={...(pr.checklist||{})};ck[d.tipo]={ok:true,arquivo:p};await atualizar('processos',pr.id,{checklist:ck});}}
    toast('Assinado! O checklist do processo foi atualizado.');
  }
}
function rowDocumento(d){
  const c=byId('clientes',d.clienteId),pr=byId('processos',d.processoId);
  if(d.tipo==='recibo'||d.tipo==='peticao')return rowDocExtra(d);
  const st=d.status==='assinado'?['ok','Assinado'+(d.assinadoEm?' em '+fmtD(d.assinadoEm):'')]:d.status==='enviado'?['warn','Aguardando assinatura'+(d.enviadoEm?' desde '+fmtD(d.enviadoEm):'')]:['mute','Gerado'];
  return `<div class="row a-${pr?areaCls(pr.area):'adm'}"><div class="main">
    <div class="chips"><span class="chip c-mute">${d.tipo==='procuracao'?'Procuração':'Contrato'}</span><span class="chip c-${st[0]}">${esc(st[1])}</span></div>
    <div class="t">${esc(c?c.nome:'Cliente removido')}</div>
    <div class="m">${pr?`<span class="mono">${esc(pr.numero||'')}</span> · `:''}Gerado em ${fmtDT(d.criadoEm)}</div>
    <div class="acts"><button class="btn sm" data-dver="${esc(d.arquivo)}" type="button">Ver PDF</button>
      ${d.status!=='assinado'?`<button class="btn sm pri" data-denv="${esc(d.id)}" type="button">Enviar para assinar</button><button class="btn sm" data-dass="${esc(d.id)}" type="button">Anexar assinado</button>`:`<button class="btn sm pri" data-dver="${esc(d.assinado)}" type="button">Ver assinado</button>`}
      <button class="btn sm ghost" data-ddel="${esc(d.id)}" type="button">Excluir</button></div>
  </div></div>`;
}
VIEWS.documentos={t:'Documentos',
  tools(){return `<div class="sub">Procuração e contrato gerados com a logo e os dados do escritório. O cliente assina de graça pelo gov.br, que o STJ reconhece como válido para procuração.</div><div class="tools"><button class="btn pri" data-gerar="procuracao" type="button">+ Procuração</button><button class="btn pri" data-gerar="contrato" type="button">+ Contrato</button><button class="btn pri" data-novapeca type="button">+ Petição</button><button class="btn push" data-modelos type="button">Modelos de procuração e contrato</button><button class="btn" data-modpecas type="button">Modelos de petição</button></div>`;},
  body(){
    const l=[...S.documentos].sort((a,b)=>(b.criadoEm||'').localeCompare(a.criadoEm||''));
    const pend=l.filter(d=>d.status==='enviado').length;
    return (pend?`<div class="banner">${pend} ${pend===1?'documento aguardando':'documentos aguardando'} assinatura do cliente.</div>`:'')+(l.length?`<div class="list">${l.map(rowDocumento).join('')}</div>`:`<div class="empty"><b>Nenhum documento gerado</b><span>Complete os Ajustes (endereço e logo), cadastre o cliente e gere a procuração. Para o contrato, cadastre antes o modo de pagamento no Financeiro.</span><button class="btn pri" data-gerar="procuracao" type="button">+ Gerar procuração</button></div>`);
  }};

function openModelos(){
  const sh=$('#sheet');SH={col:'__mod'};
  const ph='{{OUTORGANTE}} {{CONTRATANTE}} {{CLIENTE_NOME}} {{CLIENTE_CPF}} {{OUTORGADOS}} {{SOCIEDADE}} {{ESCRITORIO_ENDERECO}} {{ESCRITORIO_CONTATO}} {{PODERES_AREA}} {{PODERES_ESPECIAIS}} {{SUBSTABELECER}} {{FINALIDADE}} {{OBJETO}} {{HONORARIOS}} {{PAGAMENTO}} {{ASSINATURA_ADVOGADOS}} {{TESTEMUNHAS}} {{AUTORIZACAO_GOV}} {{CIDADE}} {{FORO}} {{DATA_EXTENSO}}';
  sh.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="moT"><div class="ph"><h3 id="moT">Modelos de documentos</h3><button class="btn ghost sm" id="moX" type="button">Fechar</button></div>
  <div class="pb">
    <div class="fld"><span class="hint">Edite as cláusulas como preferir. Os campos entre chaves são trocados pelos dados do cliente, do escritório e dos honorários: <span class="mono" style="font-size:11.5px">${esc(ph)}</span>. A primeira linha vira o título.</span></div>
    <div class="fld"><div style="display:flex;justify-content:space-between;gap:8px"><label for="mo_p">Procuração</label><button class="lnk" type="button" id="mo_rp">Restaurar padrão</button></div><textarea class="input doc" id="mo_p">${esc(modeloDe('procuracao'))}</textarea></div>
    <div class="fld"><div style="display:flex;justify-content:space-between;gap:8px"><label for="mo_c">Contrato de honorários</label><button class="lnk" type="button" id="mo_rc">Restaurar padrão</button></div><textarea class="input doc" id="mo_c">${esc(modeloDe('contrato'))}</textarea></div>
  </div><div class="pf"><div class="r"><button class="btn" id="moC" type="button">Cancelar</button><button class="btn pri" id="moS" type="button">Salvar modelos</button></div></div></div>`;
  sh.hidden=false;
  $('#moX').onclick=$('#moC').onclick=closeForm;
  $('#mo_rp').onclick=()=>{$('#mo_p').value=MODELO_PROCURACAO;};$('#mo_rc').onclick=()=>{$('#mo_c').value=MODELO_CONTRATO;};
  $('#moS').onclick=async()=>{const p=$('#mo_p').value,c=$('#mo_c').value;const cfg={...S.config,modeloProcuracao:p===MODELO_PROCURACAO?'':p,modeloContrato:c===MODELO_CONTRATO?'':c};if(await salvarConfig(cfg)){closeForm();toast('Modelos salvos.');}};
}

/* ---------- cliques destes módulos ---------- */
document.addEventListener('click',e=>{
  if(e.target.closest('#sheet .panel'))return;
  const t=e.target.closest('[data-pg],[data-cobrar],[data-gerarcontrato],[data-gerar],[data-modelos],[data-dver],[data-denv],[data-dass],[data-ddel]');if(!t)return;
  e.stopPropagation();
  if(t.dataset.pg)return marcarParcela(t.dataset.pg,Number(t.dataset.i));
  if(t.dataset.cobrar)return cobrar(t.dataset.cobrar,Number(t.dataset.i));
  if(t.dataset.gerarcontrato)return openGerador('contrato',{honorariosId:t.dataset.gerarcontrato});
  if(t.dataset.gerar)return openGerador(t.dataset.gerar);
  if('modelos' in t.dataset)return openModelos();
  if(t.dataset.dver)return abrirArquivo(t.dataset.dver);
  if(t.dataset.denv)return openEnvio(t.dataset.denv);
  if(t.dataset.dass)return anexarAssinado(t.dataset.dass);
  if(t.dataset.ddel){if(t.dataset.armed){excluir('documentos',t.dataset.ddel).then(ok=>ok&&toast('Documento excluído.'));}else{t.dataset.armed='1';t.textContent='Toque de novo';setTimeout(()=>{if(t.isConnected){delete t.dataset.armed;t.textContent='Excluir';}},4000);}}
},true);
