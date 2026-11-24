/**
 * ResKonnect editorial style.
 *
 * Visible copy should read like a considered sentence, not a chain of
 * decorative dashes. This module is intentionally display only. It never
 * rewrites Supabase records, identifiers, signed values or link destinations.
 *
 * Proper place names, negative numbers, dates, arithmetic, user-entered
 * documents and machine identifiers retain their original spelling.
 */
const descriptiveCompounds: readonly [RegExp,string][] = [
  [/\bstudent[\u2010-\u2015-]centred\b/gi,"student centred"],
  [/\bstudent[\u2010-\u2015-]centered\b/gi,"student centred"],
  [/\bstudent[\u2010-\u2015-]first\b/gi,"student focused"],
  [/\bstudent[\u2010-\u2015-]led\b/gi,"student led"],
  [/\bstudent[\u2010-\u2015-]facing\b/gi,"student facing"],
  [/\bstudent[\u2010-\u2015-]life\b/gi,"student life"],
  [/\bstudent[\u2010-\u2015-]housing\b/gi,"student housing"],
  [/\bsingle[\u2010-\u2015-]room\b/gi,"single room"],
  [/\breal[\u2010-\u2015-]time\b/gi,"live"],
  [/\blong[\u2010-\u2015-]term\b/gi,"lasting"],
  [/\bshort[\u2010-\u2015-]term\b/gi,"short term"],
  [/\bfirst[\u2010-\u2015-]time\b/gi,"first time"],
  [/\bfull[\u2010-\u2015-]time\b/gi,"full time"],
  [/\bpart[\u2010-\u2015-]time\b/gi,"part time"],
  [/\bself[\u2010-\u2015-]service\b/gi,"self service"],
  [/\buser[\u2010-\u2015-]friendly\b/gi,"easy to use"],
  [/\bAI[\u2010-\u2015-]powered\b/g,"AI supported"],
  [/\bAI[\u2010-\u2015-]enabled\b/g,"supported by AI"],
  [/\bdata[\u2010-\u2015-]driven\b/gi,"guided by data"],
  [/\bend[\u2010-\u2015-]to[\u2010-\u2015-]end\b/gi,"integrated"],
  [/\bstep[\u2010-\u2015-]by[\u2010-\u2015-]step\b/gi,"step by step"],
  [/\bup[\u2010-\u2015-]to[\u2010-\u2015-]date\b/gi,"current"],
  [/\bhigh[\u2010-\u2015-]quality\b/gi,"high quality"],
  [/\bon[\u2010-\u2015-]campus\b/gi,"on campus"],
  [/\boff[\u2010-\u2015-]campus\b/gi,"off campus"],
  [/\bpre[\u2010-\u2015-]approved\b/gi,"approved in advance"],
  [/\bno[\u2010-\u2015-]top[\u2010-\u2015-]up\b/gi,"no additional payment"],
  [/\bthird[\u2010-\u2015-]party\b/gi,"external"],
  [/\bnon[\u2010-\u2015-]profit\b/gi,"nonprofit"],
  [/\bbuilt[\u2010-\u2015-]in\b/gi,"included"],
  [/\bwell[\u2010-\u2015-]being\b/gi,"wellbeing"],
];

/** Only conversational and editorial punctuation, never URL or code grammar. */
export function polishEditorialCopy(value:string):string{
 if(!/[\u2010-\u2015]|\s-\s/.test(value))return value;
 // Leave URLs, email addresses and machine identifiers entirely untouched.
 if(/^\s*(?:https?:\/\/|mailto:|tel:|\S+@\S+|[a-f\d]{8}-[a-f\d-]{12,})/i.test(value))return value;
 let result=value;
 for(const [pattern,replacement] of descriptiveCompounds)result=result.replace(pattern,replacement);
 // Written ranges read naturally rather than as symbolic intervals.
 result=result.replace(/(\b\d{4})\s*[\u2012\u2013]\s*(\d{4}\b)/g,"$1 to $2");
 result=result.replace(/(\bR\s*\d[\d ,]*)\s*[\u2012\u2013]\s*(R\s*\d[\d ,]*)/g,"$1 to $2");
 // Remove editorial em/en dashes and spaced hyphen separators. Use a pause
 // rather than mechanical punctuation that feels like generated marketing.
 result=result.replace(/[ \t]*[\u2013\u2014][ \t]*/g,", ");
 result=result.replace(/([^\s])\s+-\s+([^\s])/g,"$1, $2");
 result=result.replace(/,\s*,/g,",").replace(/ {2,}/g," ");
 return result;
}

const skipSelector=[
 "pre","code","kbd","samp","script","style","noscript","textarea",
 "svg","math","[contenteditable]","[data-editorial-raw]",
 ".monaco-editor",".cm-editor",".gm-style","gmp-map-3d",
 "[data-testid='landing-real-3d-map-host']",
].join(",");
const copyAttrs=["aria-label","title","placeholder","alt"] as const;

function isSkipped(element:Element):boolean{
 return Boolean(element.closest(skipSelector));
}

/** Apply consistent, understated editorial punctuation to live application UI.
 * This handles async notices, CMS copy, modals, toast messages and student cards
 * without modifying source database fields or any input's current value.
 */
export function installEditorialCopy(root:HTMLElement):()=>void{
 if(typeof window==="undefined"||typeof MutationObserver==="undefined")return ()=>{};
 let pending=new Set<Node>();
 let scheduled=false;
 let disposed=false;
 const format=(node:Node):void=>{
  if(node.nodeType===Node.TEXT_NODE){
   const parent=node.parentElement;
   if(!parent||isSkipped(parent))return;
   const value=node.nodeValue||"";
   const updated=polishEditorialCopy(value);
   if(value!==updated)node.nodeValue=updated;
   return;
  }
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  const element=node as Element;
  if(isSkipped(element))return;
  for(const attr of copyAttrs){
   const value=element.getAttribute(attr);
   if(value===null)continue;
   const updated=polishEditorialCopy(value);
   if(value!==updated)element.setAttribute(attr,updated);
  }
  for(const child of Array.from(element.childNodes))format(child);
 };
 const flush=()=>{
  scheduled=false;
  if(disposed)return;
  const nodes=pending;
  pending=new Set<Node>();
  for(const node of nodes)if(node.isConnected)format(node);
 };
 const enqueue=(node:Node)=>{
  pending.add(node);
  if(scheduled)return;
  scheduled=true;
  window.requestAnimationFrame(flush);
 };
 const observer=new MutationObserver(records=>{
  for(const record of records){
   if(record.type==="characterData")enqueue(record.target);
   else if(record.type==="attributes")enqueue(record.target);
   else for(const node of Array.from(record.addedNodes))enqueue(node);
  }
 });
 observer.observe(root,{
  subtree:true,childList:true,characterData:true,attributes:true,
  attributeFilter:[...copyAttrs],
 });
 enqueue(root);
 return ()=>{disposed=true;observer.disconnect();pending.clear();};
}
