import type {ReactNode} from "react";
import {Pencil} from "lucide-react";
import type {VisualPageKey,VisualPageSection} from "@/hooks/useVisualPageSections";

/** A deliberately light wrapper. The page owns the one live-data query and
 * iframe bridge, so an editor with 22 sections never opens 22 bridge listeners. */
export default function VisualPageBlock({page,sectionKey,slot,preview,children}:{
 page:VisualPageKey;sectionKey:string;slot?:VisualPageSection;preview:boolean;children:ReactNode
}){
 const hidden=slot?.visible===false&&!slot.required;
 if(hidden&&!preview)return null;
 return <div data-rk-visual-section={sectionKey}
  className={"rk-visual-section relative min-w-0 w-full "+(hidden?"min-h-24 border-2 border-dashed border-amber-400 bg-amber-50":"")}
  style={{order:slot?.position||0}}>
  {!hidden&&children}
  {hidden&&<p className="p-8 text-center text-sm font-semibold text-amber-800">{slot?.title||sectionKey} · Hidden from the published page</p>}
  {preview&&<button type="button" data-rk-visual-edit="true"
   className="absolute right-3 top-3 z-[70] flex items-center gap-1.5 rounded-full border-2 border-amber-400 bg-[#071326] px-3 py-2 text-[11px] font-black text-white shadow-2xl"
   aria-label={"Edit "+(slot?.title||sectionKey)}><Pencil className="h-3.5 w-3.5"/>{slot?.title||"Edit section"}</button>}
 </div>;
}
