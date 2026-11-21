import assert from "node:assert/strict";
import handler,{safeHousingQuestion,validatedHousingIntent} from "../api/local-ai-housing-intent.js";

assert.equal(safeHousingQuestion("NSFAS single near Pretoria West under R3500"),true);
assert.equal(safeHousingQuestion("My password is hello"),false);
assert.equal(safeHousingQuestion("my student email is person@example.com"),false);
const parsed=validatedHousingIntent({
  city:"Cape Town",campus:"Pretoria West",budgetMax:3500,
  funding:"nsfas",roomTypes:["single","made-up-room"],amenities:["wifi","pool"]
},"NSFAS single near Pretoria West under R3500");
assert.equal(parsed.city,null);
assert.equal(parsed.campus,"Pretoria West");
assert.equal(parsed.budgetMax,3500);
assert.deepEqual(parsed.roomTypes,["single"]);
assert.deepEqual(parsed.amenities,["wifi"]);

function fakeResponse(){
  return {
    statusCode:0,body:null,headers:{},
    setHeader(k,v){this.headers[k]=v;},
    status(code){this.statusCode=code;return this;},
    json(value){this.body=value;return this;}
  };
}
const old={
  enabled:process.env.RK_QWEN_INTENT_ENABLED,
  url:process.env.RK_QWEN_INTENT_URL,
  token:process.env.RK_QWEN_INTENT_TOKEN,
  fetch:globalThis.fetch
};
try{
  delete process.env.RK_QWEN_INTENT_ENABLED;
  let res=fakeResponse();
  await handler({method:"POST",body:{query:"NSFAS near Pretoria West"}},res);
  assert.equal(res.statusCode,503,"disabled unless server opts in");
  res=fakeResponse();
  await handler({method:"POST",body:{query:"my passport number is 123456789"}},res);
  assert.equal(res.statusCode,400);
  process.env.RK_QWEN_INTENT_ENABLED="true";
  process.env.RK_QWEN_INTENT_TOKEN="t".repeat(64);
  process.env.RK_QWEN_INTENT_URL="https://bridge.example.com/v1/intent";
  let count=0;
  globalThis.fetch=async(url,options)=>{
    count++;
    assert.equal(url,process.env.RK_QWEN_INTENT_URL);
    assert.equal(options.method,"POST");
    assert.equal(options.headers.Authorization,"Bearer "+"t".repeat(64));
    assert.deepEqual(JSON.parse(options.body),{query:"Find NSFAS single in Pretoria West under R3500"});
    return new Response(JSON.stringify({
      source:"local-qwen",verifiedListings:false,intent:{campus:"Pretoria West",city:null,budgetMax:3500,funding:"nsfas",roomTypes:["single"],amenities:[]}
    }),{status:200});
  };
  res=fakeResponse();
  await handler({method:"POST",body:{query:"Find NSFAS single in Pretoria West under R3500"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.provider,"local-qwen");
  assert.equal(res.body.actualListingsVerified,false);
  assert.equal(res.body.intent.budgetMax,3500);
  assert.equal(count,1);
  process.env.RK_QWEN_INTENT_URL="http://127.0.0.1:8781/v1/intent";
  res=fakeResponse();
  await handler({method:"POST",body:{query:"Find NSFAS single near Pretoria West"}},res);
  assert.equal(res.statusCode,503,"HTTPS tunnel required; direct localhost forbidden");
  assert.equal(count,1);
}finally{
  for(const [key,value] of [["RK_QWEN_INTENT_ENABLED",old.enabled],["RK_QWEN_INTENT_URL",old.url],["RK_QWEN_INTENT_TOKEN",old.token]]){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
  globalThis.fetch=old.fetch;
}
console.log("Qwen intent adapter tests passed: disabled default, PII, scoped payload, HTTPS and safe output.");
