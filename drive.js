'use strict';
/* =====================================================================
   Pastas dos clientes no Google Drive (cópia feita pelo robô, robo/drive.py):
   botão "Abrir pasta no Google Drive" no cliente e no processo, e a linha
   "Cópia no Google Drive" na Saúde do sistema.
   ===================================================================== */
const linkPastaDrive=id=>'https://drive.google.com/drive/folders/'+encodeURIComponent(id);
async function pastasDrive(chaves){
  try{const{data,error}=await sb.from('drive_pastas').select('chave,drive_id').in('chave',chaves);if(error)return{};
    const o={};(data||[]).forEach(r=>o[r.chave]=r.drive_id);return o;}catch(e){return{};}
}
async function mostrarDrive(){
  if(!SH||!SH.id||!['clientes','processos'].includes(SH.col))return;
  const col=SH.col,id=SH.id,box=$(col==='clientes'?'#fichaBoxCli':'#fichaBoxProc');if(!box)return;
  const pr=col==='processos'?byId('processos',id):null;const cid=col==='clientes'?id:(pr&&pr.clienteId);
  const ch=[cid&&'cli:'+cid,pr&&'proc:'+id].filter(Boolean);if(!ch.length)return;
  const p=await pastasDrive(ch);if(!SH||SH.col!==col||SH.id!==id)return;
  const bts=[p['cli:'+cid]&&`<a class="btn sm" href="${linkPastaDrive(p['cli:'+cid])}" target="_blank" rel="noopener">Pasta do cliente no Google Drive</a>`,
    pr&&p['proc:'+id]&&`<a class="btn sm" href="${linkPastaDrive(p['proc:'+id])}" target="_blank" rel="noopener">Pasta deste processo</a>`].filter(Boolean);
  const velho=document.getElementById('driveBox');if(velho)velho.remove();
  if(!bts.length)return;
  const d=document.createElement('div');d.id='driveBox';d.style.margin='14px 0 10px';d.innerHTML='<div class="grouph" style="margin:0 0 6px">Google Drive</div><div class="acts" style="margin:0">'+bts.join('')+'</div>';box.after(d);
}
['clientes','processos'].forEach(col=>{const a=FORMS[col].after;FORMS[col].after=function(v){if(a)a.call(this,v);mostrarDrive();};});

if(typeof itensSaude==='function'){
  const _s=itensSaude;
  itensSaude=function(){const it=_s();const d=(S.robo||{}).drive;if(!d)return it;
    const add=(st,t,x)=>it.push({st,t,d:x});
    if(d.erro)add('bad','Cópia no Google Drive',`Parou: ${d.erro}`);
    else if(d.ativo===false)add('warn','Cópia no Google Drive','Desligada.');
    else add(d.pendentes>0?'warn':'ok','Cópia no Google Drive',`Última rodada ${d.em?quandoFoi(d.em):''}: ${d.enviados||0} arquivo(s) copiado(s)${d.pendentes?`, faltam ${d.pendentes} (vão nas próximas)`:''}${d.erros?`, ${d.erros} com erro`:''}.`);
    return it;};
}
