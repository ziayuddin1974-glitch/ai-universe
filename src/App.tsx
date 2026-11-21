import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { supabase, supabaseReady } from "./lib/supabase";
import { tools, type Tool } from "./data/tools";
import { Activity, ArrowUpRight, Bot, Bookmark, Check, ChevronDown, Command, Compass, Grid2X2, Heart, Image, LayoutDashboard, LogIn, LogOut, Menu, MessageSquare, Mic, MicOff, Moon, Search, Send, Settings, Sparkles, Sun, Video, WandSparkles, X, Code2, Zap } from "lucide-react";

type Page = "Overview" | "AI Directory" | "Chat Workspace" | "Image Tools" | "Video Tools" | "Coding Tools" | "Productivity" | "Favourites" | "Settings";
type ChatMessage = { role: "you" | "assistant"; text: string };
const nav = [
  {name:"Overview" as Page, icon:LayoutDashboard}, {name:"Chat Workspace" as Page,icon:MessageSquare},
  {name:"AI Directory" as Page,icon:Compass}, {name:"Image Tools" as Page,icon:Image},
  {name:"Video Tools" as Page,icon:Video}, {name:"Coding Tools" as Page,icon:Code2},
  {name:"Productivity" as Page,icon:WandSparkles}, {name:"Favourites" as Page,icon:Heart}
];
const categoryFor: Record<string,string> = {"Image Tools":"Image generation","Video Tools":"Video generation","Coding Tools":"Coding","Productivity":"Productivity"};
type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

function App() {
  const [page,setPage] = useState<Page>("Overview");
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("All categories");
  const [pricing,setPricing] = useState("All pricing");
  const [favs,setFavs] = useState<string[]>([]);
  const [recent,setRecent] = useState<string[]>(["ChatGPT","Claude","Perplexity AI"]);
  const [dark,setDark] = useState(true);
  const [mobile,setMobile] = useState(false);
  const [selected,setSelected] = useState("ChatGPT");
  const [prompt,setPrompt] = useState("");
  const [messages,setMessages] = useState<ChatMessage[]>([]);
  const [chatBusy,setChatBusy] = useState(false);
  const [conversationId,setConversationId] = useState<string|null>(null);
  const [notice,setNotice] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [authBusy,setAuthBusy] = useState(false);
  const [user,setUser] = useState<string|null>(null);
  const [userId,setUserId] = useState<string|null>(null);
  const [listening,setListening] = useState(false);
  const [voiceMessage,setVoiceMessage] = useState("");

  const filtered = useMemo(()=>tools.filter(t=>{
    const matches = `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(query.toLowerCase());
    const cat = category==="All categories" || t.category===category;
    const price = pricing==="All pricing" || t.pricing===pricing;
    const pageCat = !categoryFor[page] || t.category===categoryFor[page];
    return matches && cat && price && pageCat && (page!=="Favourites" || favs.includes(t.name));
  }),[query,category,pricing,page,favs]);

  useEffect(()=>{
    if(!supabase)return;
    let active=true;
    const client=supabase;
    const loadSession=async()=>{
      const {data,error}=await client.auth.getSession();
      if(!active)return;
      if(error){setNotice(error.message);return;}
      const session=data.session;
      setUser(session?.user.email??null);
      setUserId(session?.user.id??null);
      if(session?.user.id) await loadFavourites(session.user.id,active);
    };
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
      if(!active)return;
      setUser(session?.user.email??null);
      setUserId(session?.user.id??null);
      setConversationId(null);
      if(session?.user.id) void loadFavourites(session.user.id,active);
      else setFavs([]);
    });
    void loadSession();
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);

  async function loadFavourites(id:string,active=true){
    if(!supabase)return;
    const {data,error}=await supabase.from("favourites").select("tool_name").eq("user_id",id);
    if(!active)return;
    if(error){setNotice(`Could not load saved tools: ${error.message}`);return;}
    setFavs(data.map(item=>item.tool_name));
  }
  async function toggleFav(name:string){
    const wasSaved=favs.includes(name);
    const previous=favs;
    setFavs(wasSaved?favs.filter(item=>item!==name):[...favs,name]);
    if(!supabase||!userId)return;
    const result=wasSaved
      ? await supabase.from("favourites").delete().eq("user_id",userId).eq("tool_name",name)
      : await supabase.from("favourites").insert({user_id:userId,tool_name:name});
    if(result.error){setFavs(previous);setNotice(`Could not save this favourite: ${result.error.message}`);}
  }
  async function openTool(t:Tool){setRecent(old=>[t.name,...old.filter(x=>x!==t.name)].slice(0,5));if(Capacitor.isNativePlatform()){await Browser.open({url:t.url});return;}window.open(t.url,"_blank","noopener,noreferrer");}
  function applyVoiceCommand(transcript:string){
    const command=transcript.trim().toLowerCase().replace(/[.!?]+$/,"");
    if(!command){setVoiceMessage("I didn't catch that. Tap the microphone and try again.");return;}
    const destination:Record<string,Page>={
      "overview":"Overview","home":"Overview","dashboard":"Overview",
      "ai directory":"AI Directory","directory":"AI Directory","all tools":"AI Directory",
      "chat workspace":"Chat Workspace","chat studio":"Chat Workspace",
      "image tools":"Image Tools","image generation":"Image Tools","images":"Image Tools",
      "video tools":"Video Tools","video generation":"Video Tools","videos":"Video Tools",
      "coding tools":"Coding Tools","coding":"Coding Tools",
      "productivity":"Productivity","productivity tools":"Productivity",
      "favourites":"Favourites","favorites":"Favourites","saved tools":"Favourites",
      "settings":"Settings"
    };
    const target=command.replace(/^(?:please\s+)?(?:open|show|go to|navigate to)\s+/,"");
    if(target==="chat assistants"){
      setPage("AI Directory");
      setQuery("");
      setCategory("Chat assistants");
      setMobile(false);
      setVoiceMessage("Showing chat assistant tools.");
      return;
    }
    if(destination[target]){
      setPage(destination[target]);
      setQuery("");
      setCategory("All categories");
      setMobile(false);
      setVoiceMessage(`Opened ${destination[target]}.`);
      return;
    }
    const searchTerm=command.replace(/^(?:please\s+)?(?:search(?:\s+for)?|find|look\s+for|look\s+up)\s+/,"").replace(/^(?:open|show)\s+/,"").trim();
    if(searchTerm){
      const exactTool=tools.find(tool=>tool.name.toLowerCase()===searchTerm);
      setPage("AI Directory");
      setCategory("All categories");
      setQuery(exactTool?.name??searchTerm);
      setMobile(false);
      setVoiceMessage(`Searching AI tools for "${exactTool?.name??searchTerm}".`);
      return;
    }
    setVoiceMessage(`I couldn't match "${transcript}" to a command. Try "open image tools" or "search for Claude".`);
  }
  async function startVoiceCommand(){
    if(listening){
      if(Capacitor.isNativePlatform()) await SpeechRecognition.stop();
      setListening(false);
      return;
    }
    setVoiceMessage("Listening… Try “open coding tools” or “search for Claude”.");
    setListening(true);
    try{
      if(Capacitor.isNativePlatform()){
        const {available}=await SpeechRecognition.available();
        if(!available){setVoiceMessage("Speech recognition is not available on this device.");setListening(false);return;}
        const permission=await SpeechRecognition.checkPermissions();
        if(permission.speechRecognition!=="granted"){
          const requested=await SpeechRecognition.requestPermissions();
          if(requested.speechRecognition!=="granted"){setVoiceMessage("Microphone permission is required for voice commands.");setListening(false);return;}
        }
        const result=await SpeechRecognition.start({language:"en-US",maxResults:1,prompt:"Try “open coding tools” or “search for Claude”",popup:true});
        setListening(false);
        if(result.matches?.[0]) applyVoiceCommand(result.matches[0]);
        else setVoiceMessage("No speech was recognized. Tap the microphone to try again.");
        return;
      }
      const speechWindow=window as SpeechWindow;
      const Recognition=speechWindow.SpeechRecognition??speechWindow.webkitSpeechRecognition;
      if(!Recognition){setVoiceMessage("Voice commands need Chrome or the Android app.");setListening(false);return;}
      const recognition=new Recognition();
      recognition.lang="en-US";
      recognition.interimResults=false;
      recognition.maxAlternatives=1;
      recognition.onresult=event=>applyVoiceCommand(event.results[0]?.[0]?.transcript??"");
      recognition.onerror=()=>setVoiceMessage("Speech recognition failed. Check microphone access and try again.");
      recognition.onend=()=>setListening(false);
      recognition.start();
    }catch(error){
      setListening(false);
      setVoiceMessage(error instanceof Error?error.message:"Could not start speech recognition.");
    }
  }
  async function sendPrompt(){
    const clean=prompt.trim(); if(!clean)return;
    if(selected!=="ChatGPT"){setNotice(`${selected} is not connected yet. ChatGPT is currently the configured AI provider.`);return;}
    if(!supabase||!userId){setNotice("Sign in and configure the Supabase backend to use AI chat.");return;}
    const client=supabase;
    const previousMessages=messages;
    setMessages(old=>[...old,{role:"you",text:clean}]);
    setPrompt("");
    setChatBusy(true);
    try{
      const {data,error}=await client.functions.invoke("ai-chat",{
        body:{
          provider:"openai",
          message:clean,
          history:previousMessages.map(item=>({
            role:item.role==="you"?"user":"assistant",
            content:item.text
          }))
        }
      });
      if(error)throw new Error(error.message);
      if(!data||typeof data.text!=="string"||!data.text.trim())throw new Error("The AI service returned an empty response.");
      const completedMessages:ChatMessage[]=[
        ...previousMessages,
        {role:"you",text:clean},
        {role:"assistant",text:data.text}
      ];
      setMessages(completedMessages);
      const saved=conversationId
        ? await client.from("conversations")
          .update({messages:completedMessages,updated_at:new Date().toISOString()})
          .eq("id",conversationId).eq("user_id",userId)
        : await client.from("conversations")
          .insert({user_id:userId,provider:"openai",title:clean.slice(0,80),messages:completedMessages})
          .select("id").single();
      if(saved.error){setNotice(`AI replied, but the conversation could not be saved: ${saved.error.message}`);return;}
      if(!conversationId&&"data" in saved&&saved.data)setConversationId(saved.data.id);
    }catch(error){
      setMessages(previousMessages);
      setPrompt(clean);
      setNotice(error instanceof Error?error.message:"AI chat request failed.");
    }finally{
      setChatBusy(false);
    }
  }
  async function signIn(){if(!supabase){setNotice("Add your Supabase URL and anon key to .env.local, then restart the dev server.");return;}setAuthBusy(true);const {data,error}=await supabase.auth.signInWithPassword({email,password});setAuthBusy(false);setNotice(error?.message??"Signed in.");if(data.user)setUser(data.user.email??"Signed in");}
  async function signUp(){if(!supabase){setNotice("Configure Supabase in .env.local first.");return;}setAuthBusy(true);const {data,error}=await supabase.auth.signUp({email,password});setAuthBusy(false);setNotice(error?.message??"Check your email to confirm your account.");if(data.user)setUser(data.user.email??"Account created");}
  async function signOut(){const {error}=await supabase?.auth.signOut()??{error:null};if(error){setNotice(`Could not sign out: ${error.message}`);return;}setUser(null);setUserId(null);setFavs([]);setConversationId(null);setNotice("Signed out.");}
  const title = page==="Overview"?"Your AI command center":page;
  const featured = ["ChatGPT","Claude","Google Gemini","Perplexity AI"].map(n=>tools.find(t=>t.name===n)!);
  const cards = page==="Overview" ? featured : filtered;

  return <div className={dark?"app dark":"app light"}>
    <aside className={`sidebar ${mobile?"show":""}`}>
      <div className="brand"><div className="brand-icon"><Sparkles size={21}/></div><div><b>AI UNIVERSE</b><small>YOUR AI OPERATING SYSTEM</small></div><button className="mobile-close" onClick={()=>setMobile(false)}><X/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(item=><button key={item.name} className={`nav-item ${page===item.name?"active":""}`} onClick={()=>{setPage(item.name);setMobile(false);setQuery("");}}><item.icon size={18}/><span>{item.name}</span>{item.name==="Favourites"&&favs.length>0&&<em>{favs.length}</em>}</button>)}</nav>
      <div className="side-bottom"><div className="status"><span className="pulse"/> SYSTEM ONLINE <span className="status-right">v1.0</span></div><button className="nav-item" onClick={()=>setPage("Settings")}><Settings size={18}/>Settings</button><div className="profile-mini"><div className="avatar">U</div><div className="profile-text"><b>{user??"Guest explorer"}</b><small>{user?"Authenticated":"Local preview mode"}</small></div><button title="Sign out" onClick={signOut}><LogOut size={16}/></button></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMobile(true)}><Menu/></button><div className="crumb">UNIVERSE <span>/</span> {page.toUpperCase()}</div><div className="top-actions"><div className="secure-pill"><span/> {supabaseReady?"SUPABASE READY":"PREVIEW MODE"}</div><button className={`icon-btn voice-btn ${listening?"listening":""}`} title={listening?"Stop voice command":"Start voice command"} aria-label={listening?"Stop voice command":"Start voice command"} onClick={startVoiceCommand}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button><button className="icon-btn" title="Toggle theme" onClick={()=>setDark(!dark)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="avatar small-avatar" title="Profile">U</button></div></header>
      {voiceMessage&&<div className="voice-feedback" role="status" aria-live="polite">{voiceMessage}<button onClick={()=>setVoiceMessage("")} aria-label="Dismiss voice message"><X size={14}/></button></div>}
      <section className="content">
        {page==="Overview"&&<><div className="hero"><div className="eyebrow"><span className="sparkle-dot"/> THE FUTURE IS CONNECTED</div><h1>Every AI. One <span>Universe.</span></h1><p>Your command center for discovering, organizing, and launching the world's most powerful AI tools.</p><div className="hero-search"><Search size={19}/><input value={query} onChange={e=>{setQuery(e.target.value);setPage("AI Directory");}} placeholder="Search 30+ AI platforms, tools, and ideas..."/><button className={`hero-voice-btn ${listening?"listening":""}`} title={listening?"Stop voice command":"Search or navigate by voice"} aria-label={listening?"Stop voice command":"Search or navigate by voice"} onClick={startVoiceCommand}>{listening?<MicOff size={17}/>:<Mic size={17}/>}</button></div><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/></div>
          <div className="section-head"><div><div className="eyebrow">YOUR WORKSPACE</div><h2>Jump back in</h2></div><button className="text-link" onClick={()=>setPage("AI Directory")}>Explore directory <ArrowUpRight size={15}/></button></div>
          <div className="tool-grid featured-grid">{featured.map(t=><ToolCard key={t.name} tool={t} fav={favs.includes(t.name)} onFav={()=>toggleFav(t.name)} onOpen={()=>openTool(t)}/>)}</div>
          <div className="section-head"><div><div className="eyebrow">DISCOVER</div><h2>Explore the universe</h2></div></div>
          <div className="category-grid">{[{n:"Chat assistants",d:"Think, research & create",i:Bot,c:"violet"},{n:"Image generation",d:"Turn ideas into visuals",i:Image,c:"blue"},{n:"Video generation",d:"Bring stories to life",i:Video,c:"pink"},{n:"Coding",d:"Build faster with AI",i:Code2,c:"cyan"},{n:"Productivity",d:"Work smarter every day",i:Zap,c:"orange"}].map(x=><button className="category-card" key={x.n} onClick={()=>{setPage(x.n==="Chat assistants"?"AI Directory":x.n==="Image generation"?"Image Tools":x.n==="Video generation"?"Video Tools":x.n==="Coding"?"Coding Tools":"Productivity");setCategory("All categories");}}><div className={`category-icon ${x.c}`}><x.i size={20}/></div><b>{x.n}</b><small>{x.d}</small><ArrowUpRight size={16} className="cat-arrow"/></button>)}</div>
          <div className="section-head"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>Recently explored</h2></div></div><div className="recent-row">{recent.map(n=>{const t=tools.find(x=>x.name===n)!;return <button className="recent-chip" key={n} onClick={()=>openTool(t)}><span className="mini-mark">{t.mark}</span>{n}<ArrowUpRight size={13}/></button>})}</div>
        </>}
        {page==="Chat Workspace"&&<><div className="page-heading"><div className="eyebrow">AI CHAT WORKSPACE</div><h1>AI <span>Chat Studio</span></h1><p>ChatGPT responses are powered by your securely configured backend. Sign in to save conversation history.</p></div><div className="chat-layout"><div className="chat-models"><b>SELECT MODEL</b>{tools.filter(t=>t.category==="Chat assistants").map(t=><button className={selected===t.name?"model active":"model"} key={t.name} onClick={()=>{setSelected(t.name);setConversationId(null);setMessages([]);}}><span className="mini-mark">{t.mark}</span>{t.name}{selected===t.name&&<Check size={15}/>}</button>)}</div><div className="chat-panel"><div className="chat-top"><div><b>{selected}</b><small>{selected==="ChatGPT"&&supabaseReady&&userId?"Responses and history use your secure backend":"Provider setup required"}</small></div><span className="connection-tag">{selected==="ChatGPT"&&supabaseReady&&userId?"BACKEND READY":"NOT CONFIGURED"}</span></div><div className="chat-messages">{messages.length===0&&!chatBusy?<div className="empty-chat"><div className="empty-orb"><Sparkles size={28}/></div><h3>Start a conversation</h3><p>{!supabaseReady?"Configure Supabase, deploy the backend, and sign in to enable AI chat.":!userId?"Sign in from Settings to start an AI conversation.":selected!=="ChatGPT"?`${selected} is not configured yet. Choose ChatGPT to use the connected provider.`:"Send a message to ChatGPT. Your conversations are saved to your account."}</p></div>:messages.map((m,i)=><div className={`message ${m.role}`} key={i}><b>{m.role==="you"?"YOU":selected.toUpperCase()}</b><p>{m.text}</p></div>)}{chatBusy&&<div className="message assistant"><b>{selected.toUpperCase()}</b><p>Thinking…</p></div>}</div><div className="chat-compose"><textarea value={prompt} disabled={chatBusy} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void sendPrompt();}}} placeholder="Message your AI assistant..."/><button onClick={()=>void sendPrompt()} disabled={chatBusy||!prompt.trim()} aria-label="Send message"><Send size={17}/></button></div><small className="chat-note">AI requests require sign-in and a configured Supabase/OpenAI backend. Chats are stored in your account.</small></div></div></>}
        {page!=="Overview"&&page!=="Chat Workspace"&&page!=="Settings"&&<><div className="page-heading"><div className="eyebrow">THE AI DIRECTORY</div><h1>{page==="Favourites"?"Your saved":page==="AI Directory"?"Explore the":"Explore"} <span>{page==="Favourites"?"universe":page==="AI Directory"?"universe":page.toLowerCase()}</span></h1><p>Find the right tool for every idea. Open official platforms directly from one place.</p></div><div className="filters"><div className="directory-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search AI platforms..."/></div><select value={category} onChange={e=>setCategory(e.target.value)}><option>All categories</option>{["Chat assistants","Image generation","Video generation","Coding","Productivity"].map(x=><option key={x}>{x}</option>)}</select><select value={pricing} onChange={e=>setPricing(e.target.value)}><option>All pricing</option>{["Free","Freemium","Paid","Unknown"].map(x=><option key={x}>{x}</option>)}</select></div><div className="results-label">{filtered.length} PLATFORMS FOUND <span>• Listings open official websites</span></div><div className="tool-grid">{filtered.map(t=><ToolCard key={t.name} tool={t} fav={favs.includes(t.name)} onFav={()=>toggleFav(t.name)} onOpen={()=>openTool(t)}/>)}</div>{filtered.length===0&&<div className="empty-state"><Search size={25}/><h3>No platforms found</h3><p>Try another search or adjust your filters.</p></div>}</>}
        {page==="Settings"&&<><div className="page-heading"><div className="eyebrow">PREFERENCES & ACCOUNT</div><h1>Universe <span>settings</span></h1><p>Manage your account and personalize your workspace.</p></div><div className="settings-card"><h3>Appearance</h3><p>Choose the look of your workspace.</p><button className="setting-row" onClick={()=>setDark(!dark)}><span>{dark?"Dark mode":"Light mode"}</span><span className="setting-action">{dark?"Switch to light":"Switch to dark"} <ChevronDown size={15}/></span></button></div><div className="settings-card"><h3>Account & authentication</h3><p>Sign in with your Supabase account or create a new one.</p><input className="auth-input" type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/><input className="auth-input" type="password" placeholder="Password (minimum 6 characters)" value={password} onChange={e=>setPassword(e.target.value)}/><div className="auth-actions"><button className="primary-btn" disabled={authBusy} onClick={signIn}><LogIn size={16}/> Sign in</button><button className="secondary-btn" disabled={authBusy} onClick={signUp}>Create account</button></div>{notice&&<div className="notice">{notice}</div>}{user&&<div className="signed-in"><Check size={16}/> Signed in as {user}</div>}</div><div className="settings-card"><h3>Integration status</h3><p>External shortcuts work now. API-powered chat integrations require secure server-side provider setup.</p><div className="integration-line"><span>Supabase configuration</span><b className={supabaseReady?"good":"pending"}>{supabaseReady?"Configured":"Not configured"}</b></div><div className="integration-line"><span>AI provider APIs</span><b className="pending">Not connected</b></div></div></>}
        <footer><div className="footer-brand"><Sparkles size={15}/> AI UNIVERSE</div><span>EVERY AI. ONE UNIVERSE. <i>•</i> Built for limitless curiosity.</span><span>© 2026 AI UNIVERSE</span></footer>
      </section>
    </main>
    {notice&&page!=="Settings"&&<div className="toast" onClick={()=>setNotice("")}>{notice}<X size={14}/></div>}
  </div>;
}
function ToolCard({tool,fav,onFav,onOpen}:{tool:Tool;fav:boolean;onFav:()=>void;onOpen:()=>void}){
 return <article className="tool-card"><div className="card-top"><div className="tool-mark">{tool.mark}</div><button className={`fav-btn ${fav?"saved":""}`} onClick={onFav} aria-label={fav?"Remove favourite":"Add favourite"}><Heart size={17} fill={fav?"currentColor":"none"}/></button></div><div className="tool-title"><h3>{tool.name}</h3><span className="category-tag">{tool.category}</span></div><p>{tool.description}</p><div className="card-meta"><span>{tool.pricing}</span><span className="external-tag"><span/> {tool.access}</span></div><button className="open-btn" onClick={onOpen}>Open platform <ArrowUpRight size={15}/></button></article>;
}
export default App;