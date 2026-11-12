'use strict';
/* =====================================================================
   Documentos em PDF no padrão visual law do escritório
   (cabeçalho com monograma, título com subtítulo dourado, quadros para
   as partes, seções numeradas, marcadores dourados, rodapé com endereço).
   Recebe o mesmo texto de sempre; o visual sai das marcas do próprio texto:
     1ª linha .................. título (ou endereçamento, se começar com EXCELENT…)
     OUTORGANTE: / CONTRATANTE:  quadro bege   ·  OUTORGADO(S): / CONTRATADO(S):  quadro claro
     PODERES: / CLÁUSULA 1ª – …  título de seção com traço dourado
     # Título  ou  DOS FATOS ...  seção numerada (I, II, III) nas petições
     • item  /  a) item  /  1. item   listas com marcador dourado
     Valor: R$ …                 destaque do valor (recibo)
     ______ (linha)              bloco de assinatura centralizado
   ===================================================================== */
const VL={ouro:[0.659,0.533,0.306],ouroClaro:[0.851,0.769,0.604],bege:[0.965,0.937,0.886],marrom:[0.541,0.416,0.227],
  tinta:[0.12,0.12,0.12],cinza:[0.42,0.42,0.42],linha:[0.82,0.79,0.73]};
const ROMANOS=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];

async function montarPDF(texto,meta){
  if(!window.PDFLib)throw new Error('O gerador de PDF não carregou. Recarregue a página.');
  meta=meta||{};
  const{PDFDocument,StandardFonts,rgb}=PDFLib;const C=a=>rgb(a[0],a[1],a[2]);
  const pdf=await PDFDocument.create();const cfg=S.config||{};
  const tx=String(texto).replace(/\r/g,'');
  pdf.setTitle(tx.trim().split('\n')[0].slice(0,120));pdf.setCreator(cfg.nome||NOME_PADRAO);pdf.setLanguage('pt-BR');
  const F={s:await pdf.embedFont(StandardFonts.TimesRoman),sb:await pdf.embedFont(StandardFonts.TimesRomanBold),
    r:await pdf.embedFont(StandardFonts.Helvetica),b:await pdf.embedFont(StandardFonts.HelveticaBold),i:await pdf.embedFont(StandardFonts.HelveticaOblique)};
  const MM=72/25.4,W=595.28,H=841.89,ML=20*MM,MR=20*MM,TOPO=34*MM,BASE=24*MM,LW=W-ML-MR;
  const TAM=10.2,LH=15.4,IND=10*MM;

  /* ---------- medidas e limpeza ---------- */
  const cw=new Map();
  const wid=(t,f,s)=>{let k=cw.get(f);if(!k){k={};cw.set(f,k);}let x=0;for(const ch of t){if(!(ch in k))k[ch]=f.widthOfTextAtSize(ch,1000);x+=k[ch];}return x*s/1000;};
  const cache={},TROCA={'→':'->','←':'<-','✓':'v','≤':'<=','≥':'>=',' ':' ',' ':' ','​':'','\t':'    ','–':'–','—':'—','“':'"','”':'"','‘':"'",'’':"'"};
  const limpa=t=>[...String(t)].map(ch=>{if(ch in cache)return cache[ch];let r=TROCA[ch];if(r===undefined)r=ch;
    try{F.r.widthOfTextAtSize(r,10);}catch(e){r=ch.normalize('NFD').replace(/[^\x20-\x7e¡-ÿ]/g,'')||'?';try{F.r.widthOfTextAtSize(r,10);}catch(_){r='?';}}return cache[ch]=r;}).join('');
  const espacado=(t,f,s,trk)=>wid(t,f,s)+Math.max(0,[...t].length-1)*trk;
  const desenhaEspacado=(pg,t,x,y,f,s,trk,cor)=>{for(const ch of t){pg.drawText(ch,{x,y,size:s,font:f,color:cor});x+=wid(ch,f,s)+trk;}};

  /* ---------- nome, monograma, número do processo ---------- */
  const nomeEsc=limpa(cfg.nome||NOME_PADRAO);
  const mNome=nomeEsc.match(/^(.*?)\s+(advocacia|advogados(?: associados)?|sociedade de advogados)$/i);
  const marca1=(mNome?mNome[1]:nomeEsc).toUpperCase(),marca2=mNome?mNome[2].toUpperCase():'';
  const monograma=marca1.split(/\s+/).filter(w=>w.length>2).slice(0,2).map(w=>w[0]).join('')||marca1.slice(0,2);
  const proc=limpa(meta.proc||((tx.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/)||[])[0]||''));
  const linhas0=tx.split('\n');
  const primeira=limpa((linhas0.find(l=>l.trim())||'').trim());
  const ehPeca=/^EXCELENT/i.test(primeira);
  const sub=limpa(meta.sub||(ehPeca?'':primeira.charAt(0)+primeira.slice(1).toLowerCase()));

  /* ---------- páginas ---------- */
  let page=null,y=0,pg=0;
  const novaPagina=()=>{page=pdf.addPage([W,H]);pg++;
    // monograma
    const q=9.5*MM,qx=ML,qy=H-14*MM-q;
    page.drawRectangle({x:qx,y:qy,width:q,height:q,borderColor:C(VL.ouroClaro),borderWidth:0.8,color:rgb(1,1,1)});
    page.drawRectangle({x:qx+1.6,y:qy+1.6,width:q-3.2,height:q-3.2,borderColor:C(VL.ouroClaro),borderWidth:0.35});
    const mw=wid(monograma,F.s,12.5);page.drawText(monograma,{x:qx+(q-mw)/2,y:qy+q/2-4.2,size:12.5,font:F.s,color:C(VL.marrom)});
    desenhaEspacado(page,marca1,qx+q+3.4*MM,qy+q-10.2,F.s,11.5,2.6,C(VL.tinta));
    if(marca2)desenhaEspacado(page,marca2,qx+q+3.4*MM,qy+3.2,F.b,5.6,1.9,C(VL.ouro));
    // processo e tipo do documento
    let ry=qy+q-8.5;
    if(proc){const t='Proc. '+proc;page.drawText(t,{x:W-MR-wid(t,F.b,7.6),y:ry,size:7.6,font:F.b,color:C(VL.tinta)});ry-=10;}
    if(sub){let t=sub;while(wid(t,F.r,7.2)>LW*0.45&&t.length>8)t=t.slice(0,-2);if(t!==sub)t=t.replace(/\s*\S*$/,'')+'…';page.drawText(t,{x:W-MR-wid(t,F.r,7.2),y:ry,size:7.2,font:F.r,color:C(VL.cinza)});}
    page.drawLine({start:{x:ML,y:qy-4.2*MM},end:{x:W-MR,y:qy-4.2*MM},thickness:0.9,color:C(VL.ouro)});
    y=TOPO;
  };
  const rodapes=()=>{const total=pdf.getPageCount();
    const nome=limpa(cfg.sociedade||cfg.nome||NOME_PADRAO),resto=limpa([cfg.endereco,cfg.telefone,cfg.email].filter(Boolean).join(' · '));
    pdf.getPages().forEach((p,i)=>{
      p.drawLine({start:{x:ML,y:BASE-7*MM},end:{x:W-MR,y:BASE-7*MM},thickness:0.5,color:C(VL.linha)});
      // nome em dourado + endereço em cinza, centralizados, quebrando se precisar
      const pal=[[nome,F.b,VL.ouro]].concat(resto?[[' · '+resto,F.r,VL.cinza]]:[]);
      const words=[];pal.forEach(([t,f,c])=>t.split(/(?<= )/).forEach(w=>words.push([w,f,c])));
      const maxL=LW-14*MM,ls=[[]];let lw=0;
      words.forEach(w=>{const ww=wid(w[0],w[1],6.6);if(lw+ww>maxL&&ls[ls.length-1].length){ls.push([]);lw=0;}ls[ls.length-1].push(w);lw+=ww;});
      ls.forEach((l,k)=>{const tot=l.reduce((s,w)=>s+wid(w[0],w[1],6.6),0);let x=(W-tot)/2;const yy=BASE-11*MM-k*8.5;
        l.forEach(([t,f,c])=>{p.drawText(t,{x,y:yy,size:6.6,font:f,color:C(c)});x+=wid(t,f,6.6);});});
      const n=String(i+1).padStart(2,'0');p.drawText(n,{x:W-MR-wid(n,F.s,8.5),y:BASE-11*MM,size:8.5,font:F.s,color:C(VL.ouro)});
      });
  };
  const resta=()=>H-BASE-y;
  const cabe=h=>{if(h>resta())novaPagina();};
  const Y=()=>H-y;

  /* ---------- texto com negrito automático em nomes em maiúsculas ---------- */
  const ehCaps=w=>{const l=w.replace(/[^A-Za-zÀ-ÿ]/g,'');return l.length>=2&&l===l.toUpperCase()&&/[A-ZÀ-Þ]/.test(l);};
  const tokens=(t,fN,fB)=>{const ps=t.split(/ +/).filter(Boolean);const out=ps.map(p=>({t:p,f:fN}));
    // sequência de 2+ palavras em maiúsculas com alguma de 4+ letras = nome (negrito)
    for(let i=0;i<ps.length;){if(!ehCaps(ps[i])){i++;continue;}let j=i;while(j<ps.length&&(ehCaps(ps[j])||/^(d[aeo]s?|e)$/i.test(ps[j])&&j+1<ps.length&&ehCaps(ps[j+1])))j++;
      const run=ps.slice(i,j);if(run.length>=2&&run.some(w=>w.replace(/[^A-Za-zÀ-ÿ]/g,'').length>=4))for(let k=i;k<j;k++)out[k].f=fB;i=Math.max(j,i+1);}
    return out;};
  const quebrarTok=(tk,s,larg,ind)=>{const ls=[];let cur=[],lw=0;const sp=wid(' ',F.r,s);
    tk.forEach(w=>{const ww=wid(w.t,w.f,s);const lim=larg-(ls.length?0:ind);if(cur.length&&lw+sp+ww>lim){ls.push(cur);cur=[];lw=0;}
      if(!cur.length&&ww>lim){let t=w.t;while(t){let k=t.length;while(k>1&&wid(t.slice(0,k),w.f,s)>lim)k--;ls.push([{t:t.slice(0,k),f:w.f}]);t=t.slice(k);}return;}
      cur.push(w);lw+=(cur.length>1?sp:0)+ww;});
    if(cur.length)ls.push(cur);return ls;};
  const desenhaLinha=(l,x0,larg,s,modo,cor)=>{const sp=wid(' ',F.r,s);const soma=l.reduce((a,w)=>a+wid(w.t,w.f,s),0);
    let x=x0,gap=sp;
    if(modo==='justificar'&&l.length>1){gap=(larg-soma)/(l.length-1);if(gap>sp*3.5)gap=sp;}
    else if(modo==='centro')x=x0+(larg-soma-sp*(l.length-1))/2;
    else if(modo==='direita')x=x0+larg-soma-sp*(l.length-1);
    l.forEach(w=>{page.drawText(w.t,{x,y:Y(),size:s,font:w.f,color:C(cor||VL.tinta)});x+=wid(w.t,w.f,s)+gap;});};
  const paragrafo=(t,{x=ML,larg=LW,s=TAM,ind=0,modo='justificar',fN=F.r,fB=F.b,cor,lh=LH,auto=true}={})=>{
    const ls=quebrarTok(auto?tokens(t,fN,fB):t.split(/ +/).filter(Boolean).map(p=>({t:p,f:fN})),s,larg,ind);
    ls.forEach((l,i)=>{cabe(lh);y+=lh*0.78;desenhaLinha(l,x+(i===0?ind:0),larg-(i===0?ind:0),s,modo==='justificar'&&i===ls.length-1?'esquerda':modo,cor);y+=lh*0.22;});};
  const alturaPar=(t,larg,s,ind,lh)=>quebrarTok(tokens(t,F.r,F.b),s,larg,ind||0).length*(lh||LH);

  /* ---------- peças visuais ---------- */
  const caixaRed=(x,yTop,w,h,r,fill,borda)=>{const p=`M ${r} 0 H ${w-r} Q ${w} 0 ${w} ${r} V ${h-r} Q ${w} ${h} ${w-r} ${h} H ${r} Q 0 ${h} 0 ${h-r} V ${r} Q 0 0 ${r} 0 Z`;
    page.drawSvgPath(p,{x,y:H-yTop,color:fill?C(fill):undefined,borderColor:borda?C(borda):undefined,borderWidth:borda?0.8:0});};
  const titulo=(t)=>{
    const words=t.split(/\s+/);let main=t,subt='';
    if(t.length>18&&words.length>=3){main=words[0];subt=words.slice(1).join(' ');}
    let s=21,trk=3.2;while(espacado(main,F.s,s,trk)>LW&&s>12){s-=1;trk=Math.max(1,trk-0.3);}
    if(espacado(main,F.s,s,trk)>LW){y+=4*MM;paragrafo(main,{s:14,modo:'centro',fN:F.sb,fB:F.sb,auto:false,lh:19});}
    else{cabe(16*MM);y+=s;const mw=espacado(main,F.s,s,trk);desenhaEspacado(page,main,(W-mw)/2,Y(),F.s,s,trk,C(VL.tinta));y+=6;}
    if(subt){const s2=7.6,t2=2;let st=subt.toUpperCase();
      const partes=[];let cur='';st.split(' ').forEach(w=>{const tent=cur?cur+' '+w:w;if(espacado(tent,F.b,s2,t2)>LW*0.9&&cur){partes.push(cur);cur=w;}else cur=tent;});if(cur)partes.push(cur);
      partes.forEach(p=>{y+=12;const pw=espacado(p,F.b,s2,t2);desenhaEspacado(page,p,(W-pw)/2,Y(),F.b,s2,t2,C(VL.ouro));});}
    y+=7*MM;};
  const tituloPeca=(t)=>{cabe(18*MM);y+=4*MM;let s=17,trk=1.2;while(espacado(t,F.s,s,trk)>LW&&s>11)s-=1;
    y+=s;const mw=espacado(t,F.s,s,trk);desenhaEspacado(page,t,(W-mw)/2,Y(),F.s,s,trk,C(VL.tinta));y+=8*MM;};
  const caixaParte=(rotulo,corpo,clara)=>{
    const pad=4.2*MM,larg=LW-2*pad,h=pad+10+alturaPar(corpo,larg,TAM,0,LH)+pad*0.8;
    if(h>H-BASE-TOPO-10){secao(rotulo);paragrafo(corpo);y+=3*MM;return;}
    cabe(h+2);const top=y;caixaRed(ML,top,LW,h,7,clara?[1,1,1]:VL.bege,clara?VL.marrom:VL.ouroClaro);
    y=top+pad+5;desenhaEspacado(page,rotulo.toUpperCase(),ML+pad,Y(),F.b,6.8,1.9,C(VL.ouro));y+=4;
    paragrafo(corpo,{x:ML+pad,larg});y=top+h+3.5*MM;};
  let nSec=0;
  const secao=(t)=>{cabe(12*MM+LH*2);y+=4*MM+8;
    page.drawRectangle({x:ML,y:Y()+2.2,width:3.2*MM,height:1.6,color:C(VL.ouro)});
    const ls=quebrarTok(t.toUpperCase().split(/ +/).map(p=>({t:p,f:F.b})),8.6,LW-5*MM,0);
    ls.forEach((l,i)=>{if(i)y+=11.5;desenhaLinha(l,ML+5*MM,LW-5*MM,8.6,'esquerda');});
    y+=3.2*MM;};
  const secaoNum=(t)=>{nSec++;t=t.replace(/^[IVXL]+\s*[-–.)]\s*/,'');cabe(14*MM+LH*2);y+=5*MM+11;const r=3.1*MM,cx=ML+r,cy=Y()+4;
    page.drawCircle({x:cx,y:cy,size:r,color:C(VL.ouro)});const rn=ROMANOS[nSec-1]||String(nSec);
    page.drawText(rn,{x:cx-wid(rn,F.sb,7.2)/2,y:cy-2.5,size:7.2,font:F.sb,color:rgb(1,1,1)});
    const ls=quebrarTok(t.split(/ +/).map(p=>({t:p,f:F.sb})),12,LW-r*2-3*MM,0);
    ls.forEach((l,i)=>{if(i)y+=15;desenhaLinha(l,ML+2*r+3*MM,LW-2*r-3*MM,12,'esquerda');});
    y+=2.2*MM;page.drawLine({start:{x:ML,y:Y()},end:{x:W-MR,y:Y()},thickness:0.5,color:C(VL.linha)});y+=4*MM;};
  const item=(marca,t,tipo)=>{const ind=7*MM;const ls=quebrarTok(tokens(t,F.r,F.b),TAM,LW-ind,0);
    ls.forEach((l,i)=>{cabe(LH);y+=LH*0.78;
      if(i===0){if(tipo==='ponto')page.drawCircle({x:ML+2.2*MM,y:Y()+3,size:1.9,color:C(VL.ouro)});
        else{const q=4.4*MM;caixaRed(ML,y-9.6,q,q,2.2,VL.ouro,null);const m=marca;page.drawText(m,{x:ML+(q-wid(m,F.b,7.2))/2,y:H-(y-0.8),size:7.2,font:F.b,color:rgb(1,1,1)});}}
      desenhaLinha(l,ML+ind,LW-ind,TAM,i===ls.length-1?'esquerda':'justificar');y+=LH*0.22;});
    y+=1.6*MM;};
  const destaqueValor=(rot,val)=>{const h=17*MM;cabe(h+4);const top=y;caixaRed(ML,top,LW,h,7,VL.bege,VL.ouroClaro);
    y=top+6*MM;desenhaEspacado(page,rot.toUpperCase(),ML+5*MM,Y(),F.b,6.8,1.9,C(VL.ouro));
    const s=19;page.drawText(val,{x:ML+5*MM,y:H-(top+h-4.4*MM),size:s,font:F.s,color:C(VL.tinta)});y=top+h+5*MM;};

  /* ---------- leitura do texto ---------- */
  novaPagina();
  const L=linhas0.map(l=>limpa(l.replace(/\s+$/,'')));
  let i=0;while(i<L.length&&!L[i].trim())i++;
  if(ehPeca){ // endereçamento: em negrito até a primeira linha em branco
    const end=[];while(i<L.length&&L[i].trim()){end.push(L[i].trim());i++;}
    paragrafo(end.join(' '),{modo:'esquerda',fN:F.b,fB:F.b,s:10.4,auto:false,lh:14.5});y+=6*MM;
  }else if(i<L.length){titulo(L[i].trim());i++;}
  let tituloPecaFeito=false,assin=false,assinPrim=false,blocoDados=ehPeca;
  const ehSecaoPeca=t=>/^(D[OA]S?|EM|NO|NA)\s/.test(t)&&t===t.toUpperCase()&&t.length<90&&!/[.;:]$/.test(t);
  for(;i<L.length;i++){
    const raw=L[i],t=raw.trim();
    if(!t){y+=LH*0.45;if(assin&&assinPrim){assin=false;assinPrim=false;}continue;}
    let m;
    if(/^_{5,}/.test(t)){ // linha de assinatura
      if(!assin){cabe(30*MM);}assin=true;assinPrim=true;y+=7*MM;const lw=72*MM;
      page.drawLine({start:{x:(W-lw)/2,y:Y()},end:{x:(W+lw)/2,y:Y()},thickness:0.7,color:C(VL.tinta)});y+=4.5*MM;continue;}
    if(assin){const prim=assinPrim===true;assinPrim='seg';paragrafo(t,{modo:'centro',fN:prim?F.b:F.r,fB:F.b,s:prim?9.2:8,cor:prim?VL.tinta:VL.cinza,auto:false,lh:12});continue;}
    if(/^#{1,3}\s/.test(t)){const h=t.replace(/^#{1,3}\s+/,'');ehPeca?secaoNum(h):secao(h);continue;}
    if((m=t.match(/^(OUTORGANTES?|CONTRATANTES?|REQUERENTES?|DECLARANTES?)\s*:\s*(.+)$/i))&&m[1]===m[1].toUpperCase()){caixaParte(m[1],m[2],false);continue;}
    if((m=t.match(/^(OUTORGADOS?(?:\(S\))?|CONTRATADOS?(?:\(S\))?)\s*:\s*(.+)$/i))&&m[1]===m[1].toUpperCase()){caixaParte(m[1].replace('(S)','S').replace(/SS$/,'S'),m[2],true);continue;}
    if((m=t.match(/^(PODERES(?: ESPECIAIS| GERAIS)?|OBJETO|FINALIDADE)\s*:\s*(.*)$/))){secao(m[1]==='PODERES'?'Poderes':m[1]);if(m[2])paragrafo(m[2],{ind:IND});continue;}
    if((m=t.match(/^(CL[ÁA]USULA\s+\S+)\s*[–—-]\s*(.+)$/i))){secao(m[1]+' · '+m[2]);continue;}
    if(/^CL[ÁA]USULA\s+\S+\s*$/i.test(t)||/^TESTEMUNHAS:?$/i.test(t)){secao(t.replace(/:$/,''));continue;}
    if((m=t.match(/^Valor:\s*(R\$\s*[\d.,]+)\s*$/i))){destaqueValor('Valor',m[1]);continue;}
    if(ehPeca&&ehSecaoPeca(t)){secaoNum(t.charAt(0)+t.slice(1).toLowerCase());continue;}
    if(ehPeca&&!tituloPecaFeito&&t===t.toUpperCase()&&/[A-Z]{4}/.test(t)&&t.length<70&&!/^(PROCESSO|AUTOS)/.test(t)){tituloPecaFeito=true;blocoDados=false;tituloPeca(t);
      let k=i+1;while(k<L.length&&!L[k].trim())k++;const nx=(L[k]||'').trim();
      if(nx&&nx===nx.toUpperCase()&&/[A-Z]{4}/.test(nx)&&nx.length<140&&!ehSecaoPeca(nx)){y-=6*MM;const s2=7.4,t2=1.8,ps=[];let cur='';nx.split(' ').forEach(w=>{const te=cur?cur+' '+w:w;if(espacado(te,F.b,s2,t2)>LW*0.92&&cur){ps.push(cur);cur=w;}else cur=te;});if(cur)ps.push(cur);
        ps.forEach(p=>{y+=11;const pw=espacado(p,F.b,s2,t2);desenhaEspacado(page,p,(W-pw)/2,Y(),F.b,s2,t2,C(VL.ouro));});y+=7*MM;i=k;}
      continue;}
    if((m=t.match(/^([•\-–])\s+(.+)$/))){item('',m[2],'ponto');continue;}
    if((m=t.match(/^([a-z])\)\s+(.+)$/))){item(m[1],m[2],'letra');continue;}
    if((m=t.match(/^(\d{1,2})[.)]\s+(.+)$/))&&!/_{4,}/.test(t)){item(m[1],m[2],'letra');continue;}
    if(/^[^,]{2,40},\s*\d{1,2}(º)? de [a-zç]+ de \d{4}\.?$/i.test(t)){ // data: fica na mesma página da assinatura
      if(L.slice(i+1,i+6).some(x=>/^_{5,}/.test(x.trim())))cabe(LH*2+42*MM);y+=2*MM;paragrafo(t,{modo:'direita',auto:false});y+=2*MM;continue;}
    if(ehPeca&&blocoDados&&/^(Processo|Autos)\s*n[ºo°.]/i.test(t)){paragrafo(t,{modo:'esquerda',fN:F.b,fB:F.b,s:9.6,auto:false,lh:14});continue;}
    if(ehPeca&&blocoDados&&/^(Processo|Autos|Classe|Requerente|Requerido|Autor|R[ée]u|Impetrante|Paciente|Exequente|Executado|Reclamante|Reclamad[oa])\b.{0,4}[:nº]/i.test(t)){
      const k=t.indexOf(':');if(k>0){cabe(LH);y+=LH*0.78;const a=t.slice(0,k+1)+' ',b=t.slice(k+1).trim();
        const fa=/^Processo/i.test(t)?F.b:F.r;page.drawText(a,{x:ML,y:Y(),size:9.4,font:F.b,color:C(VL.tinta)});page.drawText(b,{x:ML+wid(a,F.b,9.4),y:Y(),size:9.4,font:fa,color:C(VL.tinta)});y+=LH*0.22-2;continue;}}
    paragrafo(t,{ind:IND});y+=1.4*MM;
  }
  rodapes();
  return pdf.save();
}
