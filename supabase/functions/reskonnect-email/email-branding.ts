import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

export type EmailDocument = {
  kind: string; template: string; status: string; subject: string;
  body: string; reference: string; recipient: string; property: string;
  issuedAt: string; sender: string;
};

const NAVY = rgb(7 / 255, 19 / 255, 38 / 255);
const BLUE = rgb(37 / 255, 99 / 255, 235 / 255);
const GOLD = rgb(245 / 255, 179 / 255, 47 / 255);
const SLATE = rgb(75 / 255, 89 / 255, 105 / 255);
const PAPER = rgb(248 / 255, 250 / 255, 252 / 255);
const WHITE = rgb(1, 1, 1);
const safe = (value:unknown) => String(value ?? "").replace(/[\r\n<>]/g," ").trim().slice(0,200);
const ascii = (value:string) => value.replace(/[‘’]/g,"'").replace(/[“”]/g,'"')
  .replace(/[—–]/g,"-").replace(/…/g,"...").replace(/[^\x20-\x7e\n]/g," ");
const escapeHtml = (value:string) => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const brandName = "ResKonnect";
const brandWebsite = "https://www.reskonnect.org";
const brandEmail = "reskonnect@gmail.com";
const brandPhone = "+27 63 732 3192";
const brandImage = brandWebsite + "/icon-192.png";
let logoCache:Promise<Uint8Array|null>|null = null;

async function getLogo() {
  if (!logoCache) logoCache = (async () => {
    try {
      const response = await fetch(brandImage,{signal:AbortSignal.timeout(2500)});
      if (!response.ok || !(response.headers.get("content-type")||"").includes("image/png")) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length<100 || bytes.length>300000) return null;
      return bytes;
    } catch { return null; }
  })();
  return logoCache;
}
const documentTitle = (d:EmailDocument) => {
  if(d.kind==="reservation") return d.status==="confirmed"?"RESERVATION CONFIRMATION":"RESERVATION STATUS NOTICE";
  if(d.kind==="application") return d.template==="application_acknowledgement"?"APPLICATION ACKNOWLEDGEMENT":"APPLICATION STATUS & FEEDBACK";
  if(d.kind==="housing_lead") return "ACCOMMODATION ENQUIRY";
  return "SERVICE COMMUNICATION";
};
const statusLabel = (value:string) => safe(value).replace(/_/g," ").toUpperCase();

export function renderEmailHtml(d:EmailDocument) {
  const content = escapeHtml(d.body).replace(/\n/g,"<br />");
  const preview = escapeHtml(d.subject);
  const sender = escapeHtml(d.sender);
  const status = escapeHtml(statusLabel(d.status));
  const ref = escapeHtml(d.reference.slice(0,12).toUpperCase());
  return [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>',
    '<body style="margin:0;background:#edf2f7;font-family:Arial,Helvetica,sans-serif;color:#102037;">',
    '<div style="display:none;font-size:1px;line-height:1px;color:#edf2f7;max-height:0;max-width:0;opacity:0;overflow:hidden;">',preview,'</div>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf2f7;padding:26px 10px;"><tr><td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-radius:18px;overflow:hidden;background:#ffffff;box-shadow:0 12px 36px rgba(7,19,38,.10);">',
    '<tr><td style="background:#071326;padding:24px 30px;border-top:5px solid #f5b32f;">',
    '<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="vertical-align:middle;"><img alt="ResKonnect" src="',brandImage,'" width="52" height="52" style="display:block;border-radius:12px;background:#ffffff;"/></td>',
    '<td style="vertical-align:middle;padding-left:14px;color:#ffffff;"><div style="font-size:25px;font-weight:800;letter-spacing:-.6px;">ResKonnect</div><div style="color:#a4b5cb;font-size:10px;letter-spacing:2px;">LIVING · AI · OPPORTUNITY</div></td></tr></table></td></tr>',
    '<tr><td style="padding:28px 30px 14px;">',
    '<p style="margin:0 0 8px;color:#2563eb;font-size:11px;font-weight:800;letter-spacing:1.5px;">',escapeHtml(documentTitle(d)),'</p>',
    '<h1 style="margin:0 0 18px;font-size:23px;line-height:1.3;color:#071326;">',preview,'</h1>',
    '<div style="padding:13px 16px;background:#f4f7fc;border-left:4px solid #f5b32f;border-radius:8px;">',
    '<span style="font-size:11px;color:#64748b;display:inline-block;margin-right:12px;">REF ',ref,'</span>',
    '<span style="font-size:11px;font-weight:800;color:#0b2855;">STATUS: ',status,'</span></div>',
    '<div style="margin:25px 0;font-size:14px;line-height:1.85;color:#243247;overflow-wrap:anywhere;">',content,'</div>',
    '<table role="presentation"><tr><td style="border-radius:10px;background:#2563eb;"><a href="',brandWebsite,'/dashboard" style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;">Open my ResKonnect dashboard</a></td></tr></table>',
    '<p style="font-size:11px;line-height:1.65;color:#7b8797;margin-top:18px;">A ResKonnect-branded PDF copy of this communication may be attached. For official application or reservation status, always check your secure dashboard.</p>',
    '</td></tr><tr><td style="padding:20px 30px;background:#f8fafc;border-top:1px solid #e5e7eb;">',
    '<p style="font-size:13px;color:#071326;font-weight:700;margin:0 0 6px;">',sender,' · powered by ResKonnect</p>',
    '<p style="font-size:12px;color:#52647a;margin:0 0 9px;">Connecting Residents. Advancing Futures.</p>',
    '<p style="margin:0;font-size:11px;line-height:1.7;color:#52647a;"><a style="color:#2563eb;" href="',brandWebsite,'">www.reskonnect.org</a> · ',brandEmail,' · ',brandPhone,'</p>',
    '<p style="font-size:10px;color:#8290a3;line-height:1.5;margin:12px 0 0;">Transactional message concerning a record in ResKonnect. This message and its attachment are not proof of payment, accommodation funding, or a binding lease. Please use your dashboard for sensitive documents.</p>',
    '</td></tr></table></td></tr></table></body></html>'
  ].join("");
}

export async function generateEmailPdf(d:EmailDocument):Promise<{filename:string,bytes:Uint8Array}> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("ResKonnect | "+documentTitle(d));
  pdf.setAuthor("ResKonnect");
  pdf.setSubject(d.subject);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W=595.28, H=841.89, margin=48, usable=W-margin*2;
  let page=pdf.addPage([W,H]); let y=H-58, pageNo=1;
  const logo=await getLogo();
  const drawHeader=async(first:boolean) => {
    page.drawRectangle({x:0,y:H-(first?163:87),width:W,height:first?163:87,color:NAVY});
    page.drawRectangle({x:0,y:H-(first?163:87),width:W,height:5,color:GOLD});
    if(logo) {
      try {const graphic=await pdf.embedPng(logo);page.drawImage(graphic,{x:margin,y:H-92,width:44,height:44});}
      catch {page.drawRectangle({x:margin,y:H-92,width:44,height:44,color:BLUE});}
    } else {
      page.drawRectangle({x:margin,y:H-92,width:44,height:44,color:BLUE});
      page.drawText("RK",{x:margin+8,y:H-77,size:18,font:bold,color:WHITE});
    }
    page.drawText(brandName,{x:margin+57,y:H-66,font:bold,size:24,color:WHITE});
    page.drawText("LIVING  /  AI  /  OPPORTUNITY",{x:margin+57,y:H-84,font:regular,size:8,color:rgb(.69,.78,.89)});
    if(first){
      page.drawText("OFFICIAL RECORD COMMUNICATION",{x:margin,y:H-127,size:9,font:bold,color:GOLD});
      page.drawText(documentTitle(d),{x:margin,y:H-148,size:15,font:bold,color:WHITE});
    }
  };
  const footer = () => {
    page.drawLine({start:{x:margin,y:72},end:{x:W-margin,y:72},thickness:1,color:rgb(.85,.89,.93)});
    page.drawText("www.reskonnect.org  |  reskonnect@gmail.com  |  +27 63 732 3192",
      {x:margin,y:57,font:regular,size:8,color:SLATE});
    page.drawText("Reference "+ascii(d.reference.slice(0,12).toUpperCase())+"  |  Page "+pageNo,
      {x:margin,y:43,font:regular,size:7,color:SLATE});
  };
  await drawHeader(true);
  y=H-194;
  const info=(label:string,value:string) => {
    const normalized=ascii(safe(value,90));
    page.drawText(label.toUpperCase(),{x:margin,y,font:bold,size:8,color:SLATE});
    page.drawText(normalized||"Not recorded",{x:margin+134,y,font:bold,size:9,color:NAVY,maxWidth:usable-138});
    y-=25;
  };
  page.drawRectangle({x:margin-10,y:y-116,width:usable+20,height:128,color:PAPER});
  y-=12;
  info("Issued",d.issuedAt);
  info("Record reference",d.reference.slice(0,24).toUpperCase());
  info("Record type",d.kind.replace(/_/g," "));
  info("Recorded status",statusLabel(d.status));
  y-=20;
  page.drawText("COMMUNICATION DETAILS",{x:margin,y,size:10,font:bold,color:BLUE});
  y-=20;
  const paragraphs=ascii(d.body).replace(/\r/g,"").split("\n");
  const newPage=async()=>{footer();pageNo++;page=pdf.addPage([W,H]);await drawHeader(false);y=H-118;};
  for(const p of paragraphs){
    if(!p.trim()) { y-=10;continue; }
    let line="";
    const words=p.trim().split(/\s+/);
    for(const word0 of words){
      const word=word0.length>110?word0.slice(0,110):word0;
      const candidate=line?line+" "+word:word;
      if(regular.widthOfTextAtSize(candidate,10)>usable && line) {
        if(y<140) await newPage();
        page.drawText(line,{x:margin,y,font:regular,size:10,color:NAVY});y-=17;line=word;
      } else line=candidate;
    }
    if(line){if(y<140)await newPage();page.drawText(line,{x:margin,y,font:regular,size:10,color:NAVY});y-=17;}
    y-=4;
  }
  if(y<148) await newPage();
  y-=10;
  page.drawRectangle({x:margin,y:y-68,width:usable,height:78,color:PAPER});
  page.drawText("IMPORTANT",{x:margin+12,y:y-5,size:9,font:bold,color:BLUE});
  page.drawText("This is a record of communication, not a payment receipt or lease.",
    {x:margin+12,y:y-23,font:regular,size:9,color:NAVY});
  page.drawText("For verified status and next steps, sign in to your ResKonnect account.",
    {x:margin+12,y:y-37,font:regular,size:9,color:NAVY});
  page.drawText("Issued by "+ascii(safe(d.sender,55))+" through ResKonnect.",
    {x:margin+12,y:y-51,font:regular,size:9,color:SLATE});
  footer();
  const bytes=await pdf.save();
  const filename="ResKonnect-"+d.kind.replace(/[^a-z_]/gi,"")+"-"+d.reference.slice(0,8)+".pdf";
  return {filename,bytes};
}
