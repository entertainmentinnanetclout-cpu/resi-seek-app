import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "bot" | "user";
  content: string;
  timestamp: Date;
}

// Rule-based response system
const getResponse = (input: string): string => {
  const lower = input.toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|howzit|molo|sawubona|dumelang)/i.test(lower)) {
    return "Hey there! 👋 I'm ResBot, your student accommodation assistant. I can help you with:\n\n• Finding residences near TUT\n• NSFAS accommodation info\n• Application process\n• Pricing and amenities\n\nWhat would you like to know?";
  }

  // NSFAS related
  if (/nsfas/i.test(lower)) {
    if (/accredited|approved|accept/i.test(lower)) {
      return "✅ Many residences on ResKonnect are NSFAS accredited! Look for the 'NSFAS Accredited' badge on residence listings. NSFAS typically covers:\n\n• R45,000 - R70,000 per year for accommodation\n• Payment goes directly to the residence\n\nUse our search filters to show only NSFAS-approved residences!";
    }
    if (/apply|application|how/i.test(lower)) {
      return "To apply for NSFAS accommodation:\n\n1️⃣ First, ensure your NSFAS application is approved\n2️⃣ Browse NSFAS-accredited residences on ResKonnect\n3️⃣ Apply through our platform\n4️⃣ Once accepted, NSFAS pays the residence directly\n\nNeed help finding NSFAS residences? Just ask!";
    }
    return "NSFAS (National Student Financial Aid Scheme) helps students with accommodation funding. Many residences on ResKonnect accept NSFAS. Would you like to know about:\n\n• NSFAS-accredited residences?\n• How to apply with NSFAS?\n• NSFAS allowance amounts?";
  }

  // Price related
  if (/price|cost|cheap|affordable|budget|expensive|how much|rand|r\d+/i.test(lower)) {
    if (/cheap|affordable|budget/i.test(lower)) {
      return "💰 Looking for budget-friendly options? Great news! We have residences starting from R2,000/month. Use the price filter on the 'Find My Res' page to set your budget. Tip: Sharing rooms can reduce costs significantly!";
    }
    return "🏠 Residence prices on ResKonnect range from:\n\n• Budget: R2,000 - R3,500/month\n• Mid-range: R3,500 - R5,000/month\n• Premium: R5,000 - R8,000/month\n\nPrices depend on room type, location, and amenities. Use our filters to find options in your budget!";
  }

  // Location/Distance
  if (/close|near|distance|far|walk|campus|tut|pretoria/i.test(lower)) {
    if (/soshanguve|sosh/i.test(lower)) {
      return "📍 TUT Soshanguve Campus: We have many residences within walking distance! Most are 0.5km - 3km from campus. Use the distance filter to find the closest options.";
    }
    if (/ga-rankuwa|garankuwa/i.test(lower)) {
      return "📍 TUT Ga-Rankuwa Campus: Several residences available nearby! Check the 'Find My Res' page and filter by Ga-Rankuwa campus.";
    }
    if (/pretoria|arcadia|main/i.test(lower)) {
      return "📍 TUT Pretoria/Arcadia Campus: Multiple accommodation options in the city! Prices may be higher but transport is convenient.";
    }
    return "📍 We have residences near all TUT campuses:\n\n• Soshanguve\n• Ga-Rankuwa\n• Pretoria\n• Mbombela\n• Polokwane\n• eMalahleni\n\nWhich campus are you looking for?";
  }

  // Room types
  if (/single|sharing|double|room type|bachelor|commune/i.test(lower)) {
    return "🛏️ Room types available:\n\n• **Single Room**: Private room, own space\n• **Sharing (2-4 people)**: More affordable, social\n• **Bachelor**: Self-contained with kitchenette\n• **Commune**: Shared living spaces\n\nSingle rooms offer privacy but cost more. Sharing is budget-friendly and great for making friends!";
  }

  // Amenities
  if (/wifi|internet|laundry|gym|pool|parking|security|meal|food|amenities|facilities/i.test(lower)) {
    return "✨ Common amenities at residences:\n\n• 📶 WiFi/Internet\n• 🔒 24/7 Security\n• 🧺 Laundry facilities\n• 🏋️ Gym access\n• 🍽️ Meal plans\n• 🚗 Parking\n• 📚 Study rooms\n\nUse the amenities filter to find exactly what you need!";
  }

  // Application process
  if (/apply|application|how to|process|steps|register/i.test(lower)) {
    return "📝 How to apply for a residence:\n\n1️⃣ Create your ResKonnect account\n2️⃣ Complete your profile with student details\n3️⃣ Browse residences using filters\n4️⃣ Click 'Apply Now' on your chosen residence\n5️⃣ Upload required documents\n6️⃣ Wait for approval (usually 1-3 days)\n\nNeed help with a specific step?";
  }

  // Documents
  if (/document|upload|id|proof|require|need/i.test(lower)) {
    return "📄 Documents typically required:\n\n• ID/Passport copy\n• Proof of registration\n• NSFAS approval letter (if applicable)\n• Guardian details (if under 18)\n• Proof of payment/deposit\n\nUpload documents in your profile under 'My Documents'.";
  }

  // Safety/Security
  if (/safe|security|guard|cctv|crime/i.test(lower)) {
    return "🔒 Safety is our priority! Look for residences with:\n\n• 24/7 security guards\n• CCTV cameras\n• Biometric access\n• Secure parking\n• Emergency response\n\nCheck the 'Verified' badge for residences we've inspected!";
  }

  // Contact/Support
  if (/contact|call|email|whatsapp|phone|support|help/i.test(lower)) {
    return "📞 Need more help?\n\n• Use the WhatsApp button on any residence listing to contact them directly\n• Email: support@reskonnect.co.za\n• Check our FAQ section\n\nOr just ask me anything here! I'm available 24/7.";
  }

  // Compare
  if (/compare|comparison|difference|vs|versus/i.test(lower)) {
    return "⚖️ Want to compare residences? Use our Compare Tool!\n\n1. Click the ⚖️ icon on any residence card\n2. Add up to 3 residences\n3. View side-by-side comparison\n\nCompare prices, amenities, distance, and more!";
  }

  // Favorites
  if (/save|favorite|wishlist|bookmark|later/i.test(lower)) {
    return "❤️ Save residences you like!\n\nClick the heart icon on any residence to add it to your favorites. View all saved residences in 'My Favorites' from your dashboard.";
  }

  // Reviews
  if (/review|rating|experience|recommend/i.test(lower)) {
    return "⭐ Check residence reviews from real students! Look for:\n\n• Star ratings (1-5)\n• Verified stay badges\n• Pros and cons\n\nLived somewhere? Share your experience to help other students!";
  }

  // Thanks
  if (/thank|thanks|cheers|appreciate/i.test(lower)) {
    return "You're welcome! 😊 Good luck with your accommodation search. Remember, I'm here 24/7 if you need more help. Wishing you a great academic year ahead! 🎓";
  }

  // Goodbye
  if (/bye|goodbye|later|see you|cheers/i.test(lower)) {
    return "Goodbye! 👋 Good luck with your accommodation search. Come back anytime you need help. All the best with your studies! 🎓";
  }

  // Default fallback
  return "I'm not sure about that, but I can help you with:\n\n• 🏠 Finding residences\n• 💰 Pricing information\n• 📍 Campus locations\n• 📝 Application process\n• 💳 NSFAS info\n• ✨ Amenities\n\nTry asking about one of these topics!";
};

const quickQuestions = [
  "How do I apply?",
  "NSFAS residences",
  "Price range",
  "Near Soshanguve",
];

const ResBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content: "Hi! 👋 I'm ResBot, your student accommodation assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate thinking delay
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

    const response = getResponse(messageText);
    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "bot",
      content: response,
      timestamp: new Date(),
    };

    setIsTyping(false);
    setMessages((prev) => [...prev, botMessage]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-premium flex items-center justify-center transition-all duration-300 hover:scale-110",
          isOpen
            ? "bg-destructive text-destructive-foreground"
            : "bg-primary text-primary-foreground animate-pulse"
        )}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[90vw] max-w-md bg-background border border-border rounded-2xl shadow-premium overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="bg-gradient-primary p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-primary-foreground">ResBot</h3>
              <p className="text-xs text-primary-foreground/80 flex items-center gap-1">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                Online - Here to help
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-primary-foreground/60" />
          </div>

          {/* Messages */}
          <ScrollArea className="h-80 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "bot" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    {message.content}
                  </div>
                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-secondary" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2 items-center">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick Questions */}
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 pt-2 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question..."
                className="flex-1"
              />
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                size="icon"
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ResBot;
