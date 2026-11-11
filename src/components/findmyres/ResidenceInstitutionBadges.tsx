import {GraduationCap} from "lucide-react";

/** Self-reported accepted student institutions, not evidence of official accreditation. */
export const INSTITUTION_SUGGESTIONS=[
 {code:"TUT",label:"Tshwane University of Technology"},
 {code:"UP",label:"University of Pretoria"},
 {code:"TNC",label:"Tshwane North TVET College"},
 {code:"TSC",label:"Tshwane South TVET College"},
 {code:"UNISA",label:"University of South Africa"},
 {code:"SMU",label:"Sefako Makgatho Health Sciences University"},
 {code:"UJ",label:"University of Johannesburg"},
 {code:"WITS",label:"University of the Witwatersrand"},
 {code:"SPU",label:"Sol Plaatje University"},
 {code:"UL",label:"University of Limpopo"},
 {code:"VUT",label:"Vaal University of Technology"},
 {code:"CUT",label:"Central University of Technology"},
 {code:"CPUT",label:"Cape Peninsula University of Technology"},
 {code:"DUT",label:"Durban University of Technology"},
 {code:"NMU",label:"Nelson Mandela University"},
 {code:"NWU",label:"North-West University"},
 {code:"UFS",label:"University of the Free State"},
 {code:"UKZN",label:"University of KwaZulu-Natal"},
 {code:"TSC COLLEGE",label:"Tshwane South College"},
] as const;
const synonyms:Record<string,string>={
 "TSHWANE UNIVERSITY OF TECHNOLOGY":"TUT","UNIVERSITY OF PRETORIA":"UP",
 "TSHWANE NORTH COLLEGE":"TNC","TSHWANE NORTH TVET COLLEGE":"TNC",
 "TSHWANE SOUTH COLLEGE":"TSC","TSHWANE SOUTH TVET COLLEGE":"TSC",
 "UNIVERSITY OF SOUTH AFRICA":"UNISA","SOL PLAATJE UNIVERSITY":"SPU",
};
export function normalizeInstitutionTags(input:unknown):string[]{
 if(!Array.isArray(input))return [];
 const normalized=input.map(v=>String(v||"").trim().replace(/\s+/g," ").slice(0,70))
  .filter(Boolean).map(v=>synonyms[v.toUpperCase()]||v.toUpperCase());
 return [...new Set(normalized)].slice(0,30);
}
export function residenceInstitutionLabels(residence:any):string[]{
 const explicit=normalizeInstitutionTags(residence?.institution_tags);
 // Accepts university / TVET are broad audience declarations, never infer specific institutions.
 const generic=[
  ...(residence?.accepts_university===true?["University"]:[]),
  ...(residence?.accepts_tvet===true?["TVET"]:[]),
 ];
 return [...explicit,...generic.filter(label=>!explicit.some(tag=>tag.toLowerCase()===label.toLowerCase()))];
}
export default function ResidenceInstitutionBadges({residence,light=false,compact=false,maxVisible=5,className=""}:{
 residence:any;light?:boolean;compact?:boolean;maxVisible?:number;className?:string;
}){
 const labels=residenceInstitutionLabels(residence);
 if(!labels.length)return null;
 const shown=labels.slice(0,maxVisible);
 return <div className={"flex min-w-0 flex-wrap items-center gap-1.5 "+className}
  aria-label="Residence-declared accepted student institutions and categories"
  title={"Landlord-declared accepted institutions (not official accreditation): "+labels.join(", ")}>
  {!compact&&<span className={"inline-flex items-center gap-1 text-[10px] font-bold "+(light?"text-white/85":"text-[#61728b]")}>
   <GraduationCap className="h-3.5 w-3.5"/>Accepts students from</span>}
  {shown.map(label=><span key={label}
   className={light?"inline-flex rounded-full border border-white/35 bg-[#071326]/65 px-2 py-1 text-[10px] font-extrabold text-white backdrop-blur":
    "inline-flex rounded-full border border-[#d7e1f0] bg-[#f1f6ff] px-2 py-1 text-[10px] font-extrabold text-[#173b70]"}>
   {label}</span>)}
  {labels.length>shown.length&&<span className={light?"text-[10px] font-bold text-white":"text-[10px] font-bold text-[#173b70]"}>+{labels.length-shown.length} more</span>}
 </div>;
}
