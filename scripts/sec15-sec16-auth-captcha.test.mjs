import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const expect=(v,msg)=>{assert.ok(v,msg);console.log("PASS",msg)};
const widget=read("src/components/auth/AuthBotChallenge.tsx");
expect(widget.includes("import.meta.env.VITE_TURNSTILE_SITE_KEY"),"Turnstile only uses public sitekey");
expect(widget.includes("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"),"Loads official Turnstile widget");
expect(widget.includes("if (!authCaptchaConfigured) return {};"),"Unconfigured bot protection preserves existing auth paths");
expect(widget.includes("throw new Error(\"Complete the security verification before continuing.\")"),"Configured bot protection fails closed");
expect(widget.includes('"expired-callback"')&&widget.includes('"timeout-callback"')&&widget.includes('"error-callback"')&&widget.includes("onChangeRef.current(null)"),"Expiry, failure and timeout invalidate a used challenge");
expect(widget.includes("widget.api.remove(widget.id)"),"Unmount cleans up old challenge");
const pages=[
 ["src/pages/Auth.tsx",2,1],
 ["src/pages/recruit/RecruiterAuth.tsx",2,1],
 ["src/pages/residence/ResidenceLogin.tsx",1,1],
 ["src/pages/PasswordReset.tsx",0,1]
];
let sum=0;
for(const [path,authCalls,resetCalls] of pages){
const src=read(path);
const cnt=(src.match(/requireAuthCaptchaToken\(captchaToken\)/g)||[]).length;
expect(cnt===authCalls+resetCalls,path+" passes CAPTCHA tokens to all "+cnt+" expected Auth invocations");
expect(src.includes("<AuthBotChallenge"),path+" mounts the shared challenge");
expect(src.includes("setCaptchaEpoch((epoch) => epoch + 1)"),path+" resets single-use token after attempts");
expect(src.includes("setCaptchaToken(null)"),path+" clears stale tokens");
sum+=cnt;
}
expect(sum===9,"All nine login/signup/recovery call sites covered (3+3+2+1)");
expect(read("package.json").includes("node scripts/sec15-sec16-auth-captcha.test.mjs"),"Auth CI includes Turnstile regression gate");
console.log("SEC15/16 source contract PASS; Supabase hosted CAPTCHA switch remains dashboard-managed.");
