/** Preview overlays are only available inside the same-origin God Mode editor with verified MFA.
 * This is a UI safeguard; publishing is separately enforced by PostgreSQL authorisation.
 */
export function isVisualPreviewAuthorized(isGodMode:boolean,accessToken?:string|null):boolean{
 if(!isGodMode||!accessToken||typeof window==="undefined")return false;
 try{
  if(window.parent===window || window.parent.location.origin!==window.location.origin)return false;
  if(new URLSearchParams(window.location.search).get("rk_visual_preview")!=="1")return false;
  const chunk=accessToken.split(".")[1];
  if(!chunk)return false;
  const clean=chunk.replace(/-/g,"+").replace(/_/g,"/");
  const decoded=JSON.parse(atob(clean.padEnd(Math.ceil(clean.length/4)*4,"=")));
  return decoded?.aal==="aal2";
 }catch{return false;}
}
