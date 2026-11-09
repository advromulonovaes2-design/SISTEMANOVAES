/* Cálculo de prazos processuais — CPC/CLT (dias úteis) e CPP (dias corridos) */
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());
const parseD=s=>{const[y,m,d]=String(s).split('-').map(Number);return new Date(Date.UTC(y,m-1,d));};
const addD=(d,n)=>{const x=new Date(d.getTime());x.setUTCDate(x.getUTCDate()+n);return x;};
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(Date.UTC(y,mo-1,da));}
const NAC_FIXOS=new Set(['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25']);
const FED_FIXOS=new Set(['08-11','11-01','12-08']); // Lei 5.010/66, art. 62
const _mov={};
function moveis(y){if(_mov[y])return _mov[y];const p=easter(y);const nac=new Set([ymd(addD(p,-48)),ymd(addD(p,-47)),ymd(addD(p,-2)),ymd(addD(p,60))]);const fed=new Set([ymd(addD(p,-4)),ymd(addD(p,-3))]);return _mov[y]={nac,fed};}
let EXTRA={exatos:new Set(),anuais:new Set()};
function setFeriadosLocais(txt){const ex=new Set(),an=new Set();String(txt||'').split(/\n|;/).forEach(l=>{const m=l.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);if(!m)return;const md=pad(+m[2])+'-'+pad(+m[1]);if(m[3])ex.add(m[3]+'-'+md);else an.add(md);});EXTRA={exatos:ex,anuais:an};}
function ehFeriado(d,fed){const s=ymd(d),md=s.slice(5),mv=moveis(d.getUTCFullYear());if(NAC_FIXOS.has(md)||mv.nac.has(s))return true;if(fed&&(FED_FIXOS.has(md)||mv.fed.has(s)))return true;return EXTRA.exatos.has(s)||EXTRA.anuais.has(md);}
// recesso forense (Res. CNJ 244/2016): 20/12 a 06/01 sem expediente
const emRecesso=d=>{const m=d.getUTCMonth()+1,x=d.getUTCDate();return (m===12&&x>=20)||(m===1&&x<=6);};
// suspensão de prazos 20/12 a 20/01 (CPC art. 220; CPP art. 798-A)
const emSuspensao=d=>{const m=d.getUTCMonth()+1,x=d.getUTCDate();return (m===12&&x>=20)||(m===1&&x<=20);};
// suspensões cadastradas nos Ajustes: [{tribunal:'TJPA' ou 'Todos', inicio:'AAAA-MM-DD', fim:'AAAA-MM-DD', motivo}]
let SUSPENSOES=[];
function setSuspensoes(l){SUSPENSOES=(Array.isArray(l)?l:[]).filter(s=>s&&s.inicio&&s.fim);}
function suspensao(d,trib){const s=ymd(d),t=String(trib||'').toUpperCase().replace(/\s+/g,'');
  return SUSPENSOES.find(x=>s>=x.inicio&&s<=x.fim&&(!x.tribunal||/^todos$/i.test(x.tribunal)||trib==='*'||(t&&t.includes(String(x.tribunal).toUpperCase().replace(/\s+/g,'')))))||null;}
function diaUtil(d,fed){const w=d.getUTCDay();return w!==0&&w!==6&&!emRecesso(d)&&!ehFeriado(d,fed);}
function calcPrazo(p){
  const dias=Number(p.dias);
  if(!p.dataInicio||!/^\d{4}-\d{2}-\d{2}$/.test(p.dataInicio)||!(dias>0)||dias>3650)return null;
  const fed=p.justica==='federal'||p.justica==='trabalho',corr=p.contagem==='corridos',preso=corr&&!!p.reuPreso;
  const trib=p.tribunal||'';const susp=d=>(!preso&&emSuspensao(d))||!!suspensao(d,trib);
  const diaUtilP=(d,f)=>diaUtil(d,f)&&!suspensao(d,trib);
  let t=parseD(p.dataInicio),pub=null,g=0;
  if(p.gatilho==='djen'){let d=addD(t,1);while(!diaUtilP(d,fed)&&g++<800)d=addD(d,1);pub=d;t=d;}
  let d=t,n=0,inicio=null,prorrog=false;
  if(!corr){
    while(n<dias&&g++<8000){d=addD(d,1);if(diaUtilP(d,fed)&&!susp(d)){n++;if(!inicio)inicio=d;}}
  }else{
    d=addD(d,1);while(!(diaUtilP(d,fed)&&!susp(d))&&g++<800)d=addD(d,1);
    inicio=d;n=1;
    while(n<dias&&g++<8000){d=addD(d,1);if(!susp(d))n++;}
    while(!diaUtilP(d,fed)&&g++<800){d=addD(d,1);prorrog=true;}
  }
  return{venc:ymd(d),pub:pub?ymd(pub):null,inicio:ymd(inicio),prorrog};
}
