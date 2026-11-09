'use strict';
/* =====================================================================
   Editor de texto com formatação e corretor ortográfico (do navegador)
   ===================================================================== */
(function(){
  const css=`
  .ed{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);display:flex;flex-direction:column;min-width:0}
  .ed-bar{display:flex;flex-wrap:wrap;gap:2px;padding:6px;border-bottom:1px solid var(--line);background:var(--sunk);border-radius:var(--r) var(--r) 0 0;position:sticky;top:0;z-index:2}
  .ed-bar button,.ed-bar select{border:1px solid transparent;background:transparent;border-radius:6px;min-width:32px;height:32px;padding:0 7px;font-size:14px;color:var(--ink)}
  .ed-bar button:hover{border-color:var(--line);background:var(--surface)}
  .ed-bar .sep{width:1px;background:var(--line);margin:4px 3px}
  .ed-area{min-height:240px;padding:16px 18px;outline:none;font-family:var(--f-display);font-size:17px;line-height:1.7;overflow-wrap:anywhere}
  .ed-area:empty::before{content:attr(data-ph);color:var(--muted)}
  .ed-area h2{font-size:21px;margin:.6em 0 .3em}.ed-area h3{font-size:18px;margin:.6em 0 .3em}
  .ed-area p{margin:0 0 .7em}.ed-area blockquote{margin:.6em 0;padding:.2em 0 .2em 14px;border-left:3px solid var(--accent);color:var(--muted)}
  .ed-area mark{background:#FDE68A;color:#1F1A05;padding:0 2px;border-radius:2px}
  .ed-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)}
  .ed.cheia{position:fixed;inset:0;z-index:70;border-radius:0;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
  .ed.cheia .ed-area{flex:1;overflow-y:auto;max-width:780px;width:100%;margin:0 auto;font-size:19px}
  .ed.cheia .ed-bar{border-radius:0}
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .ed-area mark{background:#8A6D12;color:#FFF8E1}}
  :root[data-theme="dark"] .ed-area mark{background:#8A6D12;color:#FFF8E1}`;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
})();

const ED_TAGS=new Set(['B','STRONG','I','EM','U','P','BR','H2','H3','UL','OL','LI','BLOCKQUOTE','MARK','DIV','S']);
function limparHTML(html){
  const doc=new DOMParser().parseFromString('<div>'+String(html||'')+'</div>','text/html');
  const walk=n=>{[...n.childNodes].forEach(c=>{
    if(c.nodeType===3)return;
    if(c.nodeType!==1){c.remove();return;}
    walk(c);
    if(!ED_TAGS.has(c.tagName)){c.replaceWith(...c.childNodes);return;}
    [...c.attributes].forEach(a=>c.removeAttribute(a.name));
  });};
  const root=doc.body.firstChild;walk(root);return root.innerHTML;
}
const htmlParaTexto=h=>{const d=document.createElement('div');d.innerHTML=limparHTML(h).replace(/<\/(p|div|h2|h3|li|blockquote)>/g,'</$1>\n').replace(/<br\s*\/?>/g,'\n');return d.textContent.replace(/\n{3,}/g,'\n\n').trim();};
const contarPalavras=t=>(String(t).trim().match(/\S+/g)||[]).length;

/* cria um editor dentro de "alvo". opcoes: {html, ph, onChange(html), titulo} */
function criarEditor(alvo,op){
  op=op||{};
  alvo.innerHTML=`<div class="ed">
    <div class="ed-bar" role="toolbar" aria-label="Formatação">
      <button type="button" data-c="bold" title="Negrito"><b>N</b></button>
      <button type="button" data-c="italic" title="Itálico"><i>I</i></button>
      <button type="button" data-c="underline" title="Sublinhado"><u>S</u></button>
      <button type="button" data-c="mark" title="Destacar">Destacar</button>
      <span class="sep"></span>
      <button type="button" data-c="h2" title="Título">T1</button>
      <button type="button" data-c="h3" title="Subtítulo">T2</button>
      <button type="button" data-c="p" title="Texto normal">¶</button>
      <button type="button" data-c="insertUnorderedList" title="Lista">• Lista</button>
      <button type="button" data-c="insertOrderedList" title="Lista numerada">1. Lista</button>
      <button type="button" data-c="blockquote" title="Citação">“ ”</button>
      <span class="sep"></span>
      <button type="button" data-c="undo" title="Desfazer">↶</button>
      <button type="button" data-c="redo" title="Refazer">↷</button>
      <button type="button" data-c="removeFormat" title="Limpar formatação">Limpar</button>
      <span class="sep"></span>
      <button type="button" data-c="cheia" title="Tela cheia">Tela cheia</button>
    </div>
    <div class="ed-area" contenteditable="true" spellcheck="true" lang="pt-BR" data-ph="${esc(op.ph||'Escreva aqui…')}"></div>
    <div class="ed-foot"><span class="ed-cont">0 palavras</span><span class="ed-st"></span><span style="display:flex;gap:6px"><button class="btn sm" type="button" data-c="copiar">Copiar texto</button><button class="btn sm" type="button" data-c="word">Baixar para Word</button></span></div>
  </div>`;
  const ed=alvo.querySelector('.ed'),area=alvo.querySelector('.ed-area'),cont=alvo.querySelector('.ed-cont'),stEl=alvo.querySelector('.ed-st');
  area.innerHTML=limparHTML(op.html||'');
  try{document.execCommand('defaultParagraphSeparator',false,'p');}catch(e){}
  let t=null;
  const conta=()=>{const n=contarPalavras(area.innerText);cont.textContent=`${n} ${n===1?'palavra':'palavras'} · cerca de ${Math.max(1,Math.round(n/130))} min falando`;};
  const mudou=()=>{conta();stEl.textContent='Alterações não salvas';clearTimeout(t);t=setTimeout(()=>{if(op.onChange)Promise.resolve(op.onChange(limparHTML(area.innerHTML))).then(ok=>{if(ok!==false)stEl.textContent='Salvo';}).catch(()=>{stEl.textContent='Não salvou';});},1800);};
  area.addEventListener('input',mudou);
  area.addEventListener('paste',e=>{e.preventDefault();const h=e.clipboardData.getData('text/html');const tx=e.clipboardData.getData('text/plain');
    if(h)document.execCommand('insertHTML',false,limparHTML(h));else document.execCommand('insertText',false,tx);});
  ed.querySelector('.ed-bar').addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault();});
  ed.addEventListener('click',e=>{
    const b=e.target.closest('[data-c]');if(!b)return;const c=b.dataset.c;
    if(c==='cheia'){ed.classList.toggle('cheia');b.textContent=ed.classList.contains('cheia')?'Sair da tela cheia':'Tela cheia';area.focus();return;}
    if(c==='copiar'){copiar(area.innerText);return;}
    if(c==='word'){baixarWord(op.titulo||'texto',area.innerHTML);return;}
    area.focus();
    if(['h2','h3','p','blockquote'].includes(c))document.execCommand('formatBlock',false,c);
    else if(c==='mark'){const sel=getSelection();if(sel&&!sel.isCollapsed){const txt=sel.toString();document.execCommand('insertHTML',false,'<mark>'+esc(txt)+'</mark>');}else toast('Selecione o trecho que quer destacar.');}
    else document.execCommand(c,false,null);
    mudou();
  });
  conta();
  return{html:()=>limparHTML(area.innerHTML),texto:()=>area.innerText,salvarAgora:()=>{clearTimeout(t);if(op.onChange)return op.onChange(limparHTML(area.innerHTML));},foco:()=>area.focus()};
}
function baixarWord(titulo,html){
  const doc=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
  <style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5}h2{font-size:14pt}h3{font-size:12.5pt}blockquote{margin-left:4cm;font-size:11pt}mark{background:yellow}</style></head><body>${limparHTML(html)}</body></html>`;
  const blob=new Blob(['﻿'+doc],{type:'application/msword'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=String(titulo).toLowerCase().normalize('NFD').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').slice(0,50)+'.doc';
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}
