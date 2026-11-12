'use strict';
/* =====================================================================
   Prazo sugerido pela intimação, Pix copia e cola, recibo em PDF e
   suspensões de prazo dos tribunais
   ===================================================================== */

/* ---------- prazo sugerido pelo texto da intimação ---------- */
const NUM_EXT={um:1,uma:1,dois:2,duas:2,'três':3,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,quinze:15,vinte:20,trinta:30,quarenta:40,sessenta:60,noventa:90};
function sugerirDias(t){
  t=String(t||'');
  const pad1=/(?:prazo(?:\s+(?:legal|comum|sucessivo|improrrog[áa]vel))?\s+de|no\s+prazo\s+de|em|dentro\s+de|pelo\s+prazo\s+de)\s+(\d{1,3})\s*(?:\([^)]{2,40}\))?\s*(?:\(?dias?\)?)(\s+[úu]teis|\s+corridos)?/i;
  let m=t.match(pad1);if(m&&+m[1]>0&&+m[1]<=365)return{dias:+m[1],trecho:m[0].trim().slice(0,80)};
  m=t.match(/(\d{1,3})\s*\([a-zçãéêíóôú\s]{3,30}\)\s*dias/i);if(m&&+m[1]>0&&+m[1]<=365)return{dias:+m[1],trecho:m[0].trim().slice(0,80)};
  m=t.match(/prazo\s+de\s+(um|uma|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|sessenta|noventa)\s+dias/i);
  if(m)return{dias:NUM_EXT[m[1].toLowerCase()],trecho:m[0].trim()};
  return null;
}

/* ---------- Pix copia e cola (BR Code estático do Banco Central) ---------- */
function crc16(s){let c=0xFFFF;for(const b of new TextEncoder().encode(s)){c^=b<<8;for(let i=0;i<8;i++)c=(c&0x8000)?((c<<1)^0x1021)&0xFFFF:(c<<1)&0xFFFF;}return c.toString(16).toUpperCase().padStart(4,'0');}
const pixTxt=(s,n)=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9 .,\-\/@]/g,'').trim().slice(0,n);
// e-mail e chave aleatória ficam como estão; CPF/CNPJ só números; telefone no formato +55DDD9XXXXXXXX
function normChavePix(k){k=String(k||'').trim();if(!k)return'';
  if(k.includes('@'))return k.toLowerCase();
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k))return k.toLowerCase();
  const d=k.replace(/\D/g,'');
  const pareceFone=k.startsWith('+')||/\(\d{2}\)/.test(k)||/^\d{2}\s?9\d{4}-?\d{4}$/.test(k)&&!/\./.test(k);
  if(pareceFone&&(d.length===10||d.length===11||d.length===12||d.length===13))return '+'+(d.startsWith('55')&&d.length>=12?d:'55'+d);
  return d;}
function pixPayload({chave,nome,cidade,valor,txid}){
  chave=normChavePix(chave);if(!chave)return'';
  const f=(id,v)=>id+String(v.length).padStart(2,'0')+v;
  const gui=f('00','br.gov.bcb.pix')+f('01',chave);
  let p=f('00','01')+f('26',gui)+f('52','0000')+f('53','986');
  if(Number(valor)>0)p+=f('54',Number(valor).toFixed(2));
  p+=f('58','BR')+f('59',pixTxt(nome,25)||'RECEBEDOR')+f('60',pixTxt(cidade,15)||'BELEM');
  p+=f('62',f('05',(String(txid||'***').replace(/[^A-Za-z0-9]/g,'').slice(0,25))||'***'));
  p+='6304';return p+crc16(p);
}
function pixCopiaECola(valor,txid){const c=S.config||{};if(!c.chavePix)return'';return pixPayload({chave:c.chavePix,nome:c.pixNome||c.nome||NOME_PADRAO,cidade:c.pixCidade||String(c.cidade||'').split('/')[0],valor,txid});}

/* ---------- recibo de honorários ---------- */
async function gerarRecibo(hid,i){
  const h=byId('honorarios',hid),p=h&&(h.parcelas||[])[i];if(!p)return;
  const c=byId('clientes',h.clienteId)||{};const resp=byId('equipe',h.responsavelId);
  const adv=advogados()[0];const quem=(resp&&/Advog/.test(resp.funcao||'')?resp:adv)||null;
  const o=quem?parseOab(quem.oab):null;
  const txt=`RECIBO DE HONORÁRIOS ADVOCATÍCIOS

Valor: ${brl(p.valor)}

Recebi de ${(c.nome||'').toUpperCase()}${c.cpf?', inscrito(a) no CPF sob o nº '+c.cpf:''}, a quantia de ${brl(p.valor)} (${valorExtenso(p.valor)}), referente à ${p.desc.toLowerCase()} dos honorários advocatícios contratados para ${String(h.objeto||'').replace(/\.$/,'')}, paga por ${(h.formaPagamento||'Pix')==='Pix'?'Pix':(h.formaPagamento||'').toLowerCase()}${p.pagoEm?' em '+fmtD(p.pagoEm):''}.

Para clareza, firmo o presente recibo, dando plena quitação do valor acima.

${S.config.cidade||'Belém/PA'}, ${dataExtenso(p.pagoEm||hojeStr())}.



______________________________________________
${quem?quem.nome.toUpperCase()+' – OAB/'+o.uf+' '+o.num:(S.config.nome||NOME_PADRAO)}
${S.config.sociedade||S.config.nome||NOME_PADRAO}${S.config.cnpj?' – CNPJ '+S.config.cnpj:''}`;
  try{
    toast('Gerando recibo…');
    const prR=byId('processos',h.processoId);const bytes=await montarPDF(txt,{proc:prR&&prR.numero||'',sub:'Recibo de honorários · '+(c.nome||'')});const nome=nomeArquivo('recibo',c.nome);
    const blob=new Blob([bytes],{type:'application/pdf'});const id=uid();
    const path=await enviarArquivo(new File([blob],nome,{type:'application/pdf'}),`documentos/${id}`);if(!path)return;
    const ok=await salvar('documentos',null,{tipo:'recibo',clienteId:h.clienteId,processoId:h.processoId||'',honorariosId:h.id,parcela:p.desc,valor:p.valor,arquivo:path,nomeArquivo:nome,status:'emitido'},id);
    if(!ok)return;try{baixarBlob(blob,nome);}catch(_){}
    const url=await linkArquivo(path,7*24*3600);
    abrirMensagem('Enviar recibo',`Olá, ${(c.nome||'').split(' ')[0]||'tudo bem'}! Recebemos o pagamento da ${p.desc.toLowerCase()} (${brl(p.valor)}). Obrigado!\nSegue o recibo: ${url||''}\n(O link vale por 7 dias.)\n${S.config.nome||NOME_PADRAO}`,c.telefone,'Recibo de honorários',c.email);
  }catch(e){console.error(e);toast('Não foi possível gerar o recibo: '+(e.message||'erro'));}
}
function rowDocExtra(d){
  const c=byId('clientes',d.clienteId),pr=byId('processos',d.processoId);
  const rot=d.tipo==='recibo'?'Recibo':'Petição';
  return `<div class="row a-${pr?areaCls(pr.area):'adm'}"><div class="main">
    <div class="chips"><span class="chip c-mute">${rot}</span>${d.tipo==='recibo'?`<span class="chip c-ok">${esc(d.parcela||'')} · ${brl(d.valor)}</span>`:`<span class="chip c-mute">${esc(d.titulo||'')}</span>`}</div>
    <div class="t">${esc(c?c.nome:'Cliente removido')}</div>
    <div class="m">${pr?`<span class="mono">${esc(pr.numero||'')}</span> · `:''}Gerado em ${fmtDT(d.criadoEm)}</div>
    <div class="acts">${d.arquivo?`<button class="btn sm" data-dver="${esc(d.arquivo)}" type="button">Ver PDF</button>`:''}${d.tipo==='peticao'?`<button class="btn sm pri" data-abrirpeca="${esc(d.id)}" type="button">Abrir texto</button>`:''}<button class="btn sm ghost" data-ddel="${esc(d.id)}" type="button">Excluir</button></div>
  </div></div>`;
}

/* ---------- suspensões de prazo ---------- */
function renderSuspensoes(){
  const box=$('#cfSusp');if(!box)return;const l=[...(S.config.suspensoes||[])].sort((a,b)=>String(b.inicio).localeCompare(a.inicio));
  box.innerHTML=`<span class="hint">Quando um tribunal suspender os prazos (portaria, sistema fora do ar, ponto facultativo), cadastre aqui uma vez. Todos os prazos daquele tribunal são recalculados.</span>
    ${l.length?`<div class="cklist">${l.map(s=>`<div class="ckrow"><label style="cursor:default"><span><b>${esc(s.tribunal||'Todos')}</b> · ${fmtD(s.inicio)}${s.fim!==s.inicio?' a '+fmtD(s.fim):''}<span class="tag" style="display:block">${esc(s.motivo||'')}</span></span></label><button class="btn sm ghost" type="button" data-delsusp="${esc(s.id)}">Remover</button></div>`).join('')}</div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <input class="input" id="sp_trib" placeholder="Tribunal (TJPA, TRF1, TRT8 ou Todos)" style="grid-column:span 2">
      <input class="input" id="sp_ini" type="date" aria-label="Início"><input class="input" id="sp_fim" type="date" aria-label="Fim">
      <input class="input" id="sp_mot" placeholder="Motivo (ex.: Portaria 123/2026 – PJe indisponível)" style="grid-column:span 2">
    </div><div><button class="btn" id="sp_add" type="button">Adicionar suspensão</button></div>`;
  $('#sp_add').onclick=async()=>{const tribunal=$('#sp_trib').value.trim()||'Todos',inicio=$('#sp_ini').value,fim=$('#sp_fim').value||inicio,motivo=$('#sp_mot').value.trim();
    if(!inicio)return toast('Informe a data de início.');if(fim<inicio)return toast('O fim não pode ser antes do início.');
    await salvarSuspensoes([...(S.config.suspensoes||[]),{id:uid().slice(0,8),tribunal,inicio,fim,motivo}]);};
  box.querySelectorAll('[data-delsusp]').forEach(b=>b.onclick=()=>salvarSuspensoes((S.config.suspensoes||[]).filter(s=>s.id!==b.dataset.delsusp)));
}
async function salvarSuspensoes(l){
  if(!(await salvarConfig({...S.config,suspensoes:l})))return;
  setSuspensoes(l);renderSuspensoes();
  // recalcula o vencimento guardado dos prazos abertos (é ele que o robô usa para avisar)
  let n=0;
  for(const p of S.prazos.filter(x=>!x.cumprido&&!x.vencManual)){const r=prazoCalc(p);if(r&&r.venc!==p.vencimento){const{error}=await sb.from('prazos').update({dados:limpa({...p,vencimento:r.venc}),atualizado_em:new Date().toISOString()}).eq('id',p.id);if(!error)n++;}}
  if(n)await carregar('prazos');
  toast(n?`Suspensões salvas. ${n} ${n===1?'prazo recalculado':'prazos recalculados'}.`:'Suspensões salvas.');
}

document.addEventListener('click',e=>{
  if(e.target.closest('#sheet .panel'))return;
  const r=e.target.closest('[data-recibo]');if(r){e.stopPropagation();gerarRecibo(r.dataset.recibo,Number(r.dataset.i));}
},true);
