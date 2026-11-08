import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {readPublishedPhotoBytes} from "./residence-media.ts";

export type LetterDetails={
 recipientName:string;property:string;reference:string;status:string;
 subject:string;body:string;kindLabel:string;issuedAt?:Date;
 residenceImageUrl?:string|null;
};
const WIDTH=595.28,HEIGHT=841.89;
const navy=rgb(7/255,19/255,38/255),blue=rgb(37/255,99/255,235/255),gold=rgb(217/255,171/255,82/255);
const light=rgb(242/255,246/255,251/255),ink=rgb(30/255,41/255,59/255),muted=rgb(82/255,102/255,125/255);
const transliterate=(text:string)=>String(text||"").normalize("NFKD")
 .replace(/[\u0300-\u036f]/g,"").replace(/[–—]/g,"-").replace(/[‘’]/g,"'").replace(/[“”]/g,'"')
 .replace(/•/g,"-").replace(/[^\x20-\x7e\n]/g," ").replace(/\r/g,"").trim();
const base64=(bytes:Uint8Array)=>{
 let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(binary);
};
const wrap=(text:string,width:number,font:any,size:number):string[]=>{
 const words=transliterate(text).split(/\s+/).filter(Boolean),lines:string[]=[];let current="";
 for(const word of words){
  const candidate=current?current+" "+word:word;
  if(font.widthOfTextAtSize(candidate,size)<=width){current=candidate;continue;}
  if(current)lines.push(current);
  current="";
  let split="";
  for(const ch of word){
   if(font.widthOfTextAtSize(split+ch,size)>width && split){lines.push(split);split="";}
   split+=ch;
  }
  current=split;
 }
 if(current)lines.push(current);
 return lines.length?lines:[""];
};

export async function createBrandedPdf(details:LetterDetails):Promise<Uint8Array>{
 const pdf=await PDFDocument.create();
 pdf.setAuthor("ResKonnect Communications");
 pdf.setTitle(transliterate(details.subject).slice(0,120));
 pdf.setSubject("Official case communication - "+transliterate(details.reference));
 pdf.setCreator("ResKonnect PDF Correspondence");
 const regular=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 let logo:any=null;
 // Official public app icon is a static, trusted source. The document still
 // renders with a complete vector wordmark when the network or image fails.
 try{
  const image=await fetch("https://www.reskonnect.org/favicon-transparent.png",{signal:AbortSignal.timeout(2500)});
  if(image.ok && Number(image.headers.get("content-length")||0)<250000){
   const bytes=new Uint8Array(await image.arrayBuffer());
   if(bytes.length<250000)logo=await pdf.embedPng(bytes);
  }
 }catch{/* Do not make document generation depend on a public image host. */}
 const realPhoto=await readPublishedPhotoBytes(details.residenceImageUrl);
 let photo:any=null;
 try{if(realPhoto)photo=realPhoto.mime==="image/png"?await pdf.embedPng(realPhoto.bytes):await pdf.embedJpg(realPhoto.bytes);}catch{/* Optional photo never prevents an official letter. */}
 const pages:any[]=[];
 const drawFooter=(page:any,index:number)=>{
  page.drawRectangle({x:0,y:0,width:WIDTH,height:89,color:rgb(1,1,1)});
  page.drawRectangle({x:0,y:88,width:WIDTH,height:2,color:gold});
  page.drawText("RESKONNECT  /  CONNECTING RESIDENTS. ADVANCING FUTURES.",{x:42,y:60,size:9,font:bold,color:navy});
  page.drawText("www.reskonnect.org  |  reskonnect@gmail.com  |  +27 63 732 3192",{x:42,y:43,size:8,font:regular,color:muted});
  page.drawText("Official case update. Upload private documents only through your secure account.",{x:42,y:23,size:7,font:regular,color:muted});
  page.drawText(String(index).padStart(2,"0"),{x:535,y:60,size:9,font:regular,color:navy});
 };
 const addPage=(first:boolean)=>{
  const page=pdf.addPage([WIDTH,HEIGHT]);pages.push(page);
  let contentY=HEIGHT-259;
  if(first){
   // White, vector-sharp stationery with a restrained navy + gold identity.
   page.drawRectangle({x:0,y:HEIGHT-6,width:WIDTH,height:6,color:gold});
   if(logo){
    const d=logo.scale(1);
    const scale=Math.min(58/d.width,58/d.height,1);
    page.drawImage(logo,{x:42+(58-d.width*scale)/2,y:HEIGHT-94+(58-d.height*scale)/2,width:d.width*scale,height:d.height*scale});
   }else{
    page.drawRectangle({x:43,y:HEIGHT-88,width:46,height:46,color:navy});
    page.drawText("RK",{x:52,y:HEIGHT-73,size:19,font:bold,color:rgb(1,1,1)});
   }
   page.drawText("RESKONNECT",{x:111,y:HEIGHT-61,size:24,font:bold,color:navy});
   page.drawText("STUDENT LIVING  /  OPPORTUNITY",{x:113,y:HEIGHT-82,size:9,font:regular,color:muted});
   page.drawLine({start:{x:42,y:HEIGHT-112},end:{x:WIDTH-42,y:HEIGHT-112},thickness:0.8,color:rgb(.88,.90,.93)});
   page.drawText("PERSONALISED CORRESPONDENCE",{x:42,y:HEIGHT-137,size:9,font:bold,color:rgb(.60,.42,.17)});
   page.drawRectangle({x:42,y:HEIGHT-231,width:WIDTH-84,height:72,color:light,borderColor:rgb(.90,.92,.95),borderWidth:0.7});
   page.drawText("REFERENCE",{x:57,y:HEIGHT-184,size:8,font:bold,color:muted});
   page.drawText(transliterate(details.reference).slice(0,48),{x:57,y:HEIGHT-209,size:12,font:bold,color:navy});
   page.drawText("RECORDED STATUS",{x:325,y:HEIGHT-184,size:8,font:bold,color:muted});
   page.drawText(transliterate(details.status).slice(0,28),{x:325,y:HEIGHT-209,size:11,font:bold,color:navy});
   if(photo){
    const maxW=WIDTH-84,maxH=194;
    const scale=Math.min(maxW/photo.width,maxH/photo.height);
    const imageW=photo.width*scale,imageH=photo.height*scale;
    const top=HEIGHT-254,bottom=top-imageH;
    page.drawImage(photo,{x:42+(maxW-imageW)/2,y:bottom,width:imageW,height:imageH});
    page.drawText("ACTUAL RESIDENCE LISTING PHOTO  |  "+transliterate(details.property).slice(0,42),{x:42,y:bottom-17,size:8,font:regular,color:muted});
    contentY=bottom-44;
   }
  }else{
   page.drawRectangle({x:0,y:HEIGHT-5,width:WIDTH,height:5,color:gold});
   page.drawText("RESKONNECT",{x:42,y:HEIGHT-42,size:13,font:bold,color:navy});
   page.drawText("CASE "+transliterate(details.reference).slice(0,30),{x:345,y:HEIGHT-42,size:9,font:regular,color:muted});
   page.drawLine({start:{x:42,y:HEIGHT-56},end:{x:WIDTH-42,y:HEIGHT-56},thickness:0.8,color:rgb(.88,.90,.93)});
  }
  return {page,y:first?contentY:HEIGHT-86};
 };
 let {page,y}=addPage(true);
 const maxX=WIDTH-84;
 const ensure=(needed:number)=>{if(y-needed<115){const more=addPage(false);page=more.page;y=more.y;}};
 const drawLines=(text:string,size:number,font:any,color:any,after:number,lineHeight:number)=>{
  for(const paragraph of String(text).split(/\n/)){
   const lines=paragraph.trim()?wrap(paragraph,maxX,font,size):[""];
   for(const line of lines){ensure(lineHeight+after);if(line)page.drawText(line,{x:42,y,size,font,color});y-=lineHeight;}
  }
  y-=after;
 };
 drawLines(details.subject,18,bold,navy,15,23);
 page.drawRectangle({x:42,y:y+3,width:41,height:4,color:gold});y-=24;
 const date=details.issuedAt||new Date();
 drawLines("ISSUED "+date.toISOString().slice(0,10)+"    |    "+transliterate(details.kindLabel).toUpperCase(),9,bold,muted,22,15);
 drawLines(details.body,11,regular,ink,12,17);
 ensure(55);
 page.drawText("This letter reflects the recorded ResKonnect case status when issued.",{x:42,y:y-5,size:9,font:regular,color:muted});
 y-=23;
 page.drawText("Please sign in to your secure account for current information.",{x:42,y:y-5,size:9,font:regular,color:muted});
 pages.forEach((pg,index)=>drawFooter(pg,index+1));
 return new Uint8Array(await pdf.save({useObjectStreams:true}));
}
const encodeBase64=(text:string)=>base64(new TextEncoder().encode(text));
const wrappedBase64=(base:string)=>base.match(/.{1,76}/g)?.join("\r\n")||"";
export function createGmailMime(to:string,subject:string,textBody:string,htmlBody:string,pdf?:Uint8Array,filename?:string):string{
 const boundary="rk_alt_"+crypto.randomUUID().replace(/-/g,"");
 const mixed="rk_mixed_"+crypto.randomUUID().replace(/-/g,"");
 const top=pdf?mixed:boundary;
 const headers=[
  "To: "+to.replace(/[\r\n]/g,""),
  "Subject: =?UTF-8?B?"+encodeBase64(subject.replace(/[\r\n]/g," "))+"?=",
  "MIME-Version: 1.0",
  "Content-Type: multipart/"+(pdf?"mixed":"alternative")+"; boundary=\""+top+"\""
 ];
 const plain=["Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",wrappedBase64(encodeBase64(textBody))].join("\r\n");
 const html=["Content-Type: text/html; charset=UTF-8","Content-Transfer-Encoding: base64","",wrappedBase64(encodeBase64(htmlBody))].join("\r\n");
 const alternative=["--"+boundary,plain,"--"+boundary,html,"--"+boundary+"--"].join("\r\n");
 let message:string;
 if(pdf){
  const attachment=[
   "Content-Type: application/pdf; name=\""+(filename||"ResKonnect-Letter.pdf")+"\"",
   "Content-Transfer-Encoding: base64",
   "Content-Disposition: attachment; filename=\""+(filename||"ResKonnect-Letter.pdf")+"\"",
   "",wrappedBase64(base64(pdf))
  ].join("\r\n");
  message=headers.join("\r\n")+"\r\n\r\n"+
   "--"+mixed+"\r\nContent-Type: multipart/alternative; boundary=\""+boundary+"\"\r\n\r\n"+
   alternative+"\r\n--"+mixed+"\r\n"+attachment+"\r\n--"+mixed+"--\r\n";
 }else message=headers.join("\r\n")+"\r\n\r\n"+alternative+"\r\n";
 const base=encodeBase64(message);
 return base.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
export function pdfAsBase64(pdf:Uint8Array):string{return base64(pdf);}
