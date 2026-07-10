// frontend/src/App.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import KindnessGraph from './components/KindnessGraph';
import { supabase } from './supabaseClient';
import { Scanner } from '@yudiel/react-qr-scanner';

// =========================================================
// THE GLOBAL DAILY QUEST ENGINE
// Uses universal mathematics based on timezone constraints locking 1 specific quest per 24 hours globally worldwide synchronously 
// =========================================================
const DAILY_QUESTS = [
  "☕ Pay for someone's coffee/food behind you.",
  "✍️ Leave a positive handwritten note somewhere public.",
  "👞 Compliment a stranger's shoes or outfit.",
  "📞 Call or text 3 people just to say you appreciate them.",
  "🗑️ Pick up 3 pieces of trash outside today.",
  "🍪 Share snacks/treats with coworkers or classmates.",
  "🚪 Hold the door and greet 5 people warmly.",
  "💸 Leave an overly generous tip for a worker.",
  "🚙 Let a car safely merge ahead of you with a wave."
];
const getCurrentQuestIndex = () => Math.floor(Date.now() / 86400000) % DAILY_QUESTS.length;
const TODAYS_QUEST = DAILY_QUESTS[getCurrentQuestIndex()];

// =========================================================
// BRAWL STARS STYLE BUTTON RECREATED IN REACT/TAILWIND
// =========================================================
function BrawlButton({ text, icon, colorScheme, onClick, className = "", isLink = false, to, hideTextOnMobile = false }) {
  const palettes = {
    yellow: { top: '#FFE866', mid: '#FFCC00', bot: '#D68A00', textStroke: true },
    blue: { top: '#63B8FF', mid: '#2979FF', bot: '#003C8F', textStroke: true },
    pink: { top: '#FFB3D9', mid: '#FF66B2', bot: '#CC0066', textStroke: true },
    purple: { top: '#E6CCFF', mid: '#B266FF', bot: '#7F00FF', textStroke: true },
    green: { top: '#B9F6CA', mid: '#00E676', bot: '#00C853', textStroke: true },
    dark: { top: '#5A627B', mid: '#384055', bot: '#22283A', textStroke: true },
    white: { top: '#ffffff', mid: '#f8fafc', bot: '#94a3b8', textStroke: false }
  };
  const p = palettes[colorScheme] || palettes.blue;

  // FIX 1: Reduced borders on mobile, added dynamic Tailwind block shadows (2px for mobile, 5px for desktop)
  const baseClasses = `inline-flex items-center justify-center rounded-lg border-2 sm:border-[3px] border-black active:scale-95 transition-transform duration-75 shrink-0 whitespace-nowrap cursor-pointer select-none shadow-[-1px_1px_0_#000,-2px_2px_0_#000] sm:shadow-[-1px_1px_0_#000,-2px_2px_0_#000,-3px_3px_0_#000,-4px_4px_0_#000,-4px_5px_0_#000] ${className}`;

  // FIX 2: Removed inline boxShadow so Tailwind classes handle responsiveness!
  const buttonStyle = {
    transform: 'skewX(-8deg)',
    backgroundColor: p.bot, // Fallback base color to prevent gaps
    backgroundImage: `linear-gradient(to bottom, ${p.top} 0%, ${p.top} 15%, ${p.mid} 15%, ${p.mid} 82%, ${p.bot} 82%, ${p.bot} 100%)`
  };

  // FIX 3: Flawless 8-point stroke matrix (zero glitching/holes in the text shadow)
  const textStyle = p.textStroke ? {
    color: 'white',
    textShadow: `
      -1px -1px 0 #000,  0px -1px 0 #000,  1px -1px 0 #000,
      -1px  0px 0 #000,                    1px  0px 0 #000,
      -1px  1px 0 #000,  0px  1px 0 #000,  1px  1px 0 #000,
       0px  2px 0 #000,  0px  3px 0 #000
    `
  } : { color: 'black' };

  // Slightly increased padding and text size so they don't look cramped
  const content = (
    <div style={{ transform: 'skewX(8deg)' }} className="px-2 py-1.5 sm:px-4 sm:py-2 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[14px] font-black uppercase tracking-wider">
      {icon && <span className="drop-shadow-md text-sm sm:text-base">{icon}</span>}
      <span style={textStyle} className={hideTextOnMobile ? "hidden sm:inline-block" : "inline-block"}>{text}</span>
    </div>
  );

  if (isLink) {
    return <Link to={to} className={baseClasses} style={buttonStyle}>{content}</Link>;
  }
  return <button onClick={onClick} className={baseClasses} style={buttonStyle}>{content}</button>;
}
// =========================================================

const mockFallbackTree = {
  nodes: [
    { id: 'SEED-NODE', shape: 'hexagon', type: 'emoji', value: '🌱' }
  ],
  links: []
};
function SettingsModal({ session, onClose }) {
  const [activeTab, setActiveTab] = useState('profile'); // Gamified Tabs!
  const [name, setName] = useState(session?.user?.user_metadata?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(session?.user?.user_metadata?.avatar_url || '');
  
  const [kTag, setKTag] = useState('');
  const [oldKTag, setOldKTag] = useState('');
  const [isKtagLocked, setIsKtagLocked] = useState(false);
  const [lockDaysLeft, setLockDaysLeft] = useState(0);

  const initialSocials = session?.user?.user_metadata?.socials || {};
  const [instagram, setInstagram] = useState(initialSocials.instagram || '');
  const [twitter, setTwitter] = useState(initialSocials.twitter || '');
  const [youtube, setYoutube] = useState(initialSocials.youtube || '');
  const [facebook, setFacebook] = useState(initialSocials.facebook || '');
  const [website, setWebsite] = useState(initialSocials.website || '');

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const fetchNode = async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase.from('nodes').select('id, last_ktag_change').eq('user_id', session.user.id).eq('is_claimed', true).limit(1);
      if (data && data.length > 0) {
        setKTag(data[0].id); setOldKTag(data[0].id);
        const lastChange = data[0].last_ktag_change;
        if (lastChange) {
          const daysSince = (Date.now() - new Date(lastChange).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 7) { setIsKtagLocked(true); setLockDaysLeft(Math.ceil(7 - daysSince)); }
        }
      }
    };
    fetchNode();
  }, [session]);

  const handleAvatarUpload = async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      setIsUploading(true); setMsg('');
      const fileName = `${session?.user?.id || 'user'}-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      if (data?.publicUrl) { setAvatarUrl(data.publicUrl); setMsg('✅ Image uploaded!'); }
    } catch (error) { setMsg(`⚠️ Upload failed: ${error.message}`); } finally { setIsUploading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true); setMsg('');
    try {
      const socials = { instagram, twitter, youtube, facebook, website };
      let newMetadata = { full_name: name, avatar_url: avatarUrl, socials };
      let cleanNewTag = kTag.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
      
      if (!cleanNewTag) throw new Error("K-Tag cannot be empty.");
      if (cleanNewTag !== oldKTag) {
        if (isKtagLocked) throw new Error(`K-Tag locked for ${lockDaysLeft} days.`);
        if (cleanNewTag.length < 3) throw new Error("K-Tag must be 3+ chars.");
        const { data: existing } = await supabase.from('nodes').select('id').eq('id', cleanNewTag).limit(1);
        if (existing && existing.length > 0) throw new Error(`⚠️ "${cleanNewTag}" is taken!`);

        if (oldKTag) {
          const { error: updateErr } = await supabase.from('nodes').update({ id: cleanNewTag, socials }).eq('id', oldKTag);
          if (updateErr) throw new Error(updateErr.message || "Failed to update K-Tag.");
        } else {
           await supabase.from('nodes').insert({ id: cleanNewTag, user_id: session.user.id, shape: 'circle', type: 'image', value: avatarUrl, socials, is_claimed: true });
        }
        setOldKTag(cleanNewTag); setIsKtagLocked(true); setLockDaysLeft(7);
      } else if (oldKTag) {
        await supabase.from('nodes').update({ socials }).eq('id', oldKTag);
      }
      await supabase.auth.updateUser({ data: newMetadata });
      onClose();
    } catch (error) { setMsg(`⚠️ ${error.message}`); } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg relative animate-in zoom-in duration-200">
        
        {/* TABS (Brawl Stars Slanted Style) */}
        <div className="flex gap-2 mb-[-10px] relative z-10 pl-4">
          <button onClick={() => setActiveTab('profile')} style={{ transform: 'skewX(-10deg)' }} className={`px-6 py-3 border-4 border-black font-black uppercase text-sm cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all ${activeTab === 'profile' ? 'bg-cyan-400 text-black -translate-y-2' : 'bg-slate-300 text-slate-600 hover:bg-slate-200'}`}>
            <span style={{ transform: 'skewX(10deg)' }} className="inline-block">Identity</span>
          </button>
          <button onClick={() => setActiveTab('socials')} style={{ transform: 'skewX(-10deg)' }} className={`px-6 py-3 border-4 border-black font-black uppercase text-sm cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all ${activeTab === 'socials' ? 'bg-pink-400 text-black -translate-y-2' : 'bg-slate-300 text-slate-600 hover:bg-slate-200'}`}>
            <span style={{ transform: 'skewX(10deg)' }} className="inline-block">Social Links</span>
          </button>
        </div>

        {/* MAIN GAMIFIED CARD */}
        <div className="bg-white border-4 border-black rounded-3xl p-6 shadow-[12px_12px_0px_rgba(0,0,0,1)] relative z-20">
          <button onClick={onClose} className="absolute -top-4 -right-4 bg-red-500 text-white border-4 border-black rounded-full w-12 h-12 flex items-center justify-center font-black text-2xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform cursor-pointer">✖</button>
          
          {msg && <div className="mb-4 text-xs font-black bg-yellow-300 p-3 border-4 border-black rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)] transform -rotate-1">{msg}</div>}
          
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            
            {/* TAB 1: PROFILE */}
            {activeTab === 'profile' && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-left-4">
                <div className="bg-cyan-50 border-4 border-black p-4 rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                  <label className="text-xs font-black uppercase flex justify-between">Your K-Tag {isKtagLocked && <span className="text-red-500">🔒 Locked ({lockDaysLeft}d)</span>}</label>
                  <input type="text" value={kTag} onChange={e => setKTag(e.target.value)} disabled={isKtagLocked} className={`w-full border-4 border-black rounded-xl p-3 mt-2 font-black uppercase shadow-[inset_2px_2px_0px_rgba(0,0,0,0.1)] ${isKtagLocked ? 'bg-slate-200 text-slate-400' : 'bg-white'}`} />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">Display Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full border-4 border-black rounded-xl p-3 font-bold bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] focus:bg-cyan-50 mt-1" />
                </div>
                <div className="flex gap-4 items-center">
                  <img src={avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} className="w-16 h-16 rounded-2xl border-4 border-black object-cover shadow-[4px_4px_0px_rgba(0,0,0,1)] bg-yellow-300" />
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase">Avatar URL or Upload</label>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="w-full text-[10px] mt-1 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-2 file:border-black file:bg-yellow-300 file:font-black cursor-pointer" />
                    <input type="url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." className="w-full border-2 border-black rounded-lg p-2 font-bold text-xs mt-1" />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SOCIALS */}
            {activeTab === 'socials' && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-right-4">
                {[{l:'Instagram', i:'📸', v:instagram, s:setInstagram, c:'pink'}, {l:'Twitter', i:'🐦', v:twitter, s:setTwitter, c:'cyan'}, {l:'YouTube', i:'🔴', v:youtube, s:setYoutube, c:'red'}, {l:'Facebook', i:'📘', v:facebook, s:setFacebook, c:'blue'}].map(s => (
                  <div key={s.l} className={`bg-${s.c}-50 border-4 border-black rounded-xl p-3 shadow-[4px_4px_0px_rgba(0,0,0,1)]`}>
                    <label className="text-[10px] font-black uppercase flex items-center gap-1">{s.i} {s.l}</label>
                    <input type="text" value={s.v} onChange={e => s.s(e.target.value)} className="w-full bg-white border-2 border-black rounded-lg p-2 mt-1 font-bold text-xs" />
                  </div>
                ))}
                <div className="col-span-2 bg-lime-50 border-4 border-black rounded-xl p-3 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                  <label className="text-[10px] font-black uppercase">🌐 Website</label>
                  <input type="url" value={website} onChange={e => setWebsite(e.target.value)} className="w-full bg-white border-2 border-black rounded-lg p-2 mt-1 font-bold text-xs" />
                </div>
              </div>
            )}

            <button type="submit" disabled={isLoading || isUploading} className="mt-4 bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-black text-xl font-black py-4 rounded-xl border-4 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all uppercase tracking-widest cursor-pointer transform -rotate-1">
              {isLoading ? 'Saving...' : 'Confirm Update ⚡'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- TUTORIAL MODAL ---
function TutorialModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border-2 sm:border-4 border-black rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_rgba(0,0,0,1)] w-[95%] sm:w-full max-w-2xl relative transform sm:-rotate-1 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 bg-red-400 text-black border-4 border-black rounded-full w-10 h-10 flex items-center justify-center font-black text-xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform z-10">
          ✖
        </button>
        <h2 className="text-2xl sm:text-3xl font-black mb-6 uppercase tracking-tight w-max bg-yellow-300 px-4 py-2 border-2 border-black rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)] transform rotate-2">
          📖 How It Works
        </h2>
        
        <div className="flex flex-col gap-6 transform rotate-1 mt-4">
          <div className="bg-lime-100 p-5 border-4 border-black rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            <h3 className="text-xl font-black mb-2 uppercase">1️⃣ Start a Chain</h3>
            <p className="font-bold text-slate-700">Do something nice for someone! Then, click "Join Chain" and select <b>"🔥 Start a Chain"</b>. Customize your node and get your unique <b>K-Tag</b> (like PUNE-ROCKY).</p>
          </div>
          
          <div className="bg-cyan-100 p-5 border-4 border-black rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            <h3 className="text-xl font-black mb-2 uppercase">2️⃣ Pass it On</h3>
            <p className="font-bold text-slate-700">Tell the person you helped to pay it forward. Give them your <b>K-Tag</b> so they can link their good deed to yours on the global map.</p>
          </div>
          
          <div className="bg-pink-100 p-5 border-4 border-black rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            <h3 className="text-xl font-black mb-2 uppercase">3️⃣ I Was Helped</h3>
            <p className="font-bold text-slate-700">If someone helped you, click "Join Chain" then <b>"🥺 I Was Helped"</b>. Enter their K-Tag, then create your own. Watch the network grow!</p>
          </div>
          
          <button onClick={onClose} className="mt-4 bg-black text-white text-xl font-black py-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all uppercase tracking-widest">
            Got it, let's go! 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
// --- NODE DETAILS & SOCIAL LINKS MODAL ---
function NodeDetailsModal({ node, onClose }) {
  if (!node || node.ghost) return null;
  
  // SECURED: Declares correctly so Vite avoids dead initialization logic, actively passing errors functionally 
  let socials;
  try {
    socials = typeof node.socials === 'string' ? JSON.parse(node.socials) : (node.socials || {});
  } catch (parseError) {
    console.warn("Fallback defaults populated for connections mapping", parseError);
    socials = {};
  }

  // Check if at least one link actually contains text
  const hasLinks = Boolean(
    socials.instagram?.trim() || 
    socials.twitter?.trim() || 
    socials.youtube?.trim() || 
    socials.facebook?.trim() || 
    socials.website?.trim()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border-4 border-black rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-sm relative transform -rotate-1">
        <button onClick={onClose} className="absolute -top-3 -right-3 bg-red-400 text-black border-4 border-black rounded-full w-10 h-10 flex items-center justify-center font-black text-xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform z-10 cursor-pointer">
          ✖
        </button>
        
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full border-4 border-black bg-yellow-300 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center justify-center overflow-hidden mb-3">
            {node.type === 'emoji' ? (
              <span className="text-4xl">{node.value}</span>
            ) : node.type === 'image' ? (
              <img src={node.value} alt={node.id} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ backgroundColor: node.value }}></div>
            )}
          </div>

          <p className="bg-lime-300 border-2 border-black rounded-lg px-3 py-1 font-black text-lg uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] tracking-wide mb-1">
            {node.id}
          </p>
          <p className="text-xs font-bold text-slate-600 mb-6 uppercase tracking-wider">
            Kindness Impact: {node.impactCount || 0} Connected
          </p>

          <h3 className="font-black text-sm uppercase mb-3 text-black">🌐 Connect with Helper</h3>

          <div className="flex flex-wrap items-center justify-center gap-2 w-full">
            {socials.instagram?.trim() && (
              <a href={socials.instagram} target="_blank" rel="noopener noreferrer" 
                className="bg-pink-400 hover:bg-pink-300 text-black border-2 border-black rounded-xl px-3 py-2 font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5">
                📸 Instagram
              </a>
            )}
            {socials.twitter?.trim() && (
              <a href={socials.twitter} target="_blank" rel="noopener noreferrer" 
                className="bg-cyan-300 hover:bg-cyan-200 text-black border-2 border-black rounded-xl px-3 py-2 font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5">
                🐦 Twitter / X
              </a>
            )}
            {socials.youtube?.trim() && (
              <a href={socials.youtube} target="_blank" rel="noopener noreferrer" 
                className="bg-red-400 hover:bg-red-300 text-black border-2 border-black rounded-xl px-3 py-2 font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5">
                🔴 YouTube
              </a>
            )}
            {socials.facebook?.trim() && (
              <a href={socials.facebook} target="_blank" rel="noopener noreferrer" 
                className="bg-blue-400 hover:bg-blue-300 text-black border-2 border-black rounded-xl px-3 py-2 font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5">
                📘 Facebook
              </a>
            )}
            {socials.website?.trim() && (
              <a href={socials.website} target="_blank" rel="noopener noreferrer" 
                className="bg-yellow-300 hover:bg-yellow-200 text-black border-2 border-black rounded-xl px-3 py-2 font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5">
                🌐 Website
              </a>
            )}

            {!hasLinks && (
              <p className="text-xs font-bold text-slate-500 italic bg-slate-100 p-3 rounded-xl border-2 border-black border-dashed w-full">
                No social links added by this user yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function NodeManagerModal({ session, onClose, onRefreshGraph }) {
  const [activeTab, setActiveTab] = useState('owned'); 
  const [myNodes, setMyNodes] = useState([]);
  const [myLinks, setMyLinks] = useState([]);
  const [claimTag, setClaimTag] = useState('');
  const [claimPin, setClaimPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmBreak, setConfirmBreak] = useState(null); // 💥 GAMIFIED POPUP STATE

  const fetchMyNodes = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from('nodes').select('*').or(`user_id.eq.${session.user.id},created_by.eq.${session.user.id}`).order('is_claimed', { ascending: false });
    if (data) {
      setMyNodes(data);
      const nodeIds = data.map(n => n.id);
      if (nodeIds.length > 0) {
        // Fetch all chains where the user is either the helper or the one being helped
        const { data: linksSource } = await supabase.from('links').select('*').in('source', nodeIds);
        const { data: linksTarget } = await supabase.from('links').select('*').in('target', nodeIds);
        const allLinks = [...(linksSource || []), ...(linksTarget || [])].filter((v,i,a) => a.findIndex(v2 => (v2.source === v.source && v2.target === v.target)) === i);
        setMyLinks(allLinks);
      }
    }
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    queueMicrotask(() => { if (isMounted) fetchMyNodes(); });
    return () => { isMounted = false; };
  }, [fetchMyNodes]);

  const executeBreakChain = async () => {
    if (!confirmBreak) return;
    setIsLoading(true); setMsg('');
    try {
      const { error } = await supabase.from('links').delete().match({ source: confirmBreak.source, target: confirmBreak.target });
      if (error) throw error;
      setMsg(`💔 Chain successfully broken.`);
      fetchMyNodes();
      if (onRefreshGraph) onRefreshGraph();
    } catch (err) { setMsg(`⚠️ ${err.message}`); } finally { 
      setIsLoading(false); 
      setConfirmBreak(null); 
    }
  };

  const handleMerge = async (e) => {
    e.preventDefault(); if (!claimTag.trim()) return;
    setIsLoading(true); setMsg('');
    const targetTag = myNodes[0]?.id; const sourceTag = claimTag.toUpperCase().trim(); const enteredPin = claimPin.toUpperCase().trim();
    if (!targetTag) { setMsg('⚠️ Missing primary node.'); setIsLoading(false); return; }
    try {
      const { data: nodeData, error } = await supabase.from('nodes').select('*').eq('id', sourceTag).single();
      if (error || !nodeData) throw new Error("Node not found!");
      if (nodeData.is_claimed) throw new Error("Already claimed.");
      if (nodeData.claim_pin !== enteredPin) throw new Error("Incorrect PIN!");

      await supabase.from('links').update({ source: targetTag }).eq('source', sourceTag);
      await supabase.from('links').update({ target: targetTag }).eq('target', sourceTag);
      await supabase.from('nodes').delete().eq('id', sourceTag);

      setMsg(`🎉 ${sourceTag} Merged!`); setClaimTag(''); setClaimPin(''); fetchMyNodes(); if (onRefreshGraph) onRefreshGraph();
    } catch (err) { setMsg(`⚠️ ${err.message}`); } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      
      {/* 💥 GAMIFIED BREAK CHAIN CONFIRMATION MODAL */}
      {confirmBreak && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto">
           <div className="bg-white border-4 border-black p-6 rounded-3xl shadow-[12px_12px_0px_rgba(0,0,0,1)] transform rotate-1 w-full max-w-sm text-center relative animate-in zoom-in duration-200">
              <button onClick={() => setConfirmBreak(null)} disabled={isLoading} className="absolute -top-4 -right-4 bg-red-500 text-white border-4 border-black rounded-full w-12 h-12 flex items-center justify-center font-black text-2xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] cursor-pointer z-10 disabled:opacity-50">✖</button>
              
              <h3 className="text-2xl font-black uppercase mb-4 tracking-widest text-black">Break Chain?</h3>
              <div className="bg-red-50 border-4 border-black rounded-2xl p-6 mb-6 shadow-[inset_4px_4px_0px_rgba(0,0,0,0.1)] flex flex-col items-center">
                 <div className="text-6xl mb-3 drop-shadow-md">💔</div>
                 <div className="font-black uppercase text-lg text-black text-center leading-tight">
                   Are you sure you want to sever this connection?
                 </div>
                 <div className="mt-4 flex items-center gap-2 bg-white border-2 border-black rounded-lg px-3 py-1 font-black text-xs uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                   <span className="text-cyan-600">{confirmBreak.source}</span>
                   <span>➔</span>
                   <span className="text-pink-600">{confirmBreak.target}</span>
                 </div>
              </div>

              <div className="flex gap-4">
                 <button onClick={() => setConfirmBreak(null)} disabled={isLoading} className="flex-1 py-4 font-black uppercase text-lg rounded-xl border-4 border-black bg-slate-200 text-slate-700 hover:bg-slate-300 shadow-[4px_4px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all cursor-pointer disabled:opacity-50">Cancel</button>
                 <button onClick={executeBreakChain} disabled={isLoading} className="flex-1 py-4 font-black uppercase text-lg rounded-xl border-4 border-black bg-red-500 text-white hover:bg-red-400 shadow-[4px_4px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all cursor-pointer disabled:opacity-50">
                   {isLoading ? 'Wait...' : 'Break It 💥'}
                 </button>
              </div>
           </div>
        </div>
      )}

      <div className="w-full max-w-lg relative animate-in zoom-in duration-200">
        
        <div className="flex gap-1.5 sm:gap-2 mb-[-10px] relative z-10 pl-2 sm:pl-4 overflow-x-auto pb-4 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button onClick={() => setActiveTab('owned')} style={{ transform: 'skewX(-10deg)' }} className={`px-3 sm:px-6 py-2.5 sm:py-3 border-4 border-black font-black uppercase text-[10px] sm:text-sm cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all shrink-0 snap-start ${activeTab === 'owned' ? 'bg-purple-400 text-black -translate-y-2' : 'bg-slate-300 text-slate-600 hover:bg-slate-200'}`}>
            <span style={{ transform: 'skewX(10deg)' }} className="inline-block">My Nodes</span>
          </button>
          <button onClick={() => setActiveTab('chains')} style={{ transform: 'skewX(-10deg)' }} className={`px-3 sm:px-6 py-2.5 sm:py-3 border-4 border-black font-black uppercase text-[10px] sm:text-sm cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all shrink-0 snap-start ${activeTab === 'chains' ? 'bg-pink-400 text-black -translate-y-2' : 'bg-slate-300 text-slate-600 hover:bg-slate-200'}`}>
            <span style={{ transform: 'skewX(10deg)' }} className="inline-block">Active Chains</span>
          </button>
          <button onClick={() => setActiveTab('merge')} style={{ transform: 'skewX(-10deg)' }} className={`px-3 sm:px-6 py-2.5 sm:py-3 border-4 border-black font-black uppercase text-[10px] sm:text-sm cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all shrink-0 snap-start ${activeTab === 'merge' ? 'bg-yellow-400 text-black -translate-y-2' : 'bg-slate-300 text-slate-600 hover:bg-slate-200'}`}>
            <span style={{ transform: 'skewX(10deg)' }} className="inline-block">Merge Loot</span>
          </button>
        </div>

        <div className="bg-white border-4 border-black rounded-3xl p-4 sm:p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] sm:shadow-[12px_12px_0px_rgba(0,0,0,1)] relative z-20 max-h-[75vh] overflow-y-auto">
          <button onClick={onClose} className="absolute -top-4 -right-4 bg-red-500 text-white border-4 border-black rounded-full w-12 h-12 flex items-center justify-center font-black text-2xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] cursor-pointer">✖</button>
          {msg && <div className="mb-4 text-xs font-black bg-yellow-300 p-3 border-4 border-black rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">{msg}</div>}

          {activeTab === 'chains' ? (
            <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2">
              <h3 className="font-black text-sm uppercase text-slate-500 mb-2">Manage Your Connections</h3>
              {myLinks.length > 0 ? myLinks.map((link, idx) => {
                const isHelper = myNodes.some(n => n.id === link.source);
                return (
                  <div key={`${link.source}-${link.target}-${idx}`} className="border-4 border-black rounded-2xl p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] bg-pink-50 flex flex-col gap-3">
                    <div className="flex justify-between items-center bg-white border-2 border-black rounded-xl p-2 font-black text-xs sm:text-sm uppercase shadow-[inset_2px_2px_0px_rgba(0,0,0,0.1)]">
                      <span className="text-cyan-600 truncate max-w-[40%]">{link.source}</span>
                      <span>➔</span>
                      <span className="text-pink-600 truncate max-w-[40%]">{link.target}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] font-black uppercase bg-slate-200 text-slate-800 px-2 py-1 rounded-lg border-2 border-black shadow-[1px_1px_0px_rgba(0,0,0,1)]">{isHelper ? 'You Helped' : 'Helped You'}</span>
                      <button onClick={() => setConfirmBreak({ source: link.source, target: link.target })} disabled={isLoading} className="bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg border-2 border-black font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] active:scale-95 cursor-pointer transition-transform">
                        Break Chain 💔
                      </button>
                    </div>
                  </div>
                );
              }) : <p className="text-center font-black text-slate-400 py-4 uppercase text-sm">No active chains found.</p>}
            </div>
          ) : activeTab === 'owned' ? (
            <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2">
              {myNodes.length > 0 ? myNodes.map(n => {
                const isUnclaimed = !n.is_claimed || !!n.claim_pin;
                const isPrimary = !isUnclaimed && n.user_id === session?.user?.id;
                return (
                  <div key={n.id} className={`border-4 border-black rounded-2xl p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] ${isPrimary ? 'bg-lime-100' : 'bg-slate-50'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-black text-lg uppercase tracking-widest">{n.id}</span>
                      {isPrimary && <span className="text-[10px] bg-lime-400 border-2 border-black px-2 py-1 rounded-lg font-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">PRIMARY</span>}
                      {isUnclaimed && <span className="text-[10px] bg-yellow-400 border-2 border-black px-2 py-1 rounded-lg font-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">UNCLAIMED</span>}
                    </div>
                    {isUnclaimed && (
                       <div className="bg-white border-2 border-black border-dashed rounded-lg p-2 flex justify-between items-center text-xs font-black">
                         <span>PIN: <span className="text-pink-500">{n.claim_pin}</span></span>
                         <button onClick={() => navigator.clipboard.writeText(`Tag: ${n.id} | PIN: ${n.claim_pin}`)} className="bg-black text-white px-3 py-1 rounded cursor-pointer active:scale-95">Copy</button>
                       </div>
                    )}
                  </div>
                );
              }) : <p className="text-center font-black text-slate-400 py-4">No nodes found.</p>}
            </div>
          ) : (
            <form onSubmit={handleMerge} className="flex flex-col gap-4">
              <div className="bg-yellow-50 border-4 border-black border-dashed p-4 rounded-2xl">
                <p className="text-xs font-black uppercase text-slate-700 mb-3 text-center">Merge an unclaimed node into your profile!</p>
                <input type="text" placeholder="K-Tag (e.g. SARAH-9921)" value={claimTag} onChange={e => setClaimTag(e.target.value)} required className="w-full border-4 border-black rounded-xl p-3 uppercase font-black focus:bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] mb-4" />
                <input type="text" placeholder="Secret PIN" value={claimPin} onChange={e => setClaimPin(e.target.value)} required className="w-full border-4 border-black rounded-xl p-3 uppercase font-black focus:bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)]" />
              </div>
              <button type="submit" disabled={isLoading} className="bg-yellow-400 hover:bg-yellow-300 text-black text-xl font-black py-4 rounded-xl border-4 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all uppercase tracking-widest cursor-pointer transform rotate-1">
                {isLoading ? 'Verifying...' : 'Merge Loot 💰'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
function RequestsModal({ session, onClose, onRefreshGraph }) {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data: myNodes } = await supabase.from('nodes').select('id').or(`user_id.eq.${session.user.id},created_by.eq.${session.user.id}`);
    if (!myNodes || myNodes.length === 0) return;
    const { data: pendingLinks } = await supabase.from('links').select('*').in('source', myNodes.map(n => n.id)).eq('status', 'pending');
    if (pendingLinks) setPendingRequests(pendingLinks);
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    queueMicrotask(() => { if (isMounted) fetchRequests(); });
    return () => { isMounted = false; };
  }, [fetchRequests]);

  const handleAction = async (req, isApprove) => {
    setIsLoading(true);
    await supabase.rpc(isApprove ? 'approve_link_request' : 'decline_link_request', { link_source: req.source, link_target: req.target });
    fetchRequests(); if (onRefreshGraph) onRefreshGraph();
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white border-4 border-black rounded-3xl p-6 shadow-[12px_12px_0px_rgba(0,0,0,1)] w-full max-w-2xl relative transform -rotate-1">
        <button onClick={onClose} className="absolute -top-4 -right-4 bg-red-500 text-white border-4 border-black rounded-full w-12 h-12 flex items-center justify-center font-black text-2xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] cursor-pointer z-10">✖</button>
        
        <div className="bg-blue-400 text-white border-4 border-black inline-block px-6 py-2 rounded-xl font-black text-xl uppercase tracking-widest shadow-[4px_4px_0px_rgba(0,0,0,1)] transform rotate-2 mb-6">
          🔔 Bounty Board
        </div>

        {pendingRequests.length > 0 ? (
          <div className="flex overflow-x-auto snap-x gap-4 pb-4 px-2">
            {pendingRequests.map(req => (
              <div key={`${req.source}-${req.target}`} className="snap-center shrink-0 w-64 bg-yellow-50 border-4 border-black rounded-2xl p-4 shadow-[6px_6px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                <div>
                  <div className="text-center font-black text-2xl mb-2">🎯</div>
                  <p className="text-[11px] font-black uppercase text-slate-800 text-center mb-4 leading-tight">
                    <span className="text-pink-600 text-sm block">{req.target}</span> claims you helped them via <span className="text-cyan-600">{req.source}</span>!
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction(req, true)} disabled={isLoading} className="flex-1 bg-lime-400 border-2 border-black rounded-xl py-3 font-black text-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] active:scale-95 cursor-pointer">✅</button>
                  <button onClick={() => handleAction(req, false)} disabled={isLoading} className="flex-1 bg-red-400 border-2 border-black rounded-xl py-3 font-black text-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] active:scale-95 cursor-pointer">❌</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-100 border-4 border-black border-dashed rounded-2xl p-8 text-center shadow-[inset_4px_4px_0px_rgba(0,0,0,0.1)]">
            <span className="text-4xl block mb-2">🏜️</span>
            <p className="font-black text-slate-400 uppercase tracking-widest">No pending bounties.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LogKindnessForm({ onComplete, session, isAuthLoading }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('helped_me'); // 'helped_me' or 'i_helped'
  
  const [targetId, setTargetId] = useState('');
  const [isAnonymousTarget, setIsAnonymousTarget] = useState(false);
  const [targetPin, setTargetPin] = useState(''); 
  const [deedComment, setDeedComment] = useState('');
  const [completedQuest, setCompletedQuest] = useState(false);
  
  const [myId, setMyId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [claimModalUrl, setClaimModalUrl] = useState('');
  const [existingTags, setExistingTags] = useState([]);

  useEffect(() => {
    const fetchTags = async () => {
      const { data } = await supabase.from('nodes').select('id, is_claimed');
      if (data) setExistingTags(data);
      if (session?.user?.id) {
        const { data: userNodes } = await supabase.from('nodes').select('id').eq('user_id', session.user.id).eq('is_claimed', true).limit(1);
        if (userNodes && userNodes.length > 0) setMyId(userNodes[0].id);
      }
    };
    fetchTags();
  }, [session]);

  const isNewTarget = isAnonymousTarget || (targetId.trim() !== '' && !existingTags.some(n => n.id === targetId.trim().toUpperCase()));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAnonymousTarget && !targetId.trim()) { setErrorMsg("Enter their K-Tag or choose Anonymous!"); return; }
    setIsLoading(true); setErrorMsg('');
    
    const finalMyId = myId.toUpperCase().trim();
    const finalTargetId = isAnonymousTarget ? `ANON-${Math.floor(10000 + Math.random() * 90000)}` : targetId.toUpperCase().trim();
    const submittingNewTarget = isAnonymousTarget || (finalTargetId !== '' && !existingTags.some(n => n.id === finalTargetId));

    try {
      // Determine Link Direction
      const sourceId = mode === 'helped_me' ? finalTargetId : finalMyId;
      const destinationId = mode === 'helped_me' ? finalMyId : finalTargetId;

      if (submittingNewTarget) {
        const secretPin = targetPin.trim() ? targetPin.toUpperCase().trim() : 'PIN-' + Math.floor(100000 + Math.random() * 900000);
        
        // Create the unclaimed node for the other person
        const { error: unclaimedErr } = await supabase.from('nodes').insert({ 
          id: finalTargetId, user_id: session.user.id, shape: 'circle', type: 'emoji', 
          value: isAnonymousTarget ? '🕵️‍♂️' : '🌱', is_claimed: false, claim_pin: secretPin, created_by: session.user.id 
        });
        if (unclaimedErr && unclaimedErr.code !== '23505') throw unclaimedErr;
        
        // Link them (Now defaults to #000000 Black)
        await supabase.rpc('log_kindness_link', { p_source: sourceId, p_target: destinationId, p_color: '#000000', p_comment: deedComment, p_is_quest: completedQuest });
        
        // Show them the claim link so they can give it to the person!
        if (!isAnonymousTarget) {
          setClaimModalUrl(`Tag: ${finalTargetId} | PIN: ${secretPin} | Link: ${window.location.origin}?claimTag=${finalTargetId}`);
        } else {
          onComplete({ myId: finalMyId, helperId: finalTargetId, isOriginator: mode === 'i_helped' });
          navigate('/dashboard');
        }
      } else {
        // Target already exists, just link! (Defaults to #000000 Black)
        await supabase.rpc('log_kindness_link', { p_source: sourceId, p_target: destinationId, p_color: '#000000', p_comment: deedComment, p_is_quest: completedQuest });
        onComplete({ myId: finalMyId, helperId: finalTargetId, isOriginator: mode === 'i_helped' });
        navigate('/dashboard');
      }
    } catch (error) { setErrorMsg(error.message); } finally { setIsLoading(false); }
  };

  if (isAuthLoading || !session) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-4">
      {/* SUCCESS MODAL FOR UNCLAIMED NODES */}
      {claimModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-yellow-400 border-4 border-black rounded-3xl p-8 shadow-[12px_12px_0px_rgba(0,0,0,1)] text-center transform -rotate-1 max-w-md animate-in zoom-in duration-200">
            <h2 className="text-3xl font-black uppercase mb-2">🎉 Loot Dropped!</h2>
            <p className="text-sm font-bold text-slate-800 mb-6 bg-white border-4 border-black p-4 rounded-xl shadow-[inset_4px_4px_0px_rgba(0,0,0,0.1)]">
              We created an Unclaimed Node for <b>{targetId}</b>. Share this claim code with them so they can officially join your chain!
            </p>
            <input type="text" readOnly value={claimModalUrl} className="w-full border-4 border-black rounded-xl p-3 font-black text-xs bg-white mb-4 text-center select-all" />
            <div className="flex gap-4">
              <button onClick={() => { navigator.clipboard.writeText(claimModalUrl); alert('Copied!'); }} className="flex-1 bg-white border-4 border-black rounded-xl py-3 font-black uppercase shadow-[4px_4px_0px_rgba(0,0,0,1)] active:scale-95 cursor-pointer">Copy</button>
              <button onClick={() => { setClaimModalUrl(''); onComplete({ myId, helperId: targetId, isOriginator: mode === 'i_helped' }); navigate('/dashboard'); }} className="flex-1 bg-black text-white border-4 border-black rounded-xl py-3 font-black uppercase shadow-[4px_4px_0px_rgba(0,0,0,1)] active:scale-95 cursor-pointer">Done 🚀</button>
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 mb-[-10px] relative z-10 pl-4 justify-center">
        <button onClick={() => setMode('helped_me')} style={{ transform: 'skewX(-10deg)' }} className={`px-6 py-3 border-4 border-black font-black uppercase text-xs sm:text-sm cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all ${mode === 'helped_me' ? 'bg-cyan-400 text-black -translate-y-2' : 'bg-slate-300 text-slate-600 hover:bg-slate-200'}`}>
          <span style={{ transform: 'skewX(10deg)' }} className="inline-block">🥺 I Was Helped</span>
        </button>
        <button onClick={() => setMode('i_helped')} style={{ transform: 'skewX(-10deg)' }} className={`px-6 py-3 border-4 border-black font-black uppercase text-xs sm:text-sm cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all ${mode === 'i_helped' ? 'bg-pink-400 text-black -translate-y-2' : 'bg-slate-300 text-slate-600 hover:bg-slate-200'}`}>
          <span style={{ transform: 'skewX(10deg)' }} className="inline-block">🦸‍♂️ I Helped Someone</span>
        </button>
      </div>

      {/* MAIN GAMIFIED CARD */}
      <div className="bg-white border-4 border-black rounded-3xl p-6 sm:p-8 shadow-[12px_12px_0px_rgba(0,0,0,1)] relative z-20">
        <button onClick={() => navigate('/')} className="absolute -top-4 -right-4 bg-red-500 text-white border-4 border-black rounded-full w-12 h-12 flex items-center justify-center font-black text-2xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform cursor-pointer">✖</button>
        
        {errorMsg && <div className="mb-4 text-sm font-black text-white bg-red-500 p-3 border-4 border-black rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)] transform -rotate-1 text-center">⚠️ {errorMsg}</div>}
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 animate-in slide-in-from-bottom-4 duration-300">
          
          <div className={`border-4 border-black p-5 rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)] ${mode === 'helped_me' ? 'bg-cyan-50' : 'bg-pink-50'}`}>
            <label className="block text-sm font-black uppercase mb-2">
              {mode === 'helped_me' ? "Who Helped You?" : "Who Did You Help?"}
            </label>
            <input 
              type="text" 
              placeholder="Search or Type their K-Tag..." 
              value={isAnonymousTarget ? 'ANONYMOUS 🕵️‍♂️' : targetId} 
              onChange={e => setTargetId(e.target.value.toUpperCase())} 
              disabled={isAnonymousTarget} 
              className="w-full border-4 border-black rounded-xl p-3 uppercase font-black bg-white shadow-[inset_2px_2px_0px_rgba(0,0,0,0.1)] focus:outline-none" 
            />
            
            <div className="mt-3 flex items-center gap-2">
              <input type="checkbox" id="anon" checked={isAnonymousTarget} onChange={e => { setIsAnonymousTarget(e.target.checked); setTargetId(''); }} className="w-5 h-5 accent-pink-500 border-2 border-black rounded cursor-pointer" />
              <label htmlFor="anon" className="text-[10px] font-black uppercase cursor-pointer">Don't know their Tag? (Make Anonymous)</label>
            </div>

            {isNewTarget && !isAnonymousTarget && targetId && (
              <div className="mt-4 bg-yellow-100 border-2 border-black border-dashed p-3 rounded-xl">
                <label className="text-[10px] font-black uppercase text-slate-800">Set a Secret PIN for them to claim this node later (Optional)</label>
                <input type="text" placeholder="e.g. 1234 or leave blank" value={targetPin} onChange={e => setTargetPin(e.target.value)} className="w-full border-2 border-black rounded-lg p-2 mt-1 uppercase font-black text-xs bg-white" />
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-yellow-300 to-amber-400 p-5 rounded-2xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center gap-4 transform rotate-1">
            <input type="checkbox" checked={completedQuest} onChange={e => setCompletedQuest(e.target.checked)} className="w-8 h-8 accent-black border-4 border-black rounded cursor-pointer shrink-0" />
            <div>
              <span className="font-black uppercase text-base sm:text-lg block leading-tight text-black">⚔️ Completed Daily Mission?</span>
              <span className="font-bold text-xs bg-white/60 px-2 py-0.5 rounded border border-black mt-1 inline-block text-slate-900">"{TODAYS_QUEST}"</span>
            </div>
          </div>

          <textarea 
            placeholder="Tell the story... What happened? (Optional)" 
            value={deedComment} 
            onChange={e => setDeedComment(e.target.value)} 
            rows="3" 
            className="w-full border-4 border-black rounded-2xl p-4 font-bold bg-slate-50 shadow-[inset_2px_2px_0px_rgba(0,0,0,0.1)] focus:bg-white resize-none outline-none text-sm"
          ></textarea>

          <button type="submit" disabled={isLoading} className="bg-lime-400 hover:bg-lime-300 text-black text-2xl font-black py-4 rounded-2xl border-4 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all uppercase tracking-widest mt-2 cursor-pointer transform -rotate-1">
            {isLoading ? 'Linking...' : 'Log It! ⚡'}
          </button>

        </form>
      </div>
    </div>
  );
}
// --- QUICK QR CONNECT MODAL (UPI STYLE) ---
function QuickQRModal({ myPrimaryNode, onClose, onRefreshGraph }) {
  const [mode, setMode] = useState('select'); // 'select', 'show', 'scan', 'form'
  const [scannedTag, setScannedTag] = useState('');
  const [relation, setRelation] = useState('they_helped_me'); // 'they_helped_me' or 'i_helped_them'
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleScan = (detectedCodes) => {
    if (detectedCodes && detectedCodes.length > 0) {
      const text = detectedCodes[0].rawValue;
      if (!text) return;
      const cleanTag = text.toUpperCase().trim();
      setScannedTag(cleanTag);
      setMode('form');
    }
  };

  const handleSubmit = async () => {
    if (!scannedTag) return;
    setIsLoading(true);
    setMsg('');
    try {
      // Determine direction of arrow based on toggle!
      const source = relation === 'they_helped_me' ? scannedTag : myPrimaryNode.id;
      const target = relation === 'they_helped_me' ? myPrimaryNode.id : scannedTag;

      const { error } = await supabase.rpc('log_kindness_link', {
        p_source: source,
        p_target: target,
        p_color: '#000000', // Default arrow color for quick connects
        p_comment: comment
      });

      if (error) throw error;
      
      setMsg('🎉 Chain successfully linked!');
      setTimeout(() => {
        if (onRefreshGraph) onRefreshGraph();
        onClose();
      }, 1500);
    } catch (err) {
      setMsg(`⚠️ Error: ${err.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-sm relative transform -rotate-1 flex flex-col items-center">
        <button onClick={onClose} className="absolute -top-3 -right-3 bg-red-400 text-black border-4 border-black rounded-full w-10 h-10 flex items-center justify-center font-black text-xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform z-10 cursor-pointer">
          ✖
        </button>

        <h2 className="text-2xl font-black mb-4 uppercase tracking-tight bg-yellow-300 px-4 py-1 border-2 border-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] transform rotate-2">
          ⚡ Quick Connect
        </h2>

        {mode === 'select' && (
          <div className="flex flex-col gap-4 w-full mt-2">
            <button onClick={() => setMode('show')} className="w-full bg-cyan-300 hover:bg-cyan-200 border-4 border-black rounded-2xl p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center text-center">
              <span className="text-5xl mb-2">📱</span>
              <span className="font-black uppercase text-xl text-black">Show My QR</span>
              <span className="text-xs font-bold text-slate-700 mt-1">Let someone scan your K-Tag</span>
            </button>

            <button onClick={() => setMode('scan')} className="w-full bg-pink-300 hover:bg-pink-200 border-4 border-black rounded-2xl p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center text-center">
              <span className="text-5xl mb-2">📷</span>
              <span className="font-black uppercase text-xl text-black">Scan a QR</span>
              <span className="text-xs font-bold text-slate-700 mt-1">Link to someone you helped</span>
            </button>
          </div>
        )}

        {mode === 'show' && (
          <div className="flex flex-col items-center w-full animate-in fade-in zoom-in duration-200">
            <p className="text-sm font-black uppercase text-slate-600 mb-4 text-center">Have them scan this to link with you!</p>
            <div className="bg-white p-4 border-4 border-black rounded-3xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">
              {/* Zero Dependency QR Code via Free API */}
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${myPrimaryNode?.id}`} alt="My QR Code" className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl" />
            </div>
            <p className="mt-6 text-2xl font-black uppercase tracking-widest bg-slate-100 border-2 border-black px-4 py-2 rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              {myPrimaryNode?.id}
            </p>
            <button onClick={() => setMode('select')} className="mt-6 text-xs font-black uppercase underline hover:text-pink-500">Back</button>
          </div>
        )}

        {mode === 'scan' && (
          <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-200">
            <div className="w-full h-64 border-4 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,1)] relative bg-black">
              <Scanner onScan={handleScan} />
              <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40"></div>
            </div>
            <p className="text-xs font-black uppercase text-slate-600 mt-4">Point at someone's K-Tag QR Code</p>
            <button onClick={() => setMode('select')} className="mt-4 text-xs font-black uppercase underline hover:text-pink-500">Cancel</button>
          </div>
        )}

        {mode === 'form' && (
          <div className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="bg-slate-100 border-2 border-black rounded-xl p-3 text-center">
              <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Scanned User</span>
              <span className="text-xl font-black uppercase tracking-widest text-black">{scannedTag}</span>
            </div>

            {msg && <p className="text-xs font-bold text-center bg-yellow-200 p-2 border-2 border-black rounded-lg">{msg}</p>}

            <div className="flex bg-slate-200 rounded-xl p-1 border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] relative">
              <button onClick={() => setRelation('they_helped_me')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-colors z-10 ${relation === 'they_helped_me' ? 'text-black' : 'text-slate-500'}`}>They Helped Me</button>
              <button onClick={() => setRelation('i_helped_them')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-colors z-10 ${relation === 'i_helped_them' ? 'text-black' : 'text-slate-500'}`}>I Helped Them</button>
              <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg border-2 border-black transition-transform duration-200 shadow-sm ${relation === 'i_helped_them' ? 'translate-x-[calc(100%+2px)]' : 'translate-x-0'}`}></div>
            </div>

            <textarea 
              placeholder="Tell the story (Optional)" 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="3"
              className="w-full bg-white border-2 border-black rounded-xl p-3 font-bold text-xs focus:outline-none focus:bg-pink-50 shadow-[2px_2px_0px_rgba(0,0,0,1)] resize-none"
            ></textarea>

            <button onClick={handleSubmit} disabled={isLoading} className="w-full bg-lime-400 hover:bg-lime-300 text-black text-lg font-black py-3 rounded-xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all uppercase tracking-widest cursor-pointer mt-2">
              {isLoading ? 'Linking...' : 'Log It 🚀'}
            </button>
            <button onClick={() => setMode('select')} className="text-[10px] font-black uppercase underline hover:text-pink-500 text-center">Reset / Go Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- DASHBOARD ---
function Dashboard({ userData }) {
  const navigate = useNavigate();
  const isOriginator = userData?.isOriginator;
  const myId = userData?.myId || "ME-123";
  const helperId = userData?.helperId || "HELPER-99";

  const treeData = {
    nodes: isOriginator 
      ? [ { id: myId, shape: userData?.customShape, type: userData?.customType, value: userData?.customValue }, { id: 'Next Person...', ghost: true } ]
      : [ { id: helperId, shape: 'circle', type: 'color', value: '#94a3b8' }, { id: myId, shape: userData?.customShape, type: userData?.customType, value: userData?.customValue }, { id: 'Next Person...', ghost: true } ],
    links: isOriginator
      ? [ { source: myId, target: 'Next Person...', customColor: '#000000' } ]
      : [ { source: helperId, target: myId, customColor: '#000000' }, { source: myId, target: 'Next Person...', customColor: '#000000' } ]
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center mt-8 lg:mt-12 gap-8 lg:gap-12 w-full max-w-6xl mx-auto">
      <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
        <h1 className="text-4xl sm:text-5xl font-black text-black mb-4 uppercase drop-shadow-sm">
          {isOriginator ? "🎉 Chain Started!" : "🙌 You're In!"}
        </h1>
        <p className="text-slate-700 text-lg sm:text-xl font-bold mb-8 max-w-md">
          Your node is live! Share your unique ID with the next person you help so they can link up.
        </p>
        <div className="bg-pink-300 border-4 border-black p-6 sm:p-8 rounded-3xl shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-sm transform rotate-1 hover:rotate-0 transition-transform">
          <p className="text-black text-sm font-black uppercase tracking-widest mb-2 bg-white inline-block px-3 py-1 border-2 border-black rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,1)]">Your K-Tag</p>
          <p className="text-4xl sm:text-5xl font-black text-black tracking-wider break-words mt-4">{myId}</p>
        </div>
        
        <button onClick={() => navigate('/')} className="mt-8 bg-lime-400 hover:bg-lime-300 text-black text-xl font-black py-4 px-8 rounded-xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all uppercase tracking-widest cursor-pointer w-full max-w-sm">
          🌍 Back to Global Map
        </button>
      </div>
      <div className="w-full lg:w-1/2 h-[50vh] min-h-[350px] lg:h-[min(500px,70vh)] relative border-2 sm:border-4 border-black rounded-3xl bg-white shadow-[6px_6px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_rgba(0,0,0,1)] p-2">
        <KindnessGraph data={treeData} />
      </div>
    </div>
  );
}

// 🔊 SOUND EFFECTS CACHE (Moved outside component to satisfy React Compiler!)
// Swapped to permanent reliable CDNs to fix the NotSupportedError
const SFX = {
  pop: new Audio('https://s3.amazonaws.com/freecodecamp/simonSound1.mp3'),
  buy: new Audio('https://s3.amazonaws.com/freecodecamp/simonSound2.mp3'),
  ding: new Audio('https://s3.amazonaws.com/freecodecamp/simonSound3.mp3')
};
const playSound = (type) => { 
  if (SFX[type]) {
    SFX[type].currentTime = 0; 
    SFX[type].play().catch(() => {}); // Catch silently to prevent console spam
  }
};

// --- MAIN APP ---
function App() {
  const [userData, setUserData] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true); 
  const [showSplash, setShowSplash] = useState(true); // 🎮 SPLASH SCREEN STATE
  const [isFadingSplash, setIsFadingSplash] = useState(false); // 🎮 SPLASH FADE STATE
  const [showSettings, setShowSettings] = useState(false);

  // Short Decorative Splash Screen Timer
  useEffect(() => {
    const t1 = setTimeout(() => setIsFadingSplash(true), 1000); // Super fast 1s wait
    const t2 = setTimeout(() => setShowSplash(false), 1400); // Remove from DOM quickly
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // 🔊 GLOBAL BUTTON CLICK SOUND SYSTEM 🔊
  // Captures all clicks on ANY button, link, or clickable element in the entire game instantly!
  useEffect(() => {
    const handleGlobalClick = (e) => {
      // If the element clicked is a button, link, checkbox, or has the tailwind 'cursor-pointer' class
      if (e.target.closest('button, a, [role="button"], .cursor-pointer, input[type="checkbox"]')) {
        playSound('pop');
      }
    };
    // Use capture phase to ensure it plays instantly, even if the button logic delays!
    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
  }, []);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNodeManager, setShowNodeManager] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeMenu, setNodeMenu] = useState(null); 
  const [linkPopup, setLinkPopup] = useState(null); 
  const [showQRModal, setShowQRModal] = useState(false); 
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false); 
  const [shopTab, setShopTab] = useState('themes'); // 🛒 K-Shop Gamified Navigation Tab
  const [confirmPurchase, setConfirmPurchase] = useState(null); // 💎 Custom Checkout Modal State
  const [globalGraph, setGlobalGraph] = useState({ nodes: [], links: [] });

  // THE K-SHOP COSMETICS CATALOG DATABASE
  const SHOP_EFFECTS = [
    { id: 'none', label: 'Off', icon: '🛑', price: 0 }, 
    { id: 'fire', label: 'Hellfire', icon: '🔥', price: 50 }, 
    { id: 'neon', label: 'CyberGlow', icon: '⚡', price: 50 }, 
    { id: 'holy', label: 'Divine', icon: '🌟', price: 75 },
    { id: 'orbit', label: 'Orbit', icon: '💫', price: 100 }, // ✨ NEW AURA
    { id: 'cloud', label: 'Cloud', icon: '☁️', price: 100 }  // ✨ NEW AURA
  ];
  const SHOP_TITLES = [
    { id: null, label: 'No Title', icon: '❌', price: 0 },
    { id: 'The Philanthropist', label: 'Philanthropist', icon: '🎩', price: 150 },
    { id: 'Karma Farmer', label: 'Karma Farmer', icon: '🌾', price: 200 },
    { id: 'Vibe Curator', label: 'Vibe Curator', icon: '✨', price: 250 },
    { id: 'CEO of Kindness', label: 'CEO', icon: '💼', price: 500 }
  ];
  const SHOP_THEMES = [
    { id: 'classic', label: 'Classic Grid', icon: '📝', price: 0 },
    { id: 'midnight', label: 'Midnight', icon: '🌙', price: 100 },
    { id: 'galaxy', label: 'Deep Space', icon: '🌌', price: 150 },
    { id: 'sakura', label: 'Sakura Pink', icon: '🌸', price: 150 }
  ];
  const SHOP_FRAMES = [
    { id: 'none', label: 'No Frame', icon: '🛑', price: 0 },
    { id: 'vines', label: 'Nature Vines', icon: '🌿', price: 100 },
    { id: 'cyber', label: 'Cyber Glitch', icon: '🤖', price: 150 },
    { id: 'donut', label: 'The Donut', icon: '🍩', price: 200 },
    { id: 'diamond', label: 'Diamond', icon: '💎', price: 250 }
  ];
  const SHOP_SHAPES = [
    { id: 'circle', label: 'Circle', icon: '🟡', price: 0 }, { id: 'square', label: 'Square', icon: '🔲', price: 0 }, 
    { id: 'hexagon', label: 'Tech Hex', icon: '⬢', price: 50 }, { id: 'star', label: 'Star', icon: '⭐', price: 100 }
  ];
  const SHOP_ARROWS = [
    { id: 'classic', label: 'Standard', icon: '➡️', price: 0 }, 
    { id: 'dashed', label: 'Pixel Dash', icon: '➖', price: 50 }, 
    { id: 'electric', label: 'Lightning', icon: '🌩️', price: 100 },
    { id: 'rainbow', label: 'Rainbow', icon: '🌈', price: 150 },
    { id: 'dna', label: 'DNA Helix', icon: '🧬', price: 200 },
    { id: 'footprints', label: 'Paws', icon: '🐾', price: 200 }
  ];

  // TODO: Replace 'variant_id' with your actual variant IDs from the Lemon Squeezy dashboard
  // TODO: Replace 'YOUR_STORE' with your actual Lemon Squeezy store name
  const COIN_PACKS = [
    { id: 'pack_small', label: 'Handful of Coins', amount: 100, priceStr: '₹199', variantId: '1892266' },
    { id: 'pack_med', label: 'Bag of Coins', amount: 500, priceStr: '₹299', variantId: '1892314' },
    { id: 'pack_large', label: 'Chest of Coins', amount: 1000, priceStr: '₹899', variantId: '1892321' }
  ];

  // Helper to render standard Store Item Buttons beautifully
  const renderShopButton = (item, categoryStr, currentEquippedId) => {
    const isOwned = !item.price || item.price === 0 || (myPrimaryNode?.unlockedCosmetics || []).includes(item.id);
    const isEquipped = currentEquippedId === item.id || (!currentEquippedId && !item.id);
    
    return (
      <button key={item.id || item.label} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShopItemClick(item, categoryStr, currentEquippedId); }} 
        className={`flex flex-col items-center p-3 rounded-2xl border-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] active:scale-95 transition-all cursor-pointer select-none ${isEquipped ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-500 transform -translate-y-1' : 'border-black bg-white hover:bg-slate-100'}`}>
        <span className="text-3xl mb-1">{item.icon}</span>
        <span className="text-[9px] uppercase font-black mb-2 text-center leading-tight h-6 flex items-center">{item.label}</span>
        
        {!isOwned ? (
           <span className="bg-yellow-300 border-2 border-black rounded-lg px-2 py-0.5 text-[10px] font-black shadow-[1px_1px_0px_rgba(0,0,0,1)]">🪙 {item.price}</span>
        ) : isEquipped ? (
           <span className="bg-lime-400 border-2 border-black rounded-lg px-2 py-0.5 text-[9px] font-black uppercase shadow-[1px_1px_0px_rgba(0,0,0,1)]">Equipped</span>
        ) : (
           <span className="bg-slate-200 border-2 border-black rounded-lg px-2 py-0.5 text-[9px] font-black uppercase text-slate-600 shadow-[1px_1px_0px_rgba(0,0,0,1)]">Equip</span>
        )}
      </button>
    );
  };

  // --- MAP INTERACTION LOGIC (HIDES UI ON MOBILE PANNING) ---
  const interactTimeout = useRef(null);

  // 🔥 THE RE-RENDER FIX: We use direct DOM manipulation instead of React State! 
  // Updating React State mid-touch forces a Canvas re-render, instantly killing the tap event!
  const handleMapInteractionStart = () => {
    if (window.innerWidth >= 768) return;
    if (interactTimeout.current) clearTimeout(interactTimeout.current);
    interactTimeout.current = setTimeout(() => {
      const topUI = document.getElementById('ui-top');
      const botUI = document.getElementById('ui-bottom');
      if (topUI) { topUI.style.transform = 'translateY(-5rem)'; topUI.style.opacity = '0'; }
      if (botUI) { botUI.style.transform = 'translateY(10rem)'; botUI.style.opacity = '0'; botUI.style.pointerEvents = 'none'; }
    }, 150); 
  };

  const handleMapInteractionEnd = () => {
    if (window.innerWidth >= 768) return;
    if (interactTimeout.current) clearTimeout(interactTimeout.current);
    interactTimeout.current = setTimeout(() => {
      const topUI = document.getElementById('ui-top');
      const botUI = document.getElementById('ui-bottom');
      if (topUI) { topUI.style.transform = 'translateY(0)'; topUI.style.opacity = '1'; }
      if (botUI) { botUI.style.transform = 'translateY(0)'; botUI.style.opacity = '1'; botUI.style.pointerEvents = 'auto'; }
    }, 800); 
  };

  // ROBUST POLYFILL TRANSLATOR CONSTRUCT: FIXES 'clientX IS UNDEFINED' MOBILE TOUCHSCREEN MAPPING BUG COMPLETELY!
  const getTapPos = (e) => {
    if (e && typeof e.clientX === 'number') return { x: e.clientX, y: e.clientY };
    if (e && e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e && e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 }; // Safe fallback center screen avoiding null crash
  };

  // 1. Fetch Global Graph wrapped in useCallback so it's globally available
  const fetchGlobalGraph = useCallback(async () => {
    const [ 
      { data: dbNodes, error: nodesError }, 
      { data: dbLinks, error: linksError },
      { data: dbNodeReacts },
      { data: dbLinkReacts },
      { data: dbFollows } // NEW: Followers Tracker Response payload
    ] = await Promise.all([
      supabase.from('nodes').select('*'),
      supabase.from('links').select('*'),
      supabase.from('node_reactions').select('node_id, emoji'),
      supabase.from('link_reactions').select('source_id, target_id, emoji'),
      supabase.from('node_follows').select('following_node_id, follower_id') // NEW: Background DB call seamlessly stacked
    ]);

    if (!nodesError && !linksError && dbNodes.length > 0) {
        
        // --- ASSEMBLE ALL REACTIONS LOCALLY FAST! ---
        const aggregatedNodeReacts = {};
        if (dbNodeReacts) dbNodeReacts.forEach(r => {
          if (!aggregatedNodeReacts[r.node_id]) aggregatedNodeReacts[r.node_id] = {};
          aggregatedNodeReacts[r.node_id][r.emoji] = (aggregatedNodeReacts[r.node_id][r.emoji] || 0) + 1;
        });

        const aggregatedLinkReacts = {};
        if (dbLinkReacts) dbLinkReacts.forEach(r => {
          const key = `${r.source_id}|${r.target_id}`;
          if (!aggregatedLinkReacts[key]) aggregatedLinkReacts[key] = {};
          aggregatedLinkReacts[key][r.emoji] = (aggregatedLinkReacts[key][r.emoji] || 0) + 1;
        });

        // Fast In-Memory Parser building Live Profiles Sub/Fan mapping logic directly
        const followMap = {};
        if (dbFollows) {
           dbFollows.forEach(f => {
              if (!followMap[f.following_node_id]) followMap[f.following_node_id] = [];
              followMap[f.following_node_id].push(f.follower_id);
           });
        }
        
        // Pinpoints YOU within tracking network to colorize toggles based strictly on authenticated vision layout overrides
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const activeUserId = authSession?.user?.id;
        
        // Pre-calculate ranks for ALL users so we can show them on map clicks!
        const helpCounts = {};
        const approvedLinks = dbLinks.filter(l => l.status === 'approved' || !l.status);
        
        approvedLinks.forEach(l => {
            helpCounts[l.source] = (helpCounts[l.source] || 0) + (l.helps_count || 1);
        });

        const claimedNodes = dbNodes.filter(n => n.is_claimed);
        claimedNodes.sort((a, b) => (helpCounts[b.id] || 0) - (helpCounts[a.id] || 0));
        const ranks = {};
        claimedNodes.forEach((n, idx) => ranks[n.id] = idx + 1);

        setGlobalGraph({
          nodes: dbNodes.map(n => {
            const nodeFollowers = followMap[n.id] || [];
            const didQuestToday = n.last_quest_date === new Date().toISOString().split('T')[0];
            
            // Clean parsing structured to squash strict Linter 'empty block' and 'unused e' complaints 
            let cosmeticsPayload = {};
            if (typeof n.cosmetics === 'object' && n.cosmetics) {
                cosmeticsPayload = n.cosmetics;
            } else if (typeof n.cosmetics === 'string') {
                try { 
                    cosmeticsPayload = JSON.parse(n.cosmetics); 
                } catch (parseError) { 
                    console.warn("Formatting skip safe fallback applied", parseError); 
                }
            }

            return {
              id: n.id, shape: n.shape, type: n.type, value: n.value, 
              socials: n.socials, is_claimed: n.is_claimed, user_id: n.user_id,
              rank: ranks[n.id] || '-',
              reactions: aggregatedNodeReacts[n.id] || {}, 
              followersCount: nodeFollowers.length, 
              isFollowedByMe: activeUserId ? nodeFollowers.includes(activeUserId) : false, 
              questsCompleted: n.quests_completed || 0,
              questStreak: n.quest_streak || 0,
              glowingQuestHalo: didQuestToday,
              title: cosmeticsPayload.title || null, // ✨ Inject Title Memory
              mapTheme: cosmeticsPayload.mapTheme || 'classic', // 🗺️ Inject Theme Memory
              frame: cosmeticsPayload.frame || 'none', // 🖼️ Inject Frame Memory
              verified: cosmeticsPayload.verified || false, // 💎 Inject Verification Memory
              coins: n.karma_coins || 100, // 💰 Real Coin Balance!
              unlockedCosmetics: n.unlocked_cosmetics || [], // 🔓 Inventory Data
              cosmetics: cosmeticsPayload
            };
          }),
          links: approvedLinks.map(l => {
              // Locate Outbound Link creator dynamically capturing their personal Wardrobe aesthetic tracking constraints safely globally over engine parameters !
              const creator = dbNodes.find(nd => nd.id === l.source);
              let linkCosmetic = 'classic';
              if (creator) {
                 const srcCosm = (typeof creator.cosmetics === 'object') ? creator.cosmetics : (typeof creator.cosmetics === 'string' ? JSON.parse(creator.cosmetics||'{}') : {});
                 if (srcCosm?.arrow) linkCosmetic = srcCosm.arrow;
              }

              return {
                source: l.source, target: l.target, customColor: l.custom_color, helpsCount: l.helps_count || 1,
                comment: l.comment || '', reactions: aggregatedLinkReacts[`${l.source}|${l.target}`] || {},
                isQuestMode: l.is_quest,
                arrowStyle: linkCosmetic // Inject Wardrobe Variable Engine Parameter Track!
              };
          })
        });
      } else {
      setGlobalGraph(mockFallbackTree);
    }
  }, []);

  // 2. Helper to ensure every signed-in user HAS a Primary Node
  const ensurePrimaryNode = useCallback(async (userSession) => {
    if (!userSession?.user?.id) return;
    const userId = userSession.user.id;

    // Strictly check if the user has a permanent claimed node attached to their account
    const { data: existingNodes } = await supabase
      .from('nodes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_claimed', true);

    if (!existingNodes || existingNodes.length === 0) {
      const rawName = userSession.user.user_metadata?.full_name || userSession.user.email?.split('@')[0] || 'KIND';
      const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 10) || 'MEMBER';
      const primaryTag = `${cleanName}-${Math.floor(1000 + Math.random() * 9000)}`;

      await supabase.from('nodes').insert({
        id: primaryTag,
        user_id: userId,
        created_by: userId,
        shape: 'circle',
        type: 'image',
        value: userSession.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        socials: userSession.user.user_metadata?.socials || {},
        is_claimed: true
      });
      fetchGlobalGraph();
    }
  }, [fetchGlobalGraph]);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(session);
      setIsAuthLoading(false);
      if (session) ensurePrimaryNode(session);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setIsAuthLoading(false);
      if (session) ensurePrimaryNode(session);
    });

    queueMicrotask(() => {
      if (isMounted) fetchGlobalGraph();
    });

    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nodes' },
        () => { fetchGlobalGraph(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'links' },
        () => { fetchGlobalGraph(); }
      )
      .subscribe();

    return () => {
      isMounted = false;
      authSub.unsubscribe();
      supabase.removeChannel(channel); 
    };
  }, [ensurePrimaryNode, fetchGlobalGraph]); 

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Compute live graph metrics
  const totalNodes = globalGraph.nodes.filter(n => !n.ghost).length;
  const totalConnections = globalGraph.links.length;
  const targetsSet = new Set(globalGraph.links.map(l => typeof l.target === 'object' ? l.target.id : l.target));
  const activeChainsCount = globalGraph.nodes.filter(n => !n.ghost && !targetsSet.has(n.id)).length;

  // Compute Personal User Stats & Ranks
  let myPrimaryNode = null;
  let myHelpedCount = 0;
  let myHelpedByCount = 0;
  let myRank = "Starter Seed 🌰";
  let myRankNumber = "-"; // NEW: Numeric Rank

  if (session && globalGraph.nodes.length > 0) {
    myPrimaryNode = globalGraph.nodes.find(n => n.user_id === session.user.id && n.is_claimed);
    
    if (myPrimaryNode) {
      // 1. Calculate scores for ALL claimed users to determine the leaderboard
      const userScores = globalGraph.nodes
        .filter(n => n.is_claimed)
        .map(node => {
          const score = globalGraph.links
            .filter(l => (typeof l.source === 'object' ? l.source.id : l.source) === node.id)
            .reduce((sum, l) => sum + (l.helpsCount || 1), 0);
          return { id: node.id, score };
        });

      // 2. Sort users by score (highest to lowest)
      userScores.sort((a, b) => b.score - a.score);

      // 3. Find exactly where YOU stand in the world!
      const myIndex = userScores.findIndex(u => u.id === myPrimaryNode.id);
      myRankNumber = myIndex !== -1 ? myIndex + 1 : "-";

      // 4. Get your personal counts
      myHelpedCount = userScores.find(u => u.id === myPrimaryNode.id)?.score || 0;
        
      myHelpedByCount = globalGraph.links
        .filter(l => (typeof l.target === 'object' ? l.target.id : l.target) === myPrimaryNode.id)
        .reduce((sum, l) => sum + (l.helpsCount || 1), 0);

      // Rank Title Logic!
      if (myHelpedCount >= 25) myRank = "Global Legend 👑";
      else if (myHelpedCount >= 10) myRank = "Kindness Catalyst ⚡";
      else if (myHelpedCount >= 3) myRank = "Rising Star ⭐";
      else if (myHelpedCount >= 1) myRank = "Sprout 🌱";
    }
  }

  // Handle the new Refresh button
  const handleManualRefresh = () => {
    fetchGlobalGraph();
    window.dispatchEvent(new CustomEvent('recenter-graph')); // Tells the map to animate & recenter
  };
// 🛒 UNIVERSAL K-SHOP PURCHASING & EQUIPPING ENGINE
  const handleShopItemClick = async (item, categoryStr, currentEquipped) => {
    const isOwned = !item.price || item.price === 0 || (myPrimaryNode?.unlockedCosmetics || []).includes(item.id);

    if (isOwned) {
      if (currentEquipped === item.id) return; // Already equipped

      // 1. Equip: Update local visual state instantly (INCLUDING Top-Level shortcut properties!)
      setGlobalGraph(prev => ({
        nodes: prev.nodes.map(n => n.id === myPrimaryNode.id ? { 
          ...n, 
          shape: categoryStr === 'shape' ? item.id : n.shape, 
          title: categoryStr === 'title' ? item.id : n.title,
          mapTheme: categoryStr === 'mapTheme' ? item.id : n.mapTheme,
          frame: categoryStr === 'frame' ? item.id : n.frame,
          cosmetics: { ...(n.cosmetics || {}), [categoryStr]: item.id } 
        } : n),
        links: categoryStr === 'arrow' 
          ? prev.links.map(l => (typeof l.source === 'object' ? l.source.id : l.source) === myPrimaryNode.id ? { ...l, arrowStyle: item.id } : l) 
          : prev.links
      }));

      // 2. Fast DB Sync using current memory (Fixes Mobile Race Conditions!)
      const freshCosm = myPrimaryNode.cosmetics || {};
      await supabase.rpc('equip_cosmetics', { 
        p_node: myPrimaryNode.id, 
        p_shape: categoryStr === 'shape' ? item.id : myPrimaryNode.shape, 
        p_effect: categoryStr === 'effect' ? item.id : freshCosm.effect, 
        p_arrow: categoryStr === 'arrow' ? item.id : freshCosm.arrow, 
        p_title: categoryStr === 'title' ? item.id : freshCosm.title, 
        p_map_theme: categoryStr === 'mapTheme' ? item.id : freshCosm.mapTheme, 
        p_frame: categoryStr === 'frame' ? item.id : freshCosm.frame, 
        p_verified: freshCosm.verified 
      });
      // Await the fetch AFTER RPC completes so background matches DB completely!
      fetchGlobalGraph();
    } else {
      // Trigger Gamified Confirmation Modal instead of browser alerts!
      setConfirmPurchase({ item, categoryStr });
    }
  };

  // 🚀 CUSTOM CHECKOUT EXECUTION
  const executePurchase = async () => {
    if (!confirmPurchase) return;
    const { item, categoryStr } = confirmPurchase;
    setConfirmPurchase(null); // Close the checkout modal instantly

    // Purchase: Deduct coins, add to inventory, AND auto-equip instantly locally!
    setGlobalGraph(prev => ({
      nodes: prev.nodes.map(n => n.id === myPrimaryNode.id ? { 
        ...n, coins: Math.max(0, n.coins - item.price), unlockedCosmetics: [...(n.unlockedCosmetics || []), item.id],
        shape: categoryStr === 'shape' ? item.id : n.shape, 
        title: categoryStr === 'title' ? item.id : n.title,
        mapTheme: categoryStr === 'mapTheme' ? item.id : n.mapTheme,
        frame: categoryStr === 'frame' ? item.id : n.frame,
        cosmetics: { ...(n.cosmetics || {}), [categoryStr]: item.id }
      } : n),
      links: categoryStr === 'arrow' 
        ? prev.links.map(l => (typeof l.source === 'object' ? l.source.id : l.source) === myPrimaryNode.id ? { ...l, arrowStyle: item.id } : l) 
        : prev.links
    }));

    // Server Transaction
    const { data: success } = await supabase.rpc('buy_cosmetic', { p_node: myPrimaryNode.id, p_item_id: item.id, p_price: item.price });
    if (success) {
      const freshCosm = myPrimaryNode.cosmetics || {};
      await supabase.rpc('equip_cosmetics', { 
        p_node: myPrimaryNode.id, 
        p_shape: categoryStr === 'shape' ? item.id : myPrimaryNode.shape, 
        p_effect: categoryStr === 'effect' ? item.id : freshCosm.effect, 
        p_arrow: categoryStr === 'arrow' ? item.id : freshCosm.arrow, 
        p_title: categoryStr === 'title' ? item.id : freshCosm.title, 
        p_map_theme: categoryStr === 'mapTheme' ? item.id : freshCosm.mapTheme, 
        p_frame: categoryStr === 'frame' ? item.id : freshCosm.frame, 
        p_verified: freshCosm.verified 
      });
      fetchGlobalGraph();
    }
  };

 // 💰 REAL CHECKOUT ENGINE (LEMON SQUEEZY)
  const handleBuyCoins = (pack) => {
    playSound('buy'); 
    
    // The base URL for your Lemon Squeezy store checkouts
    const storeUrl = 'https://ksphere.lemonsqueezy.com/checkout/buy'; 
    
    // 🔥 THE MAGIC TRICK: We attach their K-Tag as "custom data" to the URL.
    // Lemon Squeezy will send this exact K-Tag back to our server when the payment succeeds!
    const checkoutUrl = `${storeUrl}/${pack.variantId}?checkout[custom][node_id]=${myPrimaryNode.id}`;
    
    // Open the secure checkout in a new tab!
    window.open(checkoutUrl, '_blank');
  };
  

  // 🔥 STABLE CLICK HANDLERS: Prevents ForceGraph from unbinding touch events mid-tap when UI state changes!
  const handleNodeClick = useCallback((node, event) => {
    playSound('pop'); // 🔊 Map Node Tap Sound
    const p = getTapPos(event);
    setNodeMenu({ node, x: p.x, y: p.y });
    setLinkPopup(null);
  }, []);

  const handleLinkClick = useCallback((link, event) => {
    playSound('pop'); // 🔊 Map Edge/Chain Tap Sound
    const p = getTapPos(event);
    setLinkPopup({ link, x: p.x, y: p.y });
    setNodeMenu(null);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setNodeMenu(null);
    setLinkPopup(null);
  }, []);

  return (
    <Router>
      <div className="min-h-screen font-sans text-slate-900 flex flex-col selection:bg-pink-400 selection:text-white">
        
        {/* 🎮 CINEMATIC GAMIFIED SPLASH SCREEN 🎮 */}
        {showSplash && (
          <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#09090b] transition-all duration-500 ease-in-out ${isFadingSplash ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'}`}>
            
            {/* Blinking Logo Pinned to the Bottom */}
            <div className="absolute bottom-12 md:bottom-16 w-full flex justify-center px-4 z-20">
              <img src="/logo.png" alt="KSPHERE WORLD" className="h-16 md:h-20 w-auto object-contain animate-[fastBlink_0.6s_ease-in-out_infinite]" />
            </div>

            {/* Custom keyframes for fast blinking */}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes fastBlink {
                0%, 100% { opacity: 1; filter: drop-shadow(0 0 10px rgba(255,255,255,0.8)); }
                50% { opacity: 0.2; filter: none; }
              }
            `}} />
          </div>
        )}

        {/* MODALS */}

        {/* 💎 GAMIFIED ITEM CHECKOUT MODAL 💎 */}
        {confirmPurchase && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto">
             <div className="bg-white border-4 border-black p-6 rounded-3xl shadow-[12px_12px_0px_rgba(0,0,0,1)] transform -rotate-1 w-full max-w-sm text-center relative animate-in zoom-in duration-200">
                <button onClick={() => setConfirmPurchase(null)} className="absolute -top-4 -right-4 bg-red-500 text-white border-4 border-black rounded-full w-12 h-12 flex items-center justify-center font-black text-2xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] cursor-pointer z-10">✖</button>
                
                <h3 className="text-2xl font-black uppercase mb-4 tracking-widest text-black">Unlock Item?</h3>
                <div className="bg-cyan-50 border-4 border-black rounded-2xl p-6 mb-6 shadow-[inset_4px_4px_0px_rgba(0,0,0,0.1)] flex flex-col items-center">
                   <div className="text-6xl mb-3 drop-shadow-md">{confirmPurchase.item.icon}</div>
                   <div className="font-black uppercase text-xl text-black">{confirmPurchase.item.label}</div>
                   <div className="mt-4 inline-flex items-center gap-2 bg-yellow-300 px-4 py-2 border-4 border-black rounded-xl font-black text-xl shadow-[4px_4px_0px_rgba(0,0,0,1)] transform rotate-2">
                     🪙 {confirmPurchase.item.price}
                   </div>
                </div>

                {(myPrimaryNode?.coins || 0) >= confirmPurchase.item.price ? (
                  <div className="flex gap-4">
                     <button onClick={() => setConfirmPurchase(null)} className="flex-1 py-4 font-black uppercase text-lg rounded-xl border-4 border-black bg-slate-200 text-slate-700 hover:bg-slate-300 shadow-[4px_4px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all cursor-pointer">Cancel</button>
                     <button onClick={executePurchase} className="flex-1 py-4 font-black uppercase text-lg rounded-xl border-4 border-black bg-lime-400 text-black hover:bg-lime-300 shadow-[4px_4px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all cursor-pointer">Unlock 🚀</button>
                  </div>
                ) : (
                  <div className="bg-red-50 border-4 border-red-500 rounded-2xl p-4 text-red-700 shadow-[inset_2px_2px_0px_rgba(0,0,0,0.1)]">
                     <p className="font-black uppercase mb-1 text-lg">Not Enough Coins!</p>
                     <p className="text-xs font-bold">You need {confirmPurchase.item.price - (myPrimaryNode?.coins || 0)} more 🪙 to unlock this item. Go log some good deeds or visit the Coin Shop!</p>
                  </div>
                )}
             </div>
          </div>
        )}
        {showSettings && <SettingsModal session={session} onClose={() => setShowSettings(false)} />}
        {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
        {showRequests && <RequestsModal session={session} onClose={() => setShowRequests(false)} onRefreshGraph={fetchGlobalGraph} />}
        {showNodeManager && <NodeManagerModal session={session} onClose={() => setShowNodeManager(false)} onRefreshGraph={fetchGlobalGraph} />}
        {selectedNode && <NodeDetailsModal node={selectedNode} onClose={() => setSelectedNode(null)} />}
        
        {/* INTERACTIVE MAP OVERLAYS */}
        {nodeMenu && (
          <div style={{ top: nodeMenu.y, left: nodeMenu.x }} className="fixed z-50 transform -translate-x-1/2 -translate-y-[120%] pointer-events-auto animate-in fade-in zoom-in duration-200">
            <div className="bg-white border-4 border-black rounded-xl p-3 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col gap-2 min-w-[160px] relative">
               <button onClick={() => setNodeMenu(null)} className="absolute -top-3 -right-3 bg-red-400 text-black border-2 border-black rounded-full w-7 h-7 flex items-center justify-center font-black text-xs hover:scale-110 shadow-[2px_2px_0px_rgba(0,0,0,1)] z-10 cursor-pointer">✖</button>
               <div className="text-center font-black uppercase text-sm border-b-2 border-black pb-1 mb-1 flex items-center justify-center gap-1">
                 {nodeMenu.node.id}
                 {nodeMenu.node.verified && (
                   <svg className="w-4 h-4 text-blue-500 fill-current drop-shadow-sm" viewBox="0 0 24 24" title="Verified Member"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                 )}
               </div>
               {/* Advanced Dynamic Metric Badge Scaling */}
               <div className="flex gap-2 w-full">
                 <div className="bg-yellow-300 flex-1 border-2 border-black rounded-lg px-1.5 py-1 text-[10px] font-black uppercase text-center shadow-[1px_1px_0px_rgba(0,0,0,1)] flex flex-col justify-center whitespace-nowrap">
                   <span>🏆 Rank</span>
                   <span className="text-sm">#{nodeMenu.node.rank}</span>
                 </div>
                 <div className="bg-purple-300 flex-1 border-2 border-black rounded-lg px-1.5 py-1 text-[10px] font-black uppercase text-center shadow-[1px_1px_0px_rgba(0,0,0,1)] flex flex-col justify-center">
                   <span>👥 Fans</span>
                   <span className="text-sm">{nodeMenu.node.followersCount || 0}</span>
                 </div>
               </div>
               
               {/* 💖 LIVE PROFILE REACTION BAR */}
               <div className="flex justify-between items-center bg-slate-100 border-2 border-black rounded-lg p-1.5 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)] my-1">
                 {['🔥', '💖', '🙌', '👀'].map(emoji => (
                   <button 
                     key={emoji}
                     title={`React with ${emoji}`}
                     onClick={async () => {
                        if (!session) return alert("🔒 Sign in to react!");
                        
                        // 1. SAFELY fake a visual local update exclusively within App Schema bounds
                        setGlobalGraph(prev => ({
                           nodes: prev.nodes.map(n => n.id === nodeMenu.node.id 
                             ? { ...n, reactions: { ...(n.reactions || {}), [emoji]: (n.reactions?.[emoji] || 0) + 1 } }
                             : n),
                           links: prev.links
                        }));
                        setNodeMenu(null); // Instant Snap Closure UI!
                        
                        // 2. Perform DB logic (safely handles Unlike/Like toggles in DB natively)
                        await supabase.rpc('toggle_node_reaction', { 
                          p_node: nodeMenu.node.id, 
                          p_emoji: emoji 
                        });
                        
                        // 3. True DB State immediately overwrites faked values silently & perfectly (resolves Double click errors!)
                        fetchGlobalGraph();
                     }}
                     className="hover:scale-[1.3] active:scale-95 hover:-translate-y-1 transition-all cursor-pointer text-base bg-white rounded-md border border-black shadow-[1px_1px_0px_rgba(0,0,0,1)] px-1"
                   >{emoji}</button>
                 ))}
               </div>

               {session ? (
                 <div className="flex flex-col gap-1.5 mt-0.5">
                   {/* DYNAMIC FOLLOW BUTTON - Safety feature blocks clicking/following yourself natively via map! */}
                   {nodeMenu.node.user_id !== session?.user?.id && (
                     <button onClick={async () => {
                        const isFollowing = nodeMenu.node.isFollowedByMe;
                        const newFollowCount = isFollowing ? Math.max(0, (nodeMenu.node.followersCount || 0) - 1) : (nodeMenu.node.followersCount || 0) + 1;
                        
                        // 1. Instantly fake App visual metrics & flip Menu memory variables safely without resetting frame/layout logic overlays cleanly
                        setNodeMenu(prev => ({
                           ...prev, 
                           node: { ...prev.node, isFollowedByMe: !isFollowing, followersCount: newFollowCount } 
                        }));

                        setGlobalGraph(prev => ({
                           nodes: prev.nodes.map(n => n.id === nodeMenu.node.id 
                             ? { ...n, isFollowedByMe: !isFollowing, followersCount: newFollowCount } 
                             : n),
                           links: prev.links
                        }));

                        // 2. Transact completely automatically hitting database cleanly mapping interactions globally syncing all devices simultaneously updates locally without resetting screen geometry overlaps!
                        await supabase.rpc('toggle_follow_node', { p_target_node: nodeMenu.node.id });
                        fetchGlobalGraph();
                     }} className={`w-full border-2 border-black rounded-lg px-2 py-1.5 text-[10px] font-black uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-transform cursor-pointer flex items-center justify-center gap-1 ${nodeMenu.node.isFollowedByMe ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-lime-400 hover:bg-lime-300 text-black'}`}>
                       {nodeMenu.node.isFollowedByMe ? 'Following ✅' : 'Follow ➕'}
                     </button>
                   )}

                   <button onClick={() => { setSelectedNode(nodeMenu.node); setNodeMenu(null); }} className="w-full bg-cyan-300 hover:bg-cyan-200 border-2 border-black rounded-lg px-2 py-1.5 text-[10px] font-black uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-transform cursor-pointer">
                     Tap to see profile 🔎
                   </button>
                 </div>
               ) : (
                 <button onClick={() => alert("🔒 Please sign in using the top-right button to view detailed user profiles!")} className="w-full bg-slate-200 text-slate-500 border-2 border-slate-400 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] cursor-not-allowed">
                   🔒 Sign in to view
                 </button>
               )}
               <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-b-4 border-r-4 border-black rotate-45"></div>
            </div>
          </div>
        )}

        {linkPopup && (
          <div style={{ top: linkPopup.y, left: linkPopup.x }} className="fixed z-50 transform -translate-x-1/2 -translate-y-[120%] pointer-events-auto animate-in fade-in zoom-in duration-200">
             <div className="bg-white border-4 border-black rounded-xl p-3 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col gap-2 min-w-[200px] max-w-[250px] relative">
               <button onClick={() => setLinkPopup(null)} className="absolute -top-3 -right-3 bg-red-400 text-black border-2 border-black rounded-full w-7 h-7 flex items-center justify-center font-black text-xs hover:scale-110 shadow-[2px_2px_0px_rgba(0,0,0,1)] z-10 cursor-pointer">✖</button>
               
               {/* SPECIAL EXCLUSIVE BANNER IF THEY CHECKED THE MISSION BOX NATIVELY! */}
               {linkPopup.link.isQuestMode && (
                 <div className="bg-yellow-400 text-black border-2 border-black p-1 text-[9px] font-black uppercase tracking-widest text-center shadow-[1px_1px_0px_rgba(0,0,0,1)] rounded mb-1 animate-pulse flex items-center justify-center gap-1">
                   ⚔️ Mission Verified
                 </div>
               )}

               <div className="text-[10px] font-black uppercase border-b-2 border-black pb-1 mb-1 text-center bg-lime-300 rounded-md border-2 p-1.5 shadow-[1px_1px_0px_rgba(0,0,0,1)] tracking-tight">
                 {typeof linkPopup.link.source === 'object' ? linkPopup.link.source.id : linkPopup.link.source} 
                 <span className="mx-1 text-xs">➔</span> 
                 {typeof linkPopup.link.target === 'object' ? linkPopup.link.target.id : linkPopup.link.target}
               </div>
               
               {/* THE LINK STORY/COMMENT */}
               <div className={`text-xs font-bold text-slate-800 bg-slate-50 p-2 rounded-lg border-2 ${linkPopup.link.isQuestMode ? 'border-amber-400 border-dashed bg-amber-50' : 'border-black'}`}>
                 {linkPopup.link.comment ? `"${linkPopup.link.comment}"` : "No story provided for this good deed."}
               </div>

               {/* 💖 LIVE STORY REACTION BAR */}
               <div className="flex justify-center gap-3 items-center mt-1 border-t-2 border-black border-dashed pt-2">
                 {['🥺', '❤️', '👏', '🏆'].map(emoji => (
                   <button 
                     key={emoji}
                     title={`React with ${emoji}`}
                     onClick={async () => {
                        if (!session) return alert("🔒 Sign in to react!");
                        
                        const menuS = typeof linkPopup.link.source === 'object' ? linkPopup.link.source.id : linkPopup.link.source;
                        const menuT = typeof linkPopup.link.target === 'object' ? linkPopup.link.target.id : linkPopup.link.target;
                        
                        // 1. SAFELY fake a visual local update cleanly via App Object Clone definitions only
                        setGlobalGraph(prev => ({
                           nodes: prev.nodes,
                           links: prev.links.map(l => {
                             const s = typeof l.source === 'object' ? l.source.id : l.source;
                             const t = typeof l.target === 'object' ? l.target.id : l.target;
                             
                             if (s === menuS && t === menuT) {
                               return { ...l, reactions: { ...(l.reactions || {}), [emoji]: (l.reactions?.[emoji] || 0) + 1 } };
                             }
                             return l; 
                           })
                        }));
                        setLinkPopup(null); // Fast local ui dismissal

                        // 2. Perform DB Toggle logic on Supabase seamlessly 
                        await supabase.rpc('toggle_link_reaction', { 
                          p_source: menuS, 
                          p_target: menuT,
                          p_emoji: emoji 
                        });
                        
                        // 3. Resolves UI into factual DB Truth (Solves double hits + tracks removals securely avoiding Engine loss errors!) 
                        fetchGlobalGraph();
                     }}
                     className="hover:scale-[1.3] active:scale-95 hover:-translate-y-1 transition-all cursor-pointer text-lg bg-pink-50 rounded-md border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] px-1"
                   >{emoji}</button>
                 ))}
               </div>

               <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-b-4 border-r-4 border-black rotate-45"></div>
             </div>
          </div>
        )}
        
        {/* QUICK CONNECT QR MODAL */}
        {showQRModal && myPrimaryNode && <QuickQRModal myPrimaryNode={myPrimaryNode} onClose={() => setShowQRModal(false)} onRefreshGraph={fetchGlobalGraph} />}

        {/* DAILY QUEST MODAL */}
        {showQuestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pointer-events-auto">
             <div className="bg-yellow-400 border-4 border-black p-5 sm:p-8 rounded-3xl shadow-[8px_8px_0px_rgba(0,0,0,1)] transform rotate-1 w-full max-w-sm text-center relative animate-in zoom-in">
                <button onClick={() => setShowQuestModal(false)} className="absolute -top-3 -right-3 bg-red-400 text-black border-4 border-black rounded-full w-10 h-10 flex items-center justify-center font-black text-xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform z-10 cursor-pointer">✖</button>
                <div className="text-4xl sm:text-5xl mb-2 select-none mt-2 drop-shadow-md">📜</div>
                <h2 className="text-black font-black uppercase text-base sm:text-xl tracking-widest leading-tight">Today's <br/><span className="text-pink-600 bg-white border-2 border-black px-3 mt-2 py-1.5 rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,1)] inline-block relative -rotate-2">Active Mission</span></h2>
                <div className="bg-white/90 border-4 border-black border-dashed mt-6 rounded-2xl p-5 font-black text-[14px] sm:text-[15px] leading-snug drop-shadow-sm flex items-center justify-center text-slate-800 break-words w-full h-auto shadow-[inset_2px_2px_5px_rgba(0,0,0,0.1)]">
                  {TODAYS_QUEST}
                </div>
                <p className="mt-5 text-[10px] sm:text-xs font-black uppercase text-slate-700 tracking-wider">Tick the "Mission" box when logging a deed to activate your reward! ✨</p>
             </div>
          </div>
        )}
{/* 🛒 GAMIFIED TABBED K-SHOP */}
        {showShopModal && session && myPrimaryNode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 pointer-events-auto">
             <div className="w-full max-w-3xl relative animate-in zoom-in duration-200 max-h-[95vh] flex flex-col">
                
                {/* FLOATING HEADER & COINS */}
                <div className="flex justify-between items-end mb-4 relative z-10 px-1 sm:px-2 shrink-0">
                   <div className="bg-yellow-400 border-4 border-black rounded-2xl px-4 sm:px-6 py-2 shadow-[6px_6px_0px_rgba(0,0,0,1)] transform -rotate-2">
                     <h2 className="text-black font-black uppercase text-xl sm:text-2xl tracking-widest drop-shadow-sm">🛒 K-Shop</h2>
                   </div>
                   <div className="bg-white border-4 border-black rounded-2xl px-4 sm:px-6 py-2 shadow-[6px_6px_0px_rgba(0,0,0,1)] transform rotate-2 flex items-center gap-1.5 sm:gap-2">
                     🪙 <span className="text-lime-600 font-black text-lg sm:text-xl">{myPrimaryNode?.coins || 0}</span>
                   </div>
                </div>

              {/* SHOP TABS (Horizontal Swipe bar replacing broken stacked grid) */}
                <div className="flex overflow-x-auto snap-x gap-2 mb-[-15px] relative z-20 px-2 sm:px-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] shrink-0">
                  {[
                    { id: 'themes', icon: '🗺️', label: 'Map' }, { id: 'titles', icon: '🏷️', label: 'Titles' },
                    { id: 'frames', icon: '🖼️', label: 'Frames' }, { id: 'auras', icon: '✨', label: 'Auras' },
                    { id: 'shapes', icon: '🟢', label: 'Shapes' }, { id: 'beams', icon: '🚀', label: 'Beams' },
                    { id: 'verified', icon: '💎', label: 'Verify' }, { id: 'coins', icon: '💰', label: 'Coins' }
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setShopTab(tab.id)} style={{ transform: 'skewX(-5deg)' }} className={`w-16 sm:w-20 shrink-0 flex flex-col items-center justify-center py-2 border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform snap-start ${shopTab === tab.id ? 'bg-cyan-400 -translate-y-2' : 'bg-slate-200 hover:bg-slate-100'} cursor-pointer`}>
                       <span style={{ transform: 'skewX(5deg)' }} className="text-xl sm:text-2xl mb-0.5">{tab.icon}</span>
                       <span style={{ transform: 'skewX(5deg)' }} className="text-[9px] font-black uppercase tracking-wider">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* MAIN SHOP CONTENT AREA (Scrollable Height Fix with Un-Clipped Close Button) */}
                <div className="bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_rgba(0,0,0,1)] sm:shadow-[12px_12px_0px_rgba(0,0,0,1)] relative z-10 flex-1 flex flex-col min-h-[50vh] max-h-[60vh]">
                  {/* CLOSE BUTTON - Moved OUTSIDE the overflow-y-auto div so it NEVER gets clipped on Windows/Desktop! */}
                  <button onClick={() => setShowShopModal(false)} className="absolute top-2 right-2 sm:-top-4 sm:-right-4 bg-red-500 text-white border-4 border-black rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center font-black text-xl sm:text-2xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] cursor-pointer z-50">✖</button>
                  
                  {/* The actual scrolling content wrapper */}
                  <div className="p-4 sm:p-6 pt-12 sm:pt-10 overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] rounded-3xl">
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 h-full mt-2 sm:mt-0">
                    {shopTab === 'themes' && <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{SHOP_THEMES.map(item => renderShopButton(item, 'mapTheme', myPrimaryNode?.cosmetics?.mapTheme || 'classic'))}</div>}
                    {shopTab === 'titles' && <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{SHOP_TITLES.map(item => renderShopButton(item, 'title', myPrimaryNode?.cosmetics?.title))}</div>}
                    {shopTab === 'frames' && <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{SHOP_FRAMES.map(item => renderShopButton(item, 'frame', myPrimaryNode?.cosmetics?.frame || 'none'))}</div>}
                    {shopTab === 'auras' && <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{SHOP_EFFECTS.map(item => renderShopButton(item, 'effect', myPrimaryNode?.cosmetics?.effect || 'none'))}</div>}
                    {shopTab === 'shapes' && <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{SHOP_SHAPES.map(item => renderShopButton(item, 'shape', myPrimaryNode?.shape || 'circle'))}</div>}
                    {shopTab === 'beams' && <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{SHOP_ARROWS.map(item => renderShopButton(item, 'arrow', myPrimaryNode?.cosmetics?.arrow || 'classic'))}</div>}
                    
                    {shopTab === 'verified' && (
                      <div className="flex items-center justify-center h-full pt-4">
                        <div className="bg-blue-50 border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)] w-full max-w-md text-center transform -rotate-1">
                          <svg className="w-16 h-16 text-blue-500 fill-current mx-auto mb-4 drop-shadow-md" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                          <h3 className="font-black text-2xl uppercase mb-2">Verified Badge</h3>
                          <p className="text-xs font-bold text-slate-500 uppercase mb-6">Equip this free badge to stand out on the map!</p>
                          <button 
                            onClick={async (e) => {
                                e.preventDefault(); e.stopPropagation();
                                const isVerif = !(myPrimaryNode?.cosmetics?.verified);
                                setGlobalGraph(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === myPrimaryNode.id ? { ...n, verified: isVerif, cosmetics: { ...(n.cosmetics || {}), verified: isVerif } } : n) }));
                                
                                const freshCosm = myPrimaryNode.cosmetics || {};
                                await supabase.rpc('equip_cosmetics', { 
                                  p_node: myPrimaryNode.id, p_shape: myPrimaryNode.shape, p_effect: freshCosm.effect, p_arrow: freshCosm.arrow, 
                                  p_title: freshCosm.title, p_map_theme: freshCosm.mapTheme, p_frame: freshCosm.frame, p_verified: isVerif 
                                }); 
                            }}
                            className={`w-full py-4 font-black uppercase text-xl rounded-xl border-4 border-black transition-transform active:scale-95 shadow-[6px_6px_0px_rgba(0,0,0,1)] cursor-pointer select-none ${myPrimaryNode?.cosmetics?.verified ? 'bg-red-400 text-white' : 'bg-lime-400 text-black'}`}
                          >
                            {myPrimaryNode?.cosmetics?.verified ? 'Remove Badge ❌' : 'Equip Badge ✅'}
                          </button>
                        </div>
                      </div>
                    )}

                    {shopTab === 'coins' && (
                      <div className="flex flex-col h-full pt-4">
                        <h3 className="text-center font-black uppercase text-slate-600 mb-4 bg-slate-100 p-2 rounded-lg border-2 border-slate-300 border-dashed">
                          Future Payment Test - Claim free coins for now!
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {COIN_PACKS.map(pack => (
                            <div key={pack.id} className="bg-gradient-to-b from-yellow-50 to-yellow-200 border-4 border-black rounded-2xl p-5 shadow-[6px_6px_0px_rgba(0,0,0,1)] text-center flex flex-col items-center justify-between transform hover:-translate-y-1 transition-transform">
                              <span className="text-4xl mb-3 drop-shadow-md">💰</span>
                              <h3 className="font-black uppercase text-sm mb-1 leading-tight">{pack.label}</h3>
                              <p className="text-2xl font-black text-lime-600 mb-4 bg-white px-3 py-1 border-2 border-black rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,1)]">+{pack.amount}</p>
                              <button
                                onClick={() => handleBuyCoins(pack)}
                                className="w-full bg-lime-400 hover:bg-lime-300 text-black border-4 border-black rounded-xl py-3 font-black uppercase tracking-widest shadow-[4px_4px_0px_rgba(0,0,0,1)] active:scale-95 cursor-pointer"
                              >
                                Buy ({pack.priceStr})
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* NAVBAR (Standardized Layout) */}
        <nav className="flex flex-wrap justify-between items-center py-2 px-3 sm:py-3 sm:px-6 bg-[#fdfbf7]/90 backdrop-blur-md border-b-2 sm:border-b-4 border-black sticky top-0 z-40 gap-2 sm:gap-4 pointer-events-auto w-full">
          
          {/* INLINE LOGO */}
          <Link to="/" className="hover:scale-105 transition-transform shrink-0 z-50 pointer-events-auto flex items-center">
            <img src="/logo.png" alt="KSPHERE WORLD" className="h-8 sm:h-12 md:h-14 lg:h-16 w-auto object-contain drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]" />
          </Link>
          
          {/* BRAWL BUTTONS CONTAINER */}
          <div className="flex flex-wrap items-center justify-end gap-x-1.5 sm:gap-x-3 gap-y-1.5 sm:gap-y-2 ml-auto">
            
            {isAuthLoading ? (
               <div className="w-5 h-5 border-[3px] border-black border-t-transparent rounded-full animate-spin"></div>
            ) : session ? (
              <>
               {/* Slanted Avatar Badge */}
                <div 
                  className="hidden lg:flex items-center bg-yellow-300 border-[3px] border-black rounded-lg shrink-0 shadow-[-1px_1px_0_#000,-2px_2px_0_#000,-3px_3px_0_#000,-4px_4px_0_#000,-4px_5px_0_#000]" 
                  style={{ transform: 'skewX(-8deg)' }}
                >
                  <div style={{ transform: 'skewX(8deg)' }} className="flex items-center gap-2 px-3 py-1.5">
                    <img
                      src={session.user.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} 
                      alt="avatar" 
                      className="w-6 h-6 rounded-full border-2 border-black bg-white object-cover" 
                    />
                    <span className="text-[11px] font-black text-black max-w-[90px] truncate uppercase tracking-wider">
                      {session.user.user_metadata?.full_name?.split(' ')[0] || 'User'}
                    </span>
                  </div>
                </div>
                
                <BrawlButton icon="⚙️" text="Settings" colorScheme="blue" onClick={() => setShowSettings(true)} hideTextOnMobile={true} />
                <BrawlButton icon="🔔" text="Requests" colorScheme="pink" onClick={() => setShowRequests(true)} hideTextOnMobile={true} />
                <BrawlButton icon="🛒" text="K-Shop" colorScheme="yellow" onClick={() => setShowShopModal(true)} hideTextOnMobile={true} />
                <BrawlButton icon="🧩" text="Nodes" colorScheme="purple" onClick={() => setShowNodeManager(true)} hideTextOnMobile={true} />
                <BrawlButton icon="🚪" text="Logout" colorScheme="dark" onClick={handleLogout} hideTextOnMobile={true} />
              </>
            ) : (
              <BrawlButton text="Sign In" colorScheme="white" onClick={handleGoogleLogin} />
            )}

            <div className="hidden xl:block">
              <BrawlButton icon="📖" text="How it works" colorScheme="white" onClick={() => setShowTutorial(true)} />
            </div>

            <BrawlButton icon="🚀" text="Join Chain" colorScheme="green" isLink={true} to="/join" />
          </div>
        </nav>

        <main className={`flex-grow relative w-full overflow-hidden flex flex-col transition-colors duration-500 ${
          myPrimaryNode?.mapTheme === 'midnight' ? 'bg-[#0f172a]' :
          myPrimaryNode?.mapTheme === 'galaxy' ? 'bg-[#09090b]' :
          myPrimaryNode?.mapTheme === 'sakura' ? 'bg-[#fdf2f8]' :
          'bg-[#fdfbf7]'
        }`}>
          
          {/* 🗺️ MAP THEME BACKGROUND EFFECTS */}
          {myPrimaryNode?.mapTheme === 'midnight' && (
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#22c55e30 2px, transparent 2px), linear-gradient(90deg, #22c55e30 2px, transparent 2px)', backgroundSize: '40px 40px', opacity: 0.8 }}></div>
          )}
          {myPrimaryNode?.mapTheme === 'galaxy' && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
               {/* Custom CSS animated stars */}
               <div className="absolute w-2 h-2 bg-white rounded-full top-[10%] left-[20%] shadow-[0_0_10px_#fff] animate-ping opacity-70"></div>
               <div className="absolute w-1 h-1 bg-purple-400 rounded-full top-[40%] left-[70%] shadow-[0_0_10px_#c084fc] animate-pulse"></div>
               <div className="absolute w-3 h-3 bg-pink-400 rounded-full top-[80%] left-[30%] shadow-[0_0_15px_#f472b6] animate-pulse"></div>
               <div className="absolute w-1.5 h-1.5 bg-blue-300 rounded-full top-[25%] left-[85%] shadow-[0_0_12px_#93c5fd] animate-ping opacity-50"></div>
               <div className="absolute w-2 h-2 bg-yellow-100 rounded-full top-[65%] left-[15%] shadow-[0_0_12px_#fef08a] animate-pulse opacity-80"></div>
            </div>
          )}
          {myPrimaryNode?.mapTheme === 'sakura' && (
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#f9a8d4 3px, transparent 0)', backgroundSize: '40px 40px', opacity: 0.5 }}></div>
          )}
          {(!myPrimaryNode?.mapTheme || myPrimaryNode?.mapTheme === 'classic') && (
             <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 2px, transparent 0)', backgroundSize: '30px 30px' }}></div>
          )}

          {/* ALWAYS RENDER MAP IN BACKGROUND (Prevents unmounting & scattering when switching pages!) */}
          <div 
            className="absolute inset-0 z-0"
            style={{ touchAction: 'none' }} // 🔥 MAGIC BULLET 1: Blocks mobile browser scroll interception allowing Canvas to process Taps accurately!
            onPointerDownCapture={handleMapInteractionStart}
            onPointerUpCapture={handleMapInteractionEnd}
            onPointerCancelCapture={handleMapInteractionEnd}
          >
            <KindnessGraph 
              data={globalGraph} 
              onNodeClick={handleNodeClick} 
              onLinkClick={handleLinkClick}
              onBackgroundClick={handleBackgroundClick}
            /> 
          </div>

          <Routes>
             <Route path="/" element={
                <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 pb-8 sm:p-6 lg:p-8 overflow-hidden">
                  
                  {/* TOP LEFT: LIVE BADGE & REFRESH BUTTON */}
                  {/* Disabled pointer blocking dynamically, letting interactive boundaries control click propagation directly */}
                  <div id="ui-top" className="flex flex-col items-start gap-2 sm:gap-3 pointer-events-none select-none transition-all duration-300 ease-in-out md:translate-y-0 md:opacity-100">
                    
                    {/* Elements function structurally like mirror-glass so users scroll freely hitting map limits natively! */}
                    <div className="bg-white border-2 sm:border-4 border-black px-2 py-1 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl shadow-[2px_2px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] font-black text-[9px] sm:text-sm flex items-center gap-1.5 sm:gap-2 transform -rotate-2 w-max pointer-events-none">
                      <span className="relative flex h-2 w-2 sm:h-3 sm:w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 sm:h-3 sm:w-3 bg-green-500"></span></span> 
                      GLOBAL NETWORK LIVE
                    </div>

                    {/* BUTTON CONTAINER FOR REFRESH & QUEST */}
                    <div className="flex flex-col gap-2 sm:gap-3 pointer-events-auto ml-1 sm:ml-2 mt-1">
                      
                      {/* MAP REFRESH BUTTON */}
                      <button 
                        onClick={handleManualRefresh}
                        className="bg-blue-500 hover:bg-blue-400 text-white border-2 sm:border-4 border-black rounded-lg sm:rounded-xl w-8 h-8 sm:w-11 sm:h-11 flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] transform rotate-1 hover:-translate-y-1 transition-all cursor-pointer active:scale-95"
                        title="Refresh & Recenter Map"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>

                      {/* THE MINI QUEST BUTTON - Pings elegantly! */}
                      <button 
                        onClick={() => setShowQuestModal(true)}
                        className="bg-yellow-400 hover:bg-yellow-300 text-[18px] sm:text-[22px] border-2 sm:border-4 border-black rounded-lg sm:rounded-xl w-8 h-8 sm:w-11 sm:h-11 flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] transform -rotate-3 hover:-translate-y-1 transition-all cursor-pointer active:scale-95 relative group"
                        title="Check Today's Quest Mission"
                      >
                        <div className="group-hover:animate-bounce transform rotate-3 flex items-center justify-center drop-shadow-sm select-none leading-none">📜</div>
                        {/* Red Dot Notifications Hook Loop Tracker Map  */}
                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full border border-black animate-ping"></div>
                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full border border-black shadow-sm"></div>
                      </button>

                    </div>

                  </div>

                  {/* BOTTOM SECTION: ALL ON ONE ROW (flex-row) */}
                  <div id="ui-bottom" className="flex flex-row justify-between items-end gap-2 sm:gap-6 pointer-events-none w-full transition-all duration-300 ease-in-out md:translate-y-0 md:opacity-100">
                    
                    {/* BOTTOM LEFT: USER INFO */}
                    <div className="flex flex-col items-start gap-1.5 sm:gap-3 w-auto pointer-events-none select-none">
                      {session && myPrimaryNode ? (
                        <>
                          <div className="bg-yellow-300 border-2 sm:border-4 border-black rounded-full px-2.5 py-0.5 sm:px-4 sm:py-1 w-max shadow-[2px_2px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] md:-rotate-2 transition-transform pointer-events-none">
                            <span className="font-black text-black text-[10px] sm:text-sm uppercase tracking-wider">🏆 Rank: #{myRankNumber}</span>
                          </div>
                          <h1 className="text-xl sm:text-4xl md:text-5xl font-black leading-none text-black tracking-tight drop-shadow-sm mt-0.5 mb-1 sm:mb-2 bg-white/90 px-2 py-1.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 sm:border-4 border-black w-max backdrop-blur-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] md:rotate-1 transition-transform pointer-events-none">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">{myRank}</span>
                          </h1>
                          
                          <div className="flex flex-col gap-1.5 sm:gap-3 w-max pointer-events-none">
                            {/* Retains transition structure while nulling browser DOM intercept logic cleanly */}
                            <div className="bg-lime-300 border-2 sm:border-4 border-black rounded-lg sm:rounded-2xl px-2 py-1 sm:p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] md:rotate-1 transition-transform w-max pointer-events-none">
                              <span className="font-black text-black text-[10px] sm:text-base uppercase tracking-wider flex items-center gap-1.5 sm:gap-2">
                                🤝 You helped <span className="text-xs sm:text-xl bg-white border border-black sm:border-2 rounded-md sm:rounded-lg px-1.5 sm:px-2 py-0.5 shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)]">{myHelpedCount}</span>
                              </span>
                            </div>
                            <div className="bg-cyan-300 border-2 sm:border-4 border-black rounded-lg sm:rounded-2xl px-2 py-1 sm:p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] md:-rotate-1 transition-transform w-max pointer-events-none">
                              <span className="font-black text-black text-[10px] sm:text-base uppercase tracking-wider flex items-center gap-1.5 sm:gap-2">
                                💖 Helped by <span className="text-xs sm:text-xl bg-white border border-black sm:border-2 rounded-md sm:rounded-lg px-1.5 sm:px-2 py-0.5 shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)]">{myHelpedByCount}</span>
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="bg-white/90 backdrop-blur-md border-2 sm:border-4 border-black rounded-xl sm:rounded-3xl p-3 sm:p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_rgba(0,0,0,1)] transform rotate-1 pointer-events-none">
                          <h1 className="text-xl sm:text-4xl font-black leading-none text-black tracking-tight drop-shadow-sm mb-1.5 sm:mb-3">
                            Your impact, <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">fully custom.</span>
                          </h1>
                          <p className="text-slate-700 text-[10px] sm:text-base font-bold leading-relaxed max-w-[160px] sm:max-w-none">
                            Start a chain of kindness today and leave your unique mark on the world's graph. 🌍
                          </p>
                        </div>
                      )}
                    </div>

                    {/* BOTTOM RIGHT: ACTIONS & STATS */}
                    <div className="flex flex-col items-end gap-2 sm:gap-4 w-auto pointer-events-none select-none z-10">
                      
                      {/* QUICK CONNECT BUTTON: Force events internally auto exclusively restoring pointer functionality manually cleanly targeting elements properly bound! */}
                      {session && myPrimaryNode && (
                        <div onClick={() => setShowQRModal(true)} className="pointer-events-auto bg-yellow-400 border-2 sm:border-4 border-black rounded-xl sm:rounded-3xl p-1.5 sm:p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1.5 sm:gap-3 md:-rotate-2 hover:rotate-0 hover:-translate-y-1 sm:hover:-translate-y-2 transition-all cursor-pointer hover:bg-yellow-300 group w-max self-end">
                          <div className="bg-black text-white p-1.5 sm:p-3 rounded-lg sm:rounded-xl transform group-hover:scale-110 transition-transform shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)] border border-black sm:border-2 flex items-center justify-center">
                            <span className="text-[18px] sm:text-3xl">⚡</span>
                          </div>
                          <div className="flex flex-col text-left pr-1.5 sm:pr-2">
                            <span className="font-black text-black uppercase text-xs sm:text-xl leading-none tracking-tight">Quick Connect</span>
                            <span className="text-[8px] sm:text-xs font-black text-slate-800 uppercase mt-0.5 sm:mt-1 tracking-widest bg-white/80 px-1.5 sm:px-2 py-0.5 rounded-md border border-black sm:border-2 w-max">Scan / Show QR 📷</span>
                          </div>
                        </div>
                      )}

                      {/* STATS DASHBOARD -> Inherits Glass Pass-through perfectly from Wrapper Layout Logic overrides.  */}
                      {session && (
                        <div className="pointer-events-none bg-white/90 backdrop-blur-md border-2 sm:border-4 border-black rounded-xl sm:rounded-2xl p-1.5 sm:p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_rgba(0,0,0,1)] flex gap-1.5 sm:gap-3 w-max overflow-x-auto md:rotate-1 self-end">
                          <div className="bg-slate-100 border sm:border-2 border-black rounded-lg sm:rounded-xl px-2 sm:px-3 py-1 sm:py-2 text-center shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)] min-w-[42px] sm:min-w-[70px]">
                            <p className="text-sm sm:text-xl font-black text-black leading-none">{totalNodes}</p>
                            <p className="text-[8px] sm:text-[9px] font-black uppercase text-slate-800 mt-0.5 sm:mt-1">Nodes</p>
                          </div>
                          <div className="bg-slate-100 border sm:border-2 border-black rounded-lg sm:rounded-xl px-2 sm:px-3 py-1 sm:py-2 text-center shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)] min-w-[42px] sm:min-w-[70px]">
                            <p className="text-sm sm:text-xl font-black text-black leading-none">{totalConnections}</p>
                            <p className="text-[8px] sm:text-[9px] font-black uppercase text-slate-800 mt-0.5 sm:mt-1">Links</p>
                          </div>
                          <div className="bg-slate-100 border sm:border-2 border-black rounded-lg sm:rounded-xl px-2 sm:px-3 py-1 sm:py-2 text-center shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)] min-w-[42px] sm:min-w-[70px]">
                            <p className="text-sm sm:text-xl font-black text-black leading-none">{activeChainsCount}</p>
                            <p className="text-[8px] sm:text-[9px] font-black uppercase text-slate-800 mt-0.5 sm:mt-1">Chains</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div> 
            } />
            <Route path="/join" element={<div className="relative z-10 w-full h-full overflow-y-auto pointer-events-auto flex items-start justify-center pt-8 pb-20 bg-white/40 backdrop-blur-sm"><LogKindnessForm onComplete={setUserData} session={session} isAuthLoading={isAuthLoading} /></div>} />
            <Route path="/dashboard" element={<div className="relative z-10 w-full h-full overflow-y-auto pointer-events-auto bg-white/40 backdrop-blur-sm"><Dashboard userData={userData} /></div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;