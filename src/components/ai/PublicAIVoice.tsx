import {useEffect,useRef,useState} from "react";
import {AudioLines,Mic,MicOff,Square,Volume2} from "lucide-react";
import {Button} from "@/components/ui/button";

type RecognitionResult={results:{[n:number]:{[n:number]:{transcript:string}}}};
type Recognition={
  lang:string;continuous:boolean;interimResults:boolean;
  onresult:((event:RecognitionResult)=>void)|null;
  onerror:((event:{error:string})=>void)|null;
  onend:(()=>void)|null;
  start:()=>void;stop:()=>void;abort:()=>void;
};
type RecognitionCtor=new()=>Recognition;
function recognitionType():RecognitionCtor|null{
  if(typeof window==="undefined")return null;
  const browser=window as unknown as {SpeechRecognition?:RecognitionCtor;webkitSpeechRecognition?:RecognitionCtor};
  return browser.SpeechRecognition??browser.webkitSpeechRecognition??null;
}

/** Public opt-in voice UI; uses existing authorised ResKonnect Brain only. */
export function PublicAIVoice({
  ask,navigateTo,disabled=false
}:{
  ask:(question:string)=>Promise<string>;
  navigateTo:(path:string)=>void;
  disabled?:boolean;
}){
  const [phase,setPhase]=useState<"idle"|"listening"|"thinking"|"speaking"|"error">("idle");
  const [issue,setIssue]=useState("");
  const [lastTurn,setLastTurn]=useState("");
  const active=useRef(false),seq=useRef(0),recognition=useRef<Recognition|null>(null);
  const askRef=useRef(ask),navigateRef=useRef(navigateTo);
  askRef.current=ask;navigateRef.current=navigateTo;
  const available=Boolean(recognitionType()&&typeof window!=="undefined"&&"speechSynthesis" in window);
  const stop=()=>{
    active.current=false;seq.current++;
    recognition.current?.abort();recognition.current=null;
    if("speechSynthesis" in window)window.speechSynthesis.cancel();
    setPhase("idle");
  };
  useEffect(()=>()=>{active.current=false;seq.current++;recognition.current?.abort();recognition.current=null;
    if("speechSynthesis" in window)window.speechSynthesis.cancel();},[]);
  async function answerToSpeech(text:string,turn:number){
    return new Promise<void>((resolve)=>{
      if(!active.current||turn!==seq.current||!("speechSynthesis" in window))return resolve();
      const plain=text.replace(/`{3}[\s\S]*?`{3}/g,"code omitted").replace(/https?:\/\/\S+/g,"link")
        .replace(/[*#_>`]/g," ").slice(0,1500).trim();
      if(!plain)return resolve();
      setPhase("speaking");
      const utterance=new SpeechSynthesisUtterance(plain);
      utterance.lang="en-ZA";utterance.rate=1;
      let settled=false;
      const done=()=>{if(settled)return;settled=true;resolve();};
      utterance.onend=done;utterance.onerror=done;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }
  function listen(){
    if(!active.current||disabled)return;
    const Ctor=recognitionType();
    if(!Ctor){stop();setIssue("Voice recognition is unavailable in this browser.");setPhase("error");return;}
    const token=++seq.current;
    const recog=new Ctor();
    recog.lang="en-ZA";recog.continuous=false;recog.interimResults=false;
    recognition.current=recog;
    let received=false;
    recog.onresult=event=>{
      if(received||!active.current||seq.current!==token)return;
      received=true;
      const heard=(event.results[0]?.[0]?.transcript||"").trim();
      if(!heard)return;
      setLastTurn(heard);
      void processTranscript(heard,token);
    };
    recog.onerror=event=>{
      if(!active.current||seq.current!==token)return;
      stop();setIssue(event.error==="not-allowed"?"Allow microphone access to use voice chat.":"Voice recognition stopped: "+event.error);
      setPhase("error");
    };
    recog.onend=()=>{
      if(active.current&&seq.current===token&&!received){setPhase("idle");active.current=false;}
    };
    try{setPhase("listening");recog.start();}
    catch{active.current=false;setPhase("idle");setIssue("Tap Start voice chat again to continue in this browser.");}
  }
  async function processTranscript(heard:string,token:number){
    recognition.current=null;
    if(/^(?:stop|end|close) (?:voice|voice chat|conversation)[.!?]?$/i.test(heard)){stop();return;}
    const navigation=heard.trim().toLowerCase().replace(/[.!?]+$/,"").match(/^(?:open|show|go to) (?:the )?(accommodation|living|find my res|applications|opportunities|ai)(?: page)?$/);
    const routes:Record<string,string>={accommodation:"/findmyres",living:"/living","find my res":"/findmyres",applications:"/apply",opportunities:"/opportunities",ai:"/ai"};
    if(navigation&&routes[navigation[1]]){stop();navigateRef.current(routes[navigation[1]]);return;}
    try{
      setPhase("thinking");
      const reply=await askRef.current(heard);
      if(!active.current||seq.current!==token)return;
      if(reply)await answerToSpeech(reply,token);
      if(active.current&&seq.current===token)listen();
    }catch{
      if(!active.current||seq.current!==token)return;
      stop();setIssue("The AI request failed. You can still type or search for accommodation.");setPhase("error");
    }
  }
  function start(){
    if(disabled||!available)return;
    setIssue("");
    if("speechSynthesis" in window)window.speechSynthesis.cancel();
    active.current=true;listen();
  }
  return <div className="mt-3 rounded-2xl border border-primary/20 bg-muted/30 p-3">
    <div className="flex flex-wrap items-center gap-2">
      <AudioLines className="h-4 w-4 text-primary"/>
      <span className="text-xs font-bold">ResKonnect Voice Chat</span>
      <span role="status" className="ml-auto text-[11px] text-muted-foreground">
        {phase==="listening"?"Listening":phase==="thinking"?"Finding your answer":phase==="speaking"?"Speaking":phase==="error"?"Unavailable":"Ready"}
      </span>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {phase==="listening"||phase==="thinking"||phase==="speaking"?
        <Button type="button" variant="outline" size="sm" onClick={stop}><Square className="mr-1 h-3.5 w-3.5"/>Stop voice</Button>:
        <Button type="button" variant="outline" size="sm" disabled={!available||disabled} onClick={start}><Mic className="mr-1 h-3.5 w-3.5"/>Start voice chat</Button>}
      {phase==="speaking"?<Volume2 className="h-4 w-4 text-primary"/>:phase==="listening"?<Mic className="h-4 w-4 animate-pulse text-primary"/>:<MicOff className="h-4 w-4 text-muted-foreground"/>}
    </div>
    {!available&&<p className="mt-2 text-xs text-muted-foreground">This browser does not provide both speech recognition and spoken playback. Text chat still works.</p>}
    {issue&&<p role="alert" className="mt-2 text-xs text-destructive">{issue}</p>}
    {lastTurn&&<p className="mt-2 break-words text-xs text-muted-foreground">Heard: {lastTurn.slice(0,200)}</p>}
    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Microphone starts only when you tap. Say “find accommodation near TUT” or “open living”. Browser speech recognition may use its provider's speech service; it is not guaranteed to stay on your device. Stop to end listening.</p>
  </div>;
}
