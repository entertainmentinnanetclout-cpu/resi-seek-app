import {Navigate,useSearchParams} from "react-router-dom";

/** Keep legacy AdminOS URLs working, but never mount duplicate control panels.
 * Each capability is now owned by exactly one departmental workspace.
 */
export default function AdminSystemHub(){
 const [params]=useSearchParams();
 const legacy=String(params.get("tab")||"communications");
 const destination:Record<string,string>={
  communications:"/admin/communications?tab=desk",
  "whatsapp-desk":"/admin/communications?tab=desk",
  whatsapp:"/admin/communications?tab=desk",
  "whatsapp-concierge":"/admin/communications?tab=concierge",
  "twilio-setup":"/admin/technology?tab=integrations",
  automation:"/admin/technology?tab=ai",
  adminos:"/admin/technology?tab=advanced",
  intelligence:"/admin/intelligence?tab=demand",
  dimpho:"/admin/technology?tab=ai",
  luna:"/admin/intelligence?tab=demand",
  growth:"/admin/intelligence?tab=demand",
  operations:"/admin/operations-office?tab=tasks",
  wil:"/admin/wil",
  "site-updates":"/admin/corporate-affairs",
  platform:"/admin/technology?tab=health",
  "backend-health":"/admin/technology?tab=health",
  "system-status":"/admin/technology?tab=health",
  settings:"/admin/technology?tab=health"
 };
 const path=destination[legacy]||destination.communications;
 const contact=params.get("contact");
 return <Navigate replace to={contact&&path.startsWith("/admin/communications")?
  path.replace("tab=desk","tab=contacts")+"&contact="+encodeURIComponent(contact):path}/>;
}
