import type {CaseContext} from "./correspondence.ts";

/** WhatsApp Business App handoff only: no API sends and no delivery assumption. */
export function normalizeWhatsAppPhone(value:unknown):string|null{
  if(typeof value!=="string" || value.length>35)return null;
  const text=value.trim().replace(/[\s().-]/g,"");
  if(!text || /[^+0-9]/.test(text) || (text.match(/\+/g)||[]).length>1)return null;
  let digits=text;
  if(text.startsWith("+")) digits=text.slice(1);
  else if(text.startsWith("00"))digits=text.slice(2);
  else if(text.startsWith("0")&&text.length===10)digits="27"+text.slice(1);
  if(!/^[1-9]\d{7,14}$/.test(digits))return null;
  return digits;
}
export function whatsappMessage(context:CaseContext,subject:string,body:string):string{
  const heading="🏡 *RESKONNECT — OFFICIAL "+context.kind.replace(/_/g," ").toUpperCase()+" UPDATE*";
  const summary="*"+subject.replace(/[*_~]/g,"").slice(0,155)+"*";
  const text=body.replace(/Never email identity documents; upload securely on ResKonnect\./g,
    "For privacy, upload personal documents only through your secure ResKonnect account.");
  const appendix=context.residenceImageUrl
    ?"\n\n📷 *Residence photo:* "+context.residenceImageUrl
    :"";
  const full=heading+"\n\n"+summary+"\n\n"+text+appendix+
    "\n\n🔗 www.reskonnect.org\n_This is a manual service message. Replies are handled by your ResKonnect representative._";
  if(full.length<=3000)return full;
  return full.slice(0,2750).replace(/\s+\S*$/,"")+
    "\n\nFor full details, please sign in to ResKonnect. www.reskonnect.org";
}
export function whatsappClickToChat(phone:string,message:string):string{
  const normalized=normalizeWhatsAppPhone(phone);
  if(!normalized)throw Error("Valid WhatsApp phone number not recorded");
  return "https://wa.me/"+normalized+"?text="+encodeURIComponent(message);
}
