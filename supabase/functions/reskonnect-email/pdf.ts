import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

export type LetterDetails={
 recipientName:string;property:string;reference:string;status:string;
 subject:string;body:string;kindLabel:string;issuedAt?:Date;
};
const WIDTH=595.28,HEIGHT=841.89;
const navy=rgb(7/255,19/255,38/255),blue=rgb(37/255,99/255,235/255),gold=rgb(245/255,179/255,47/255);
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
  const image=await fetch("https://www.reskonnect.org/icon-192.png",{signal:AbortSignal.timeout(2500)});
  if(image.ok && Number(image.headers.get("content-length")||0)<250000){
   const bytes=new Uint8Array(await image.arrayBuffer());
   if(bytes.length<250000)logo=await pdf.embedPng(bytes);
  }
 }catch{/* Do not make document generation depend on a public image host. */}
 const pages:any[]=[];
 const drawFooter=(page:any,index:number)=>{
  page.drawRectangle({x:0,y:0,width:WIDTH,height:92,color:navy});
  page.drawRectangle({x:0,y:90,width:WIDTH,height:3,color:gold});
  page.drawText("RESKONNECT  |  CONNECTING RESIDENTS. ADVANCING FUTURES.",{x:42,y:63,size:9,font:bold,color:rgb(1,1,1)});
  page.drawText("www.reskonnect.org  |  reskonnect@gmail.com  |  +27 63 732 3192",{x:42,y:45,size:8,font:regular,color:rgb(0.78,0.85,0.93)});
  page.drawText("Official case communication  |  Do not share ID documents by email",{x:42,y:25,size:7,font:regular,color:rgb(0.73,0.80,0.9)});
  page.drawText("Page "+index,{x:510,y:63,size:8,font:regular,color:rgb(0.85,0.9,1)});
 };
 const addPage=(first:boolean)=>{
  const page=pdf.addPage([WIDTH,HEIGHT]);pages.push(page);
  if(first){
   page.drawRectangle({x:0,y:HEIGHT-156,width:WIDTH,height:156,color:navy});
   page.drawRectangle({x:0,y:HEIGHT-7,width:WIDTH,height:7,color:gold});
   if(logo) {
    const d=logo.scale(1);
    const ratio=Math.min(74/d.width,74/d.height,1);
    page.drawImage(logo,{x:39,y:HEIGHT-119,width:d.width*ratio,height:d.height*ratio});
   }else{
    page.drawRectangle({x:42,y:HEIGHT-113,width:66,height:66,color:blue,borderRadius:0});
    page.drawText("RK",{x:55,y:HEIGHT-90,size:26,font:bold,color:rgb(1,1,1)});
   }
   page.drawText("RESKONNECT",{x:125,y:HEIGHT-74,size:26,font:bold,color:rgb(1,1,1)});
   page.drawText("LIVING  |  AI  |  OPPORTUNITY",{x:127,y:HEIGHT-96,size:10,font:regular,color:rgb(.78,.86,.97)});
   page.drawText("OFFICIAL BRANDED CORRESPONDENCE",{x:42,y:HEIGHT-140,size:9,font:bold,color:gold});
   page.drawRectangle({x:40,y:HEIGHT-233,width:WIDTH-80,height:65,color:light,borderColor:rgb(.88,.91,.95),borderWidth:1});
   page.drawText("REFERENCE",{x:52,y:HEIGHT-189,size:8,font:bold,color:muted});
   page.drawText(transliterate(details.reference).slice(0,48),{x:52,y:HEIGHT-212,size:12,font:bold,color:navy});
   page.drawText("RECORDED STATUS",{x:327,y:HEIGHT-189,size:8,font:bold,color:muted});
   page.drawText(transliterate(details.status).slice(0,28),{x:327,y:HEIGHT-212,size:11,font:bold,color:blue});
  }else{
   page.drawRectangle({x:0,y:HEIGHT-58,width:WIDTH,height:58,color:navy});
   page.drawText("RESKONNECT  |  CASE "+transliterate(details.reference).slice(0,30),{x:42,y:HEIGHT-39,size:12,font:bold,color:rgb(1,1,1)});
   page.drawRectangle({x:0,y:HEIGHT-61,width:WIDTH,height:3,color:gold});
  }
  return {page,y:first?HEIGHT-260:HEIGHT-95};
 };
 let {page,y}=addPage(true);
 const maxX=WIDTH-84;
 const ensure=(needed:number)=>{if(y-needed<115){const more=addPage(false);page=more.page;y=more.y;}};
 const drawLines=(text:string,size:number,font:any,color:any,after:number,lineHeight:number)=>{
  for(const paragraph of String(text).split(/\n/)){
   const lines=paragraph.trim()?wrap(paragraph,maxX,font,size):[""];
   ensure(lines.length*lineHeight+after);
   for(const line of lines){if(line)page.drawText(line,{x:42,y,size,font,color});y-=lineHeight;}
  }
  y-=after;
 };
 drawLines(details.subject,18,bold,navy,15,23);
 page.drawRectangle({x:42,y:y+3,width:41,height:4,color:gold});y-=24;
 const date=details.issuedAt||new Date();
 drawLines("ISSUED "+date.toISOString().slice(0,10)+"    |    "+transliterate(details.kindLabel).toUpperCase(),9,bold,blue,22,15);
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
