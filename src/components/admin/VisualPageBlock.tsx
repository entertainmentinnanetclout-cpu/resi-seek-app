import type {ReactNode} from "react";
import {Pencil} from "lucide-react";
import {useVisualPageSections,type VisualPageKey} from "@/hooks/useVisualPageSections";
import {useAuth} from "@/contexts/AuthContext";
import {isVisualPreviewAuthorized} from "@/lib/adminVisualPreview";

export default function VisualPageBlock({page,sectionKey,children}:{page:VisualPageKey;sectionKey:string;children:ReactNode}){
 const {byKey}=useVisualPageSections(page);
 const {isGodMode,session}=useAuth();
 const slot=byKey[sectionKey];
 const preview=isVisualPreviewAuthorized(isGodMode,session?.access_token);
 const hidden=slot?.visible===false&&!slot.required;
 if(hidden&&!preview)return null;
 return <div data-rk-visual-section={sectionKey}
  className={"relative min-w-0 w-full "+(hidden?"min-h-24 border-2 border-dashed border-amber-400 bg-amber-50":"")}
  style={{order:slot?.position||0}}>
  {!hidden&&children}
  {hidden&&<p className="p-8 text-center text-sm font-semibold text-amber-800">{slot?.title||sectionKey} · Hidden from the published page</p>}
  {preview&&<button type="button" onClick={()=>window.parent.postMessage({type:"rk-visual-select",page,sectionKey},window.location.origin)}
   className="absolute right-3 top-3 z-[70] flex items-center gap-1.5 rounded-full border-2 border-amber-400 bg-[#071326] px-3 py-2 text-[11px] font-black text-white shadow-2xl hover:bg-[#153b72]"
   aria-label={"Edit "+(slot?.title||sectionKey)}><Pencil className="h-3.5 w-3.5"/>{slot?.title||"Edit section"}</button>}
 </div>;
}
