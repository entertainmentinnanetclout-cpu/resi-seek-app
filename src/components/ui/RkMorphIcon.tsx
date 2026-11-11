import type {LucideIcon} from "lucide-react";

type Props={idle:LucideIcon;active:LucideIcon;isActive:boolean;className?:string};
/** Same icon slot, overlapping opacity and blur, with no surrounding layout jump. */
export function RkMorphIcon({idle:Idle,active:Active,isActive,className=""}:Props){
 return <span aria-hidden="true" className={"rk-icon-morph "+className} data-active={isActive?"true":"false"}>
  <Idle/><Active/>
 </span>;
}
