'use strict';
/* Reduz fotos antes de enviar: lado maior com até 2000 px, JPEG de boa qualidade.
   Uma foto de celular de 4 MB costuma cair para 300–600 KB e continua legível.
   PDFs e arquivos pequenos passam sem mudança. Usado no sistema e na página do cliente. */
async function prepararArquivo(file){
  if(!file||!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.type||'')||file.size<350*1024)return file;
  try{
    let bmp;
    try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'});}catch(e){bmp=await createImageBitmap(file);}
    const max=2000,k=Math.min(1,max/Math.max(bmp.width,bmp.height));
    const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(bmp.width*k));cv.height=Math.max(1,Math.round(bmp.height*k));
    const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(bmp,0,0,cv.width,cv.height);
    const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.82));
    if(!blob||blob.size>=file.size)return file;
    return new File([blob],String(file.name||'foto').replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
  }catch(e){return file;} // formato que o navegador não abre (ex.: HEIC fora do iPhone): envia como está
}
