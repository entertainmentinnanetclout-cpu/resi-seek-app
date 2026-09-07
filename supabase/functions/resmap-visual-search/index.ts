import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||Deno.env.get("EXTERNAL_SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")||"";
const OPENAI_API_KEY=Deno.env.get("OPENAI_API_KEY")||"";
const MODEL=Deno.env.get("OPENAI_ROUTINE_MODEL")||"gpt-5.6-luna";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});

function extractText(data:any){
  if(typeof data?.output_text==="string")return data.output_text;
  for(const output of data?.output||[])for(const c of output?.content||[])if(c?.type==="output_text"&&typeof c?.text==="string")return c.text;
  return "";
}
function parseJson(raw:string){const text=raw.trim().replace(/^```json\s*/i,"").replace(/```$/," ").trim();const start=text.indexOf("{");const end=text.lastIndexOf("}");if(start<0||end<=start)throw new Error("Visual analysis was not valid JSON");return JSON.parse(text.slice(start,end+1));}
function safeList(value:any,max=8){return Array.isArray(value)?value.map((x)=>String(x).toLowerCase().trim()).filter(Boolean).slice(0,max):[];}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!SUPABASE_URL||!SERVICE_KEY)return json({error:"Service unavailable"},503);
  const service=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});
  const body=await req.json().catch(()=>({}));
  const image=String(body.image||"");
  const visitor=String(body.visitor_hash||req.headers.get("x-client-info")||"anonymous").slice(0,128);
  if(!image.startsWith("data:image/"))return json({error:"A JPG, PNG or WEBP image is required"},400);
  if(image.length>8_000_000)return json({error:"Image is too large. Use an image under about 5 MB."},413);
  const authHeader=req.headers.get("Authorization")||"";
  let userId:string|null=null;
  if(authHeader){const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";if(anon){const client=createClient(SUPABASE_URL,anon,{global:{headers:{Authorization:authHeader}}});const u=await client.auth.getUser();userId=u.data.user?.id||null;}}
  const since=new Date();since.setUTCHours(0,0,0,0);
  let usageQuery=service.from("resmap_visual_searches").select("id",{count:"exact",head:true}).gte("created_at",since.toISOString());
  usageQuery=userId?usageQuery.eq("user_id",userId):usageQuery.eq("visitor_hash",visitor);
  const usage=await usageQuery;
  const limit=userId?10:3;
  if((usage.count||0)>=limit)return json({error:`Visual search limit reached for today (${limit}). This keeps AI costs focused on useful searches.`},429);
  if(!OPENAI_API_KEY)return json({error:"Dimpho visual search is temporarily unavailable"},503);

  const prompt=`Analyze this accommodation/interior reference image for student-housing discovery. Do not identify people. Return ONLY JSON with this exact shape:\n{"style_tags":string[],"room_types":string[],"amenities":string[],"features":string[],"summary":string}.\nUse only visible housing characteristics. Allowed examples: modern, minimalist, bright, furnished, compact, studio, single room, sharing room, private bathroom, desk, wardrobe, kitchen, balcony, parking, wifi-ready, natural light. Keep each array to max 8 short lowercase tags. Never infer safety, price, neighbourhood, funding, race, gender or location from the image.`;
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:MODEL,input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image}]}],max_output_tokens:350})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return json({error:data?.error?.message||`OpenAI HTTP ${response.status}`},502);
  try{
    const parsed=parseJson(extractText(data));
    const result={style_tags:safeList(parsed.style_tags),room_types:safeList(parsed.room_types,5),amenities:safeList(parsed.amenities),features:safeList(parsed.features),summary:String(parsed.summary||"Visual preferences detected").slice(0,280)};
    await service.from("resmap_visual_searches").insert({user_id:userId,visitor_hash:userId?null:visitor,input_hash:`len:${image.length}`,derived_tags:result,result_count:0,model_used:MODEL});
    return json({ok:true,...result,model:MODEL,ai_calls:1});
  }catch(error){return json({error:error instanceof Error?error.message:String(error)},502);}
});
