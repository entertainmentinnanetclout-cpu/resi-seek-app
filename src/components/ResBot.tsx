import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { EXTERNAL_SUPABASE_ANON_KEY, externalFunctionUrl, supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  role: "bot" | "user";
  content: string;
  timestamp: Date;
}

const getFallbackResponse = (input: string): string => {
  const lower = input.toLowerCase();
  if (/^(hi|hello|hey|howzit|molo|sawubona|dumelang)/i.test(lower)) {
    return "Hi! I’m ResBot, powered by Konnect Agent. I can help with ResKonnect, accommodation and application questions.";
  }
  if (/nsfas/i.test(lower)) {
    return "NSFAS eligibility and accommodation rules can change. Check the current residence listing and your live application details in ResKonnect; if something is unclear, I’ll route it to the team rather than guess.";
  }
  if (/price|cost|cheap|affordable/i.test(lower)) {
    return "Use Find My Res for current prices and availability. I won’t quote a residence price unless it is available in the live ResKonnect data.";
  }
  if (/apply|application/i.test(lower)) {
    return "Sign in and open your Applications page for your live status. I can explain what the current status means, but I won’t invent or change an approval decision.";
  }
  return "I can help with ResKonnect, residences and application support. Sign in for account-specific answers.";
};

const quickQuestions = ["How do I apply?", "My application status", "NSFAS accommodation", "Find a residence"];

const ResBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content: "Hi! I’m ResBot, now powered by ResKonnect’s Konnect Agent. Sign in for secure, account-specific application support, or ask a general question.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);
  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);
  useEffect(() => { setThreadId(null); }, [user?.id]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isTyping) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: messageText, timestamp: new Date() }]);
    setInput("");
    setIsTyping(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const signedIn = Boolean(user && accessToken);
      const response = await fetch(externalFunctionUrl(signedIn ? "adminos-enquiry" : "adminos-agent"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EXTERNAL_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${signedIn ? accessToken : EXTERNAL_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(signedIn
          ? { message: messageText, thread_id: threadId }
          : { action: "public_enquiry", message: messageText }),
      });
      const data = await response.json().catch(() => ({}));
      let aiResponse = data.response || data.answer;
      if (!response.ok || !aiResponse) {
        aiResponse = data.error === "Sign in is required for account-specific enquiries"
          ? "Please sign in so I can securely access your own ResKonnect application details."
          : getFallbackResponse(messageText);
        if (response.status === 429 || response.status === 503) toast.error("Konnect Agent is temporarily unavailable; a safe fallback was used.");
      }
      if (data.thread_id) setThreadId(data.thread_id);
      if (data.escalated) toast.info("This enquiry was escalated to the ResKonnect team for human review.");
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "bot", content: aiResponse, timestamp: new Date() }]);
    } catch (error) {
      console.error("ResBot error:", error);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "bot", content: getFallbackResponse(messageText), timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };
  const formatMessage = (content: string) => content.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part);

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className={cn("fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-premium flex items-center justify-center transition-all duration-300 hover:scale-110", isOpen ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground")} aria-label={isOpen ? "Close chat" : "Open chat"}>
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[90vw] max-w-md bg-background border border-border rounded-2xl shadow-premium overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-gradient-primary p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center"><Bot className="w-6 h-6 text-primary-foreground" /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-primary-foreground flex items-center gap-2">ResBot <Sparkles className="w-4 h-4 text-yellow-300" /></h3>
              <p className="text-xs text-primary-foreground/80 flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />Konnect Agent • Secure support</p>
            </div>
          </div>
          <ScrollArea className="h-80 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}>
                  {message.role === "bot" && <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-primary" /></div>}
                  <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap", message.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md")}>{formatMessage(message.content)}</div>
                  {message.role === "user" && <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-secondary" /></div>}
                </div>
              ))}
              {isTyping && <div className="flex gap-2 items-center"><div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="w-4 h-4 text-primary" /></div><div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Checking trusted data...</span></div></div>}
            </div>
          </ScrollArea>
          <div className="px-4 pb-2 flex gap-2 flex-wrap">{quickQuestions.map((q) => <button key={q} onClick={() => void handleSend(q)} disabled={isTyping} className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:opacity-50">{q}</button>)}</div>
          <div className="p-4 pt-2 border-t border-border">
            <div className="flex gap-2">
              <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={user ? "Ask about your ResKonnect account..." : "Ask a general question..."} disabled={isTyping} className="flex-1" />
              <Button onClick={() => void handleSend()} disabled={!input.trim() || isTyping} size="icon" className="shrink-0">{isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ResBot;
