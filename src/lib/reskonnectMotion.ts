import type {LucideIcon} from "lucide-react";

/** Reuses one layout identity while switching presentation modes; falls back safely in WebViews. */
export function runRkLayoutTransition(update:()=>void):void {
 if(typeof document==="undefined"||typeof window==="undefined"){update();return;}
 const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
 const doc=document as Document&{startViewTransition?:(callback:()=>void)=>unknown};
 if(reduced||typeof doc.startViewTransition!=="function"){update();return;}
 try{doc.startViewTransition(()=>update());}catch{update();}
}
/** One-shot bounded elastic edge cue for attempts to move beyond the first/last item. */
export function indicateRkBoundary(element:HTMLElement|null):void {
 if(!element||typeof window==="undefined"||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
 element.classList.remove("rk-rubber-hit");
 void element.offsetWidth;
 element.classList.add("rk-rubber-hit");
 element.addEventListener("animationend",()=>element.classList.remove("rk-rubber-hit"),{once:true});
}
export type MotionIcon=LucideIcon;
