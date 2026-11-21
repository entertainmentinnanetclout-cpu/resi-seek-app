/**
 * OPTIONAL server-side adapter for a separate authenticated Qwen housing-intent gateway.
 * Default disabled. Never sends private ResKonnect Brain/customer records to the Mac.
 */
const sensitive=/\b(password|passcode|pin|otp|cvv|passport|identity number|id number|medical|bank account|account number|credit card)\b/i;
const email=/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const longNumber=/\b(?:\+?\d[\d ()-]{7,}\d)\b/;
const allowedRooms=new Set(["single","sharing","studio","bachelor"]);
const allowedAmenities=new Set(["wifi","parking","furnished"]);
export const safeHousingQuestion=query=>typeof query==="string"&&query.trim().length>=4&&query.length<=240&&
  !email.test(query)&&!sensitive.test(query)&&!longNumber.test(query);
export function validatedHousingIntent(raw,query){
  const input=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
  const rent=Number(input.budgetMax);
  const locate=k=>{
    const val=typeof input[k]==="string"?input[k].trim().slice(0,80):"";
    return val&&query.toLowerCase().includes(val.toLowerCase())?val:null;
  };
  return{
    city:locate("city"),campus:locate("campus"),
    budgetMax:Number.isFinite(rent)&&rent>=500&&rent<=25000?Math.round(rent):null,
    funding:["nsfas","private"].includes(input.funding)?input.funding:null,
    roomTypes:[...new Set((Array.isArray(input.roomTypes)?input.roomTypes:[]).filter(v=>allowedRooms.has(v)))].slice(0,4),
    amenities:[...new Set((Array.isArray(input.amenities)?input.amenities:[]).filter(v=>allowedAmenities.has(v)))].slice(0,3)
  };
}
const send=(res,status,body)=>{
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.status(status).json(body);
};
export default async function handler(req,res){
  if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
  const query=req.body?.query;
  if(!safeHousingQuestion(query))return send(res,400,{error:"Enter a short non-sensitive housing search, without account details."});
  if(process.env.RK_QWEN_INTENT_ENABLED!=="true")return send(res,503,{error:"Local AI search enhancement is not enabled."});
  const token=process.env.RK_QWEN_INTENT_TOKEN||"";
  const rawUrl=process.env.RK_QWEN_INTENT_URL||"";
  if(token.length<32||!rawUrl)return send(res,503,{error:"Local AI service is not configured."});
  let endpoint;
  try{
    endpoint=new URL(rawUrl);
    if(endpoint.protocol!=="https:"||endpoint.username||endpoint.password||endpoint.search||
       !endpoint.hostname||endpoint.hostname==="localhost"||
       endpoint.hostname.endsWith(".local")||endpoint.hostname.endsWith(".internal")||
       /^\d{1,3}(?:\.\d{1,3}){3}$/.test(endpoint.hostname)||
       endpoint.pathname!=="/v1/intent")throw new Error("Unsafe endpoint");
  }catch{return send(res,503,{error:"Local AI service endpoint is invalid."});}
  try{
    const response=await fetch(endpoint.href,{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
      body:JSON.stringify({query}),
      signal:AbortSignal.timeout(22000)
    });
    if(!response.ok)throw new Error("Gateway unavailable");
    const result=await response.json();
    if(!result||result.source!=="local-qwen"||result.verifiedListings!==false||!result.intent)throw new Error("Invalid gateway response");
    return send(res,200,{
      intent:validatedHousingIntent(result.intent,query),
      provider:"local-qwen",
      actualListingsVerified:false
    });
  }catch{
    // Existing deterministic Find My Res search must continue to work, independently.
    return send(res,503,{error:"Local AI is offline. Standard ResKonnect search is still available."});
  }
}
