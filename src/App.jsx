// frontend/src/App.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import KindnessGraph from './components/KindnessGraph';
import { supabase } from './supabaseClient';
import { Scanner } from '@yudiel/react-qr-scanner';
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

  // FIX 1: Changed rounded-xl to rounded-lg for less rounded corners
  const baseClasses = `inline-flex items-center justify-center rounded-lg border-[3px] border-black active:scale-95 transition-transform duration-75 shrink-0 whitespace-nowrap cursor-pointer select-none ${className}`;

  // FIX 2: Solid block shadow (fixes the subpixel white gap at the bottom of skewed elements)
  const buttonStyle = {
    transform: 'skewX(-8deg)',
    boxShadow: '-1px 1px 0 #000, -2px 2px 0 #000, -3px 3px 0 #000, -4px 4px 0 #000, -4px 5px 0 #000',
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
// --- SETTINGS MODAL ---
function SettingsModal({ session, onClose }) {
  const [name, setName] = useState(session?.user?.user_metadata?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(session?.user?.user_metadata?.avatar_url || '');
  
  // K-Tag Modification State
  const [kTag, setKTag] = useState('');
  const [oldKTag, setOldKTag] = useState('');
  const [isKtagLocked, setIsKtagLocked] = useState(false);
  const [lockDaysLeft, setLockDaysLeft] = useState(0);

  // Social Links State
  const initialSocials = session?.user?.user_metadata?.socials || {};
  const [instagram, setInstagram] = useState(initialSocials.instagram || '');
  const [twitter, setTwitter] = useState(initialSocials.twitter || '');
  const [youtube, setYoutube] = useState(initialSocials.youtube || '');
  const [facebook, setFacebook] = useState(initialSocials.facebook || '');
  const [website, setWebsite] = useState(initialSocials.website || '');

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [msg, setMsg] = useState('');

  // Fetch current node and backend timer on mount
  useEffect(() => {
    const fetchNode = async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase.from('nodes')
        .select('id, last_ktag_change')
        .eq('user_id', session.user.id)
        .eq('is_claimed', true)
        .limit(1);
        
      if (data && data.length > 0) {
        setKTag(data[0].id);
        setOldKTag(data[0].id);
        
        // Read actual database timer!
        const lastChange = data[0].last_ktag_change;
        if (lastChange) {
          const daysSince = (Date.now() - new Date(lastChange).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 7) {
            setIsKtagLocked(true);
            setLockDaysLeft(Math.ceil(7 - daysSince));
          }
        }
      }
    };
    fetchNode();
  }, [session]);

  const handleAvatarUpload = async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      setMsg('');
      const fileExt = file.name.split('.').pop();
      const fileName = `${session?.user?.id || 'user'}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      if (data?.publicUrl) {
        setAvatarUrl(data.publicUrl);
        setMsg('✅ Image uploaded successfully!');
      }
    } catch (error) {
      setMsg(`⚠️ Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg('');

    try {
      const socials = { instagram, twitter, youtube, facebook, website };
      let newMetadata = { full_name: name, avatar_url: avatarUrl, socials };
      
      let cleanNewTag = kTag.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
      if (!cleanNewTag) throw new Error("K-Tag cannot be empty.");

      // Migration Logic! Only runs if the input actually changed
      if (cleanNewTag !== oldKTag) {
        if (isKtagLocked) throw new Error(`K-Tag is locked for ${lockDaysLeft} more days.`);
        if (cleanNewTag.length < 3) throw new Error("K-Tag must be at least 3 characters.");

        // Check availability
        const { data: existing } = await supabase.from('nodes').select('id').eq('id', cleanNewTag).limit(1);
        if (existing && existing.length > 0) throw new Error(`⚠️ K-Tag "${cleanNewTag}" is already taken! Try another.`);

        if (oldKTag) {
          // A single, elegant UPDATE. The backend cascade handles the links!
          // And the backend trigger handles the 7-day timer!
          const { error: updateErr } = await supabase.from('nodes').update({ 
            id: cleanNewTag,
            socials 
          }).eq('id', oldKTag);
          
          if (updateErr) {
             // If the timer blocks them, it will show the backend's error message here!
             throw new Error(updateErr.message || "Failed to update K-Tag.");
          }
        } else {
           // Fallback if they didn't have an ID for some reason
           await supabase.from('nodes').insert({
             id: cleanNewTag,
             user_id: session.user.id,
             shape: 'circle',
             type: 'image',
             value: avatarUrl,
             socials: socials,
             is_claimed: true
           });
        }

        // Database trigger handles the real timestamp automatically now
        setOldKTag(cleanNewTag);
        setIsKtagLocked(true);
        setLockDaysLeft(7);
      } else if (oldKTag) {
        // If they didn't change their tag, just update socials on their existing node
        await supabase.from('nodes').update({ socials }).eq('id', oldKTag);
      }

      // Sync metadata with authentication
      const { error } = await supabase.auth.updateUser({ data: newMetadata });
      if (error) throw new Error("Settings applied but Auth Sync failed.");
      
      onClose(); // Success!
    } catch (error) {
      setMsg(`⚠️ ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border-2 sm:border-4 border-black rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_rgba(0,0,0,1)] w-[95%] sm:w-full max-w-lg relative transform sm:rotate-1 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 bg-red-400 text-black border-4 border-black rounded-full w-10 h-10 flex items-center justify-center font-black text-xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform z-10 cursor-pointer">
          ✖
        </button>
        <h2 className="text-2xl font-black mb-6 uppercase tracking-tight transform -rotate-2 w-max bg-blue-300 px-3 py-1 border-2 border-black rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)] text-black">
          ⚙️ Edit Profile & Links
        </h2>
        
        {msg && <p className="mb-4 text-xs font-bold text-slate-900 bg-yellow-200 p-2.5 border-2 border-black rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,1)]">{msg}</p>}
        
        <form onSubmit={handleSave} className="flex flex-col gap-5 transform -rotate-1">
          
          {/* K-TAG MODIFIER */}
          <div className="bg-blue-50 border-2 border-black border-dashed p-3 rounded-xl mb-2">
            <label className="block text-xs font-black uppercase mb-1 text-black flex justify-between">
              Your Unique K-Tag
              {isKtagLocked && <span className="text-red-500">🔒 Locked ({lockDaysLeft}d)</span>}
            </label>
            <input type="text" value={kTag} onChange={e => setKTag(e.target.value)} required disabled={isKtagLocked}
              className={`w-full border-4 border-black rounded-xl p-3 font-black uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-colors ${isKtagLocked ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'focus:outline-none focus:bg-white bg-white'}`} />
            {!isKtagLocked && <p className="text-[10px] font-bold text-slate-600 mt-2 leading-tight">You can change this <b>once every 7 days</b>. Changing it will instantly update your node on the global map!</p>}
          </div>

          <div>
            <label className="block text-xs font-black uppercase mb-1 text-black">Display Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="w-full border-4 border-black rounded-xl p-3 font-bold focus:outline-none focus:bg-blue-50 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-colors" />
          </div>

          <div>
            <label className="block text-xs font-black uppercase mb-1 text-black">Upload New Avatar 🖼️</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleAvatarUpload}
              disabled={isUploading}
              className="w-full border-4 border-black rounded-xl p-2 font-bold focus:outline-none bg-blue-50 shadow-[4px_4px_0px_rgba(0,0,0,1)] file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-2 file:border-black file:bg-yellow-300 file:font-black file:cursor-pointer hover:file:bg-yellow-200 text-xs cursor-pointer" 
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase mb-1 text-black">Or Image URL</label>
            <input type="url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} required
              className="w-full border-4 border-black rounded-xl p-2.5 font-bold focus:outline-none focus:bg-blue-50 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-colors text-xs" />
          </div>

          {/* SOCIAL LINKS SECTION */}
          <div className="border-t-4 border-black border-dashed pt-4 flex flex-col gap-3">
            <h3 className="font-black uppercase text-sm bg-pink-300 px-3 py-1 border-2 border-black rounded-xl w-max shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              🌐 Social Media Handles
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700">📸 Instagram</label>
                <input type="text" placeholder="https://instagram.com/yourhandle" value={instagram} onChange={e => setInstagram(e.target.value)}
                  className="w-full border-2 border-black rounded-xl p-2 text-xs font-bold focus:bg-pink-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700">🐦 Twitter / X</label>
                <input type="text" placeholder="https://x.com/yourhandle" value={twitter} onChange={e => setTwitter(e.target.value)}
                  className="w-full border-2 border-black rounded-xl p-2 text-xs font-bold focus:bg-cyan-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700">🔴 YouTube</label>
                <input type="text" placeholder="https://youtube.com/@channel" value={youtube} onChange={e => setYoutube(e.target.value)}
                  className="w-full border-2 border-black rounded-xl p-2 text-xs font-bold focus:bg-red-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700">📘 Facebook</label>
                <input type="text" placeholder="https://facebook.com/profile" value={facebook} onChange={e => setFacebook(e.target.value)}
                  className="w-full border-2 border-black rounded-xl p-2 text-xs font-bold focus:bg-blue-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-700">🔗 Website / Portfolio</label>
              <input type="url" placeholder="https://yourwebsite.com" value={website} onChange={e => setWebsite(e.target.value)}
                className="w-full border-2 border-black rounded-xl p-2 text-xs font-bold focus:bg-lime-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]" />
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-100 p-3 rounded-xl border-2 border-black border-dashed mt-1">
            <img src={avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="Preview" className="w-12 h-12 rounded-full border-2 border-black bg-white object-cover" />
            <p className="text-xs font-bold text-slate-600">
              {isUploading ? 'Uploading file...' : 'Preview of your active avatar & social badges.'}
            </p>
          </div>

          <button type="submit" disabled={isLoading || isUploading} className="mt-2 bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-black text-lg font-black py-3 rounded-xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all uppercase tracking-widest cursor-pointer">
            {isLoading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
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
  const socials = node.socials || {};

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
            {socials.instagram && (
              <a href={socials.instagram} target="_blank" rel="noopener noreferrer" 
                className="bg-pink-400 hover:bg-pink-300 text-black border-2 border-black rounded-xl px-3 py-2 font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5">
                📸 Instagram
              </a>
            )}
            {socials.twitter && (
              <a href={socials.twitter} target="_blank" rel="noopener noreferrer" 
                className="bg-cyan-300 hover:bg-cyan-200 text-black border-2 border-black rounded-xl px-3 py-2 font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5">
                🐦 Twitter / X
              </a>
            )}
            {socials.youtube && (
              <a href={socials.youtube} target="_blank" rel="noopener noreferrer" 
                className="bg-red-400 hover:bg-red-300 text-black border-2 border-black rounded-xl px-3 py-2 font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5">
                🔴 YouTube
              </a>
            )}
            {socials.facebook && (
              <a href={socials.facebook} target="_blank" rel="noopener noreferrer" 
                className="bg-blue-400 hover:bg-blue-300 text-black border-2 border-black rounded-xl px-3 py-2 font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5">
                📘 Facebook
              </a>
            )}
            {socials.website && (
              <a href={socials.website} target="_blank" rel="noopener noreferrer" 
                className="bg-yellow-300 hover:bg-yellow-200 text-black border-2 border-black rounded-xl px-3 py-2 font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5">
                🌐 Website
              </a>
            )}

            {!socials.instagram && !socials.twitter && !socials.youtube && !socials.facebook && !socials.website && (
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
// --- NODE MANAGER MODAL ---
function NodeManagerModal({ session, onClose, onRefreshGraph }) {
  const [myNodes, setMyNodes] = useState([]);
  const [claimTag, setClaimTag] = useState('');
  const [claimPin, setClaimPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchMyNodes = useCallback(async () => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    const { data } = await supabase
      .from('nodes')
      .select('*')
      .or(`user_id.eq.${userId},created_by.eq.${userId}`)
      .order('is_claimed', { ascending: false }); // Primary claimed node is forced to the top

    if (data && data.length > 0) {
      setMyNodes(data);
    } else {
      const rawName = session.user.user_metadata?.full_name || 'KIND';
      const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 10) || 'MEMBER';
      const primaryTag = `${cleanName}-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: newNode } = await supabase.from('nodes').insert({
        id: primaryTag,
        user_id: userId,
        created_by: userId,
        shape: 'circle',
        type: 'image',
        value: session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        socials: session.user.user_metadata?.socials || {},
        is_claimed: true
      }).select();

      if (newNode) setMyNodes(newNode);
      if (onRefreshGraph) onRefreshGraph();
    }
  }, [session, onRefreshGraph]);

  useEffect(() => {
    let isMounted = true;
    queueMicrotask(() => {
      if (isMounted) fetchMyNodes();
    });
    return () => { isMounted = false; };
  }, [fetchMyNodes]);

  const handleMerge = async (e) => {
    e.preventDefault();
    if (!claimTag.trim()) return;
    setIsLoading(true);
    setMsg('');

    const targetTag = myNodes[0]?.id; // Primary Node
    const sourceTag = claimTag.toUpperCase().trim();
    const enteredPin = claimPin.toUpperCase().trim();

    if (!targetTag) {
      setMsg('⚠️ You must have a primary node to merge into.');
      setIsLoading(false);
      return;
    }

    if (targetTag === sourceTag) {
      setMsg('⚠️ Cannot merge your node into itself!');
      setIsLoading(false);
      return;
    }

    try {
      const { data: nodeData, error: fetchError } = await supabase
        .from('nodes')
        .select('*')
        .eq('id', sourceTag)
        .single();

      if (fetchError || !nodeData) throw new Error("Node not found! Double check the tag.");
      if (nodeData.is_claimed) throw new Error("This node has already been claimed.");
      if (nodeData.claim_pin !== enteredPin) throw new Error("Incorrect PIN! Access denied.");

      await supabase.from('links').update({ source: targetTag }).eq('source', sourceTag);
      await supabase.from('links').update({ target: targetTag }).eq('target', sourceTag);
      await supabase.from('nodes').delete().eq('id', sourceTag);

      setMsg(`🎉 Successfully verified and merged ${sourceTag} into your profile!`);
      setClaimTag('');
      setClaimPin('');
      fetchMyNodes();
      if (onRefreshGraph) onRefreshGraph();
    } catch (err) {
      setMsg(`⚠️ ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border-2 sm:border-4 border-black rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_rgba(0,0,0,1)] w-[95%] sm:w-full max-w-lg relative transform sm:rotate-1 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 bg-red-400 text-black border-4 border-black rounded-full w-10 h-10 flex items-center justify-center font-black text-xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform z-10 cursor-pointer">
          ✖
        </button>
        
        <h2 className="text-2xl font-black mb-6 uppercase tracking-tight transform -rotate-2 w-max bg-cyan-300 px-3 py-1 border-2 border-black rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)] text-black">
          🧩 Node Manager
        </h2>

        {msg && <p className="mb-4 text-xs font-bold text-slate-900 bg-yellow-200 p-2.5 border-2 border-black rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,1)]">{msg}</p>}

        <div className="flex flex-col gap-6">
          <div>
            <h3 className="font-black text-xs uppercase mb-2 text-black bg-yellow-300 border-2 border-black px-2 py-0.5 rounded-md w-max shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              👑 My Active Nodes
            </h3>
            <div className="flex flex-col gap-3">
              {myNodes.length > 0 ? (
                myNodes.map((n) => {
                  // Fix: correctly identify unclaimed nodes even if is_claimed is null in DB
                  const isUnclaimed = !n.is_claimed || !!n.claim_pin;
                  const isPrimary = !isUnclaimed && n.user_id === session?.user?.id;
                  
                  return (
                    <div key={n.id} className="flex flex-col gap-2 bg-slate-50 border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm uppercase text-black">{n.id}</span>
                          {isUnclaimed ? (
                            <span className="text-[10px] bg-yellow-300 border border-black px-1.5 py-0.5 rounded font-black">UNCLAIMED</span>
                          ) : (
                            isPrimary && <span className="text-[10px] bg-lime-300 border border-black px-1.5 py-0.5 rounded font-black">PRIMARY</span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase">{n.shape} • {n.type}</span>
                      </div>
                      
                      {isUnclaimed ? (
                        <div className="bg-white border-2 border-dashed border-black rounded-lg p-2 text-xs font-bold flex justify-between items-center mt-1">
                          <span>PIN: <span className="text-pink-600 font-black tracking-widest">{n.claim_pin || 'MISSING'}</span></span>
                          {n.claim_pin && (
                            <button 
                              onClick={() => { navigator.clipboard.writeText(`Tag: ${n.id} | PIN: ${n.claim_pin}`); alert('Copied!'); }}
                              className="bg-black text-white px-2 py-1 rounded-md hover:-translate-y-0.5 transition-transform cursor-pointer"
                            >
                              Copy
                            </button>
                          )}
                        </div>
                      ) : isPrimary ? (
                        <div className="bg-lime-50 border-2 border-dashed border-black rounded-lg p-2 text-[10px] font-bold text-slate-700 mt-1">
                          ✅ Active Node. Anyone you help can directly link to your Tag!
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs font-bold text-slate-500 italic">No registered nodes found yet.</p>
              )}
            </div>
          </div>

          <div className="border-t-4 border-black border-dashed pt-4">
            <h3 className="font-black text-xs uppercase mb-2 text-black bg-pink-300 border-2 border-black px-2 py-0.5 rounded-md w-max shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              🔗 Claim / Merge Unclaimed Node
            </h3>
            <p className="text-xs font-bold text-slate-600 mb-3">
              Type the tag & PIN of a temporary node to claim and merge it into your primary profile!
            </p>
            <form onSubmit={handleMerge} className="flex flex-col gap-3">
              <input 
                type="text" 
                placeholder="Unclaimed K-Tag (e.g. SARAH-9921)" 
                value={claimTag} 
                onChange={e => setClaimTag(e.target.value)}
                required
                className="w-full border-4 border-black rounded-xl p-3 uppercase font-black focus:outline-none focus:bg-pink-50 shadow-[3px_3px_0px_rgba(0,0,0,1)]"
              />
              <input 
                type="text" 
                placeholder="Secret Security PIN (e.g. 1234)" 
                value={claimPin} 
                onChange={e => setClaimPin(e.target.value)}
                required
                className="w-full border-4 border-black rounded-xl p-3 uppercase font-black focus:outline-none focus:bg-yellow-50 shadow-[3px_3px_0px_rgba(0,0,0,1)]"
              />
              <button 
                type="submit" 
                disabled={isLoading}
                className="bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-black font-black py-3 rounded-xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all uppercase tracking-wider cursor-pointer text-sm"
              >
                {isLoading ? 'Verifying...' : 'Verify & Merge Into My Profile ⚡'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
// --- VERIFICATION REQUESTS MODAL ---
function RequestsModal({ session, onClose, onRefreshGraph }) {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!session?.user?.id) return;
    
    // 1. Get user's owned nodes
    const { data: myNodes } = await supabase
      .from('nodes')
      .select('id')
      .or(`user_id.eq.${session.user.id},created_by.eq.${session.user.id}`);
    
    if (!myNodes || myNodes.length === 0) return;
    const myNodeIds = myNodes.map(n => n.id);

    // 2. Query pending links targeting user's nodes
    const { data: pendingLinks } = await supabase
      .from('links')
      .select('*')
      .in('source', myNodeIds)
      .eq('status', 'pending');

    if (pendingLinks) setPendingRequests(pendingLinks);
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    queueMicrotask(() => { if (isMounted) fetchRequests(); });
    return () => { isMounted = false; };
  }, [fetchRequests]);

  const handleApprove = async (req) => {
    setIsLoading(true);
    await supabase.rpc('approve_link_request', {
      link_source: req.source,
      link_target: req.target
    });
    fetchRequests();
    if (onRefreshGraph) onRefreshGraph();
    setIsLoading(false);
  };

  const handleDecline = async (req) => {
    setIsLoading(true);
    await supabase.rpc('decline_link_request', {
      link_source: req.source,
      link_target: req.target
    });
    fetchRequests();
    if (onRefreshGraph) onRefreshGraph();
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border-2 sm:border-4 border-black rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_rgba(0,0,0,1)] w-[95%] sm:w-full max-w-md relative transform sm:-rotate-1 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute -top-3 -right-3 bg-red-400 text-black border-4 border-black rounded-full w-10 h-10 flex items-center justify-center font-black text-xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] cursor-pointer">
          ✖
        </button>
        <h2 className="text-2xl font-black mb-4 uppercase tracking-tight text-black bg-yellow-300 px-3 py-1 border-2 border-black rounded-xl w-max shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          🔔 Pending Deed Requests
        </h2>

        <div className="flex flex-col gap-3 max-h-60 overflow-y-auto">
          {pendingRequests.length > 0 ? (
            pendingRequests.map((req) => (
              <div key={`${req.source}-${req.target}`} className="bg-blue-50 border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)] flex flex-col gap-2">
                <p className="text-xs font-bold text-slate-800">
                  <span className="font-black text-black uppercase">{req.target}</span> logged a deed saying you helped them! Connect this to your node (<span className="font-black uppercase">{req.source}</span>)?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(req)} disabled={isLoading} className="flex-1 bg-lime-400 border-2 border-black rounded-lg py-1.5 font-black text-xs uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:bg-lime-300 cursor-pointer">
                    ✅ Verify & Connect
                  </button>
                  <button onClick={() => handleDecline(req)} disabled={isLoading} className="flex-1 bg-red-400 border-2 border-black rounded-lg py-1.5 font-black text-xs uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:bg-red-300 cursor-pointer">
                    ❌ Decline
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs font-bold text-slate-500 italic p-4 text-center bg-slate-50 border-2 border-black border-dashed rounded-xl">
              No pending verification requests right now.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- UNIFIED LOG KINDNESS FORM ---
function LogKindnessForm({ onComplete, session, isAuthLoading }) {
  const navigate = useNavigate();
  const [helperId, setHelperId] = useState('');
  const [isAnonymousHelper, setIsAnonymousHelper] = useState(false); // Added Anon State
  const [myId, setMyId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [claimModalUrl, setClaimModalUrl] = useState('');
  const [helperPin, setHelperPin] = useState(''); 
  const [deedComment, setDeedComment] = useState(''); // 📝 NEW: Store the story
  
  const [nodeShape, setNodeShape] = useState('circle');
  const [nodeType, setNodeType] = useState('image'); 
  const [nodeValue, setNodeValue] = useState(session?.user?.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kindness'); 
  const [linkColor, setLinkColor] = useState('#cbd5e1'); 

  const [existingTags, setExistingTags] = useState([]);
  const [filteredTags, setFilteredTags] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const fetchTags = async () => {
      const { data } = await supabase.from('nodes').select('id, is_claimed');
      if (data) setExistingTags(data);

      if (session?.user?.id) {
        // 🛑 STRICT QUERY: Must include is_claimed = true so it doesn't accidentally 
        // fetch temporary/unclaimed nodes you created for other people!
        const { data: userNodes } = await supabase.from('nodes').select('id')
          .eq('user_id', session.user.id)
          .eq('is_claimed', true)
          .limit(1);
        if (userNodes && userNodes.length > 0) {
          setMyId(userNodes[0].id);
        }
      }
    };
    fetchTags();
  }, [session]);

  const handleHelperIdChange = (e) => {
    const val = e.target.value.toUpperCase();
    setHelperId(val);
    if (val.trim()) {
      const matches = existingTags.filter(n => n.id.includes(val)).map(n => n.id);
      setFilteredTags(matches);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const isNewHelper = isAnonymousHelper || (helperId.trim() !== '' && !existingTags.some(n => n.id === helperId.trim().toUpperCase()));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session) {
      setErrorMsg("Please sign in to log a good deed!");
      return;
    }

    // 🛑 NEW: Block empty submissions!
    if (!isAnonymousHelper && !helperId.trim()) {
      setErrorMsg("Please enter the K-Tag of the person who helped you, or select 'Anonymous'!");
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    const finalMyId = myId.toUpperCase().trim();
    
    // Generate Anonymous Tag if checked, otherwise use typed text
    let finalHelperId = isAnonymousHelper 
      ? `ANON-${Math.floor(10000 + Math.random() * 90000)}` 
      : helperId.toUpperCase().trim();
      
    // Re-calculate inline for safety inside submit
    let submittingNewHelper = isAnonymousHelper || (finalHelperId !== '' && !existingTags.some(n => n.id === finalHelperId));

    try {
      const { error: nodeError } = await supabase.from('nodes').upsert({
        id: finalMyId,
        user_id: session.user.id,
        shape: nodeShape,
        type: nodeType,
        value: nodeValue,
        socials: session?.user?.user_metadata?.socials || {},
        is_claimed: true
      }, { onConflict: 'id' });

      if (nodeError) throw nodeError;

      if (finalHelperId) {
        if (submittingNewHelper) {
          const secretPin = helperPin.trim() ? helperPin.toUpperCase().trim() : 'PIN-' + Math.floor(100000 + Math.random() * 900000);

          const { error: unclaimedErr } = await supabase.from('nodes').insert({
            id: finalHelperId,
            user_id: session.user.id, // ✅ FIXED RLS VIOLATION: Assign temp ownership to creator
            shape: 'circle',
            type: 'emoji',
            value: isAnonymousHelper ? '🕵️‍♂️' : '🌱', // Spy Emoji for Anon!
            is_claimed: false,
            claim_pin: secretPin,
            created_by: session.user.id
          });

          if (unclaimedErr && unclaimedErr.code !== '23505') throw unclaimedErr;

          // You created this unclaimed node, trigger the smart backend function
          const { error: rpcError1 } = await supabase.rpc('log_kindness_link', {
            p_source: finalHelperId,
            p_target: finalMyId,
            p_color: linkColor,
            p_comment: deedComment
          });
          
          if (rpcError1) throw new Error(`Link Error: ${rpcError1.message}`);

          setClaimModalUrl(`Tag: ${finalHelperId} | PIN: ${secretPin} | Link: ${window.location.origin}?claimTag=${finalHelperId}`);
        } else {
          // Linking to an EXISTING user's node, trigger the smart backend function
          const { error: rpcError2 } = await supabase.rpc('log_kindness_link', {
            p_source: finalHelperId,
            p_target: finalMyId,
            p_color: linkColor,
            p_comment: deedComment
          });
          
          if (rpcError2) throw new Error(`Link Error: ${rpcError2.message}`);
        }
      }

      onComplete({
        myId: finalMyId,
        helperId: finalHelperId || null,
        isOriginator: !finalHelperId,
        customShape: nodeShape,
        customType: nodeType,
        customValue: nodeValue,
        customLinkColor: linkColor
      });

      if (!isNewHelper) {
        navigate('/dashboard');
      }

    } catch (error) {
      setErrorMsg(error.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="w-full max-w-xl mx-auto mt-12 text-center flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-black mb-4"></div>
        <p className="text-sm font-black uppercase tracking-widest">Checking Auth...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="w-full max-w-xl mx-auto mt-12 sm:mt-20 p-8 sm:p-12 bg-pink-300 rounded-3xl border-4 border-black text-center shadow-[8px_8px_0px_rgba(0,0,0,1)] transform rotate-1 hover:rotate-0 transition-transform mb-20">
        <h2 className="text-3xl sm:text-4xl font-black mb-4 text-black uppercase tracking-tight">🔒 Hold Up!</h2>
        <p className="text-black font-bold mb-8 text-lg">Sign in to claim your node and log acts of kindness.</p>
        <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })} 
          className="bg-lime-400 hover:bg-lime-300 text-black text-xl font-black py-4 px-8 rounded-xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all flex items-center justify-center gap-3 mx-auto cursor-pointer">
          <span>🚀</span> Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-4 sm:mt-8 p-4 sm:p-8 bg-white rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_rgba(0,0,0,1)] mb-20">
      <h1 className="text-xl sm:text-4xl font-black mb-4 sm:mb-6 text-black text-center tracking-tight uppercase transform -rotate-1">
        🤝 Log an Act of Kindness
      </h1>
      
      {errorMsg && (
        <div className="bg-red-400 text-white p-4 rounded-xl mb-6 text-sm font-black border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          ⚠️ {errorMsg}
        </div>
      )}

      {claimModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-yellow-300 border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-md text-center transform -rotate-1">
            <h2 className="text-2xl font-black uppercase mb-2 text-black">🎉 Deed Logged!</h2>
            <p className="text-xs font-bold text-slate-800 mb-4">
              We created a <b>🌱 Unclaimed Seed Node</b> for <b>{helperId}</b>. Share this claim link with them so they can claim their spot on the map!
            </p>
            <input type="text" readOnly value={claimModalUrl} className="w-full border-2 border-black rounded-xl p-2.5 font-bold text-xs bg-white mb-4 text-center select-all" />
            <div className="flex gap-2">
              <button onClick={() => { navigator.clipboard.writeText(claimModalUrl); alert('Claim link copied!'); }} className="flex-1 bg-lime-400 border-2 border-black rounded-xl py-2.5 font-black text-xs uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] cursor-pointer">
                📋 Copy Link
              </button>
              <button onClick={() => { setClaimModalUrl(''); navigate('/dashboard'); }} className="flex-1 bg-black text-white border-2 border-black rounded-xl py-2.5 font-black text-xs uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] cursor-pointer">
                Done 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <label className="block text-xs font-black text-black mb-1 uppercase">
              Who Helped You? <span className="text-red-500 font-bold">*</span>
            </label>
            <input 
              type="text" 
              placeholder="Search or Type Helper's Name..." 
              value={isAnonymousHelper ? 'ANONYMOUS HELPER 🕵️‍♂️' : helperId} 
              onChange={handleHelperIdChange} 
              onFocus={() => { if (helperId && !isAnonymousHelper) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              autoComplete="off"
              disabled={isAnonymousHelper}
              className={`w-full border-4 border-black rounded-xl p-3 uppercase font-black focus:outline-none shadow-[4px_4px_0px_rgba(0,0,0,1)] ${isAnonymousHelper ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-blue-50'}`} 
            />
            
            {/* Added Anonymous Checkbox Feature */}
            <div className="mt-3 flex items-center gap-2 bg-slate-50 p-2 rounded-lg border-2 border-slate-300 border-dashed">
              <input 
                type="checkbox" 
                id="anonHelper" 
                checked={isAnonymousHelper} 
                onChange={(e) => {
                  setIsAnonymousHelper(e.target.checked);
                  if (e.target.checked) setHelperId(''); // Clear text if switching to anon
                }} 
                className="w-5 h-5 cursor-pointer accent-pink-500 rounded border-black" 
              />
              <label htmlFor="anonHelper" className="text-[11px] font-black uppercase text-slate-700 cursor-pointer select-none">
                Don't know the person? (Create Anonymous Node)
              </label>
            </div>
            
            {showSuggestions && filteredTags.length > 0 && !isAnonymousHelper && (
              <ul className="absolute z-20 w-full bg-white border-4 border-black rounded-xl mt-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] max-h-40 overflow-y-auto">
                {filteredTags.map(tag => (
                  <li key={tag} onMouseDown={() => { setHelperId(tag); setShowSuggestions(false); }} className="p-3 border-b-2 border-black last:border-0 hover:bg-lime-300 cursor-pointer font-black text-xs uppercase">
                    {tag}
                  </li>
                ))}
              </ul>
            )}

            {/* THE PIN CREATOR BOX NOW APPEARS WHEN YOU TYPE A NEW NAME! */}
            {isNewHelper && (
              <div className="mt-3 bg-yellow-200 border-2 border-black p-3 rounded-xl text-slate-800 shadow-[2px_2px_0px_rgba(0,0,0,1)] flex flex-col gap-2">
                <p className="text-[11px] font-black">
                  ✨ Unregistered Helper! We'll auto-create an Unclaimed Node for them.
                </p>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-black">Set a Secret PIN (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 1234 or leave blank to auto-generate" 
                    value={helperPin}
                    onChange={(e) => setHelperPin(e.target.value)}
                    className="w-full bg-white border-2 border-black rounded-lg p-2 uppercase font-black text-xs focus:outline-none shadow-[2px_2px_0px_rgba(0,0,0,1)]" 
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-black text-black mb-1 uppercase">
              Your Primary K-Tag <span className="text-red-500 font-bold">(Fixed ID)</span>
            </label>
            <input type="text" value={myId} readOnly required
              className="w-full bg-slate-200 border-4 border-black rounded-xl p-3 uppercase font-black focus:outline-none shadow-[4px_4px_0px_rgba(0,0,0,1)] cursor-not-allowed text-slate-600" 
              title="To prevent spam, your account is bound to a single unique K-Tag on the global map." />
          </div>
        </div>

        {/* --- DEED STORY / COMMENT BOX --- */}
        <div className="flex flex-col gap-2">
          <label className="block text-xs font-black text-black uppercase">
            📝 Tell the story (Optional)
          </label>
          <textarea 
            placeholder="How did this person help you? Drop a quick note!" 
            value={deedComment}
            onChange={(e) => setDeedComment(e.target.value)}
            rows="3"
            className="w-full bg-white border-4 border-black rounded-xl p-3 font-bold text-sm focus:outline-none focus:bg-pink-50 shadow-[4px_4px_0px_rgba(0,0,0,1)] resize-none"
          ></textarea>
        </div>

        <div className="border-t-4 border-black border-dashed pt-6">
          <h2 className="text-lg font-black text-black mb-4 uppercase bg-purple-300 px-3 py-1 border-2 border-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] w-max">✨ Node Customization</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-black uppercase">Shape</label>
              <select value={nodeShape} onChange={(e) => setNodeShape(e.target.value)} className="p-2.5 border-2 border-black rounded-xl bg-white font-bold text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] cursor-pointer">
                <option value="circle">Circle 🟡</option>
                <option value="square">Square 🟦</option>
                <option value="hexagon">Hexagon ⬢</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-black uppercase">Type</label>
              <select value={nodeType} onChange={(e) => {
                  setNodeType(e.target.value);
                  if (e.target.value === 'color') setNodeValue('#10b981');
                  if (e.target.value === 'emoji') setNodeValue('💖');
                  if (e.target.value === 'image') setNodeValue(session?.user?.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kindness');
                }} 
                className="p-2.5 border-2 border-black rounded-xl bg-white font-bold text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] cursor-pointer"
              >
                <option value="color">Solid Color 🎨</option>
                <option value="emoji">Emoji 😎</option>
                <option value="image">Avatar / Img 🖼️</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-black uppercase">Value</label>
              {nodeType === 'color' ? (
                <input type="color" value={nodeValue} onChange={(e) => setNodeValue(e.target.value)} className="w-full h-[42px] p-1 border-2 border-black rounded-xl cursor-pointer shadow-[2px_2px_0px_rgba(0,0,0,1)]" />
              ) : nodeType === 'emoji' ? (
                <input type="text" maxLength="2" value={nodeValue} onChange={(e) => setNodeValue(e.target.value)} className="p-2 h-[42px] border-2 border-black rounded-xl bg-white text-center text-xl shadow-[2px_2px_0px_rgba(0,0,0,1)]" />
              ) : (
                <input type="url" value={nodeValue} onChange={(e) => setNodeValue(e.target.value)} className="p-2 h-[42px] border-2 border-black rounded-xl bg-white text-xs font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)]" placeholder="https://..." />
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <label className="text-[10px] font-black text-black uppercase">Outgoing Arrow Color</label>
            <div className="flex flex-wrap gap-2">
              {['#cbd5e1', '#000000', '#f43f5e', '#a855f7', '#3b82f6', '#facc15', '#22c55e'].map(color => (
                <button type="button" key={color} onClick={() => setLinkColor(color)}
                  className={`w-7 h-7 rounded-full border-2 border-black transition-all cursor-pointer ${linkColor === color ? 'scale-110 shadow-[2px_2px_0px_rgba(0,0,0,1)] ring-2 ring-black' : 'opacity-60 hover:opacity-100'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <button type="submit" disabled={isLoading} className="w-full mt-2 bg-cyan-400 hover:bg-cyan-300 text-black text-lg font-black py-4 px-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all uppercase tracking-widest cursor-pointer">
          {isLoading ? 'Saving... 🌀' : 'Log Good Deed ⚡'}
        </button>
      </form>
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
        p_color: '#cbd5e1', // Default arrow color for quick connects
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
      ? [ { source: myId, target: 'Next Person...', customColor: userData?.customLinkColor } ]
      : [ { source: helperId, target: myId, customColor: '#cbd5e1' }, { source: myId, target: 'Next Person...', customColor: userData?.customLinkColor } ]
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

// --- MAIN APP ---
function App() {
  const [userData, setUserData] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true); 
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNodeManager, setShowNodeManager] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false); // NEW STATE FOR QR
  const [globalGraph, setGlobalGraph] = useState({ nodes: [], links: [] });

  // --- MAP INTERACTION LOGIC (HIDES UI ON MOBILE PANNING) ---
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const interactTimeout = useRef(null);

  const handleMapInteractionStart = () => {
    if (window.innerWidth >= 768) return; // Ignore on desktop/big iPads
    if (interactTimeout.current) clearTimeout(interactTimeout.current);
    setIsMapInteracting(true);
  };

  const handleMapInteractionEnd = () => {
    if (window.innerWidth >= 768) return;
    interactTimeout.current = setTimeout(() => {
      setIsMapInteracting(false);
    }, 800); // UI swoops back in 0.8s after you release your finger!
  };

  // 1. Fetch Global Graph wrapped in useCallback so it's globally available
  const fetchGlobalGraph = useCallback(async () => {
    const { data: dbNodes, error: nodesError } = await supabase.from('nodes').select('*');
    const { data: dbLinks, error: linksError } = await supabase.from('links').select('*');

    if (!nodesError && !linksError && dbNodes.length > 0) {
        setGlobalGraph({
          // We added user_id here so the frontend can find your node in the sea of nodes!
          nodes: dbNodes.map(n => ({ id: n.id, shape: n.shape, type: n.type, value: n.value, socials: n.socials, is_claimed: n.is_claimed, user_id: n.user_id })),
          links: dbLinks.filter(l => l.status === 'approved' || !l.status).map(l => ({ 
              source: l.source, 
              target: l.target, 
              customColor: l.custom_color, 
              helpsCount: l.helps_count || 1 
            }))
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
  return (
    <Router>
      <div className="min-h-screen font-sans text-slate-900 flex flex-col selection:bg-pink-400 selection:text-white">
        
        {/* MODALS */}
        {showSettings && <SettingsModal session={session} onClose={() => setShowSettings(false)} />}
        {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
        {showRequests && <RequestsModal session={session} onClose={() => setShowRequests(false)} onRefreshGraph={fetchGlobalGraph} />}
        {showNodeManager && <NodeManagerModal session={session} onClose={() => setShowNodeManager(false)} onRefreshGraph={fetchGlobalGraph} />}
        {selectedNode && <NodeDetailsModal node={selectedNode} onClose={() => setSelectedNode(null)} />}
        
        {/* QUICK CONNECT QR MODAL */}
        {showQRModal && myPrimaryNode && <QuickQRModal myPrimaryNode={myPrimaryNode} onClose={() => setShowQRModal(false)} onRefreshGraph={fetchGlobalGraph} />}
        
        {/* NAVBAR */}
        <nav className="flex flex-wrap justify-between items-center p-4 md:px-6 lg:px-8 bg-[#fdfbf7]/90 backdrop-blur-md border-b-4 border-black sticky top-0 z-40 gap-4 overflow-x-hidden pointer-events-auto">
          
          {/* LOGO */}
          <Link to="/" className="text-lg sm:text-2xl md:text-3xl font-black tracking-tighter text-black flex items-center gap-1.5 sm:gap-2 hover:scale-105 transition-transform shrink-0">
            <span className="text-2xl sm:text-4xl drop-shadow-sm">🫶</span>
            <div className="flex flex-col leading-none justify-center">
              <span>KINDNESS<span className="text-pink-500">SPHERE</span></span>
              <span className="text-[7px] sm:text-[10px] md:text-xs text-cyan-500 uppercase tracking-[0.3em] mt-0.5 sm:mt-1">world</span>
            </div>
          </Link>
          
          {/* BRAWL BUTTONS CONTAINER */}
          <div className="flex flex-wrap items-center justify-end gap-x-2 sm:gap-x-4 gap-y-3 sm:gap-y-5 ml-auto pt-2 sm:pt-0 pb-2 sm:pb-0">
            
            {isAuthLoading ? (
               <div className="w-5 h-5 border-[3px] border-black border-t-transparent rounded-full animate-spin"></div>
            ) : session ? (
              <>
               {/* Slanted Avatar Badge */}
                <div 
                  className="hidden lg:flex items-center bg-yellow-300 border-[3px] border-black rounded-lg shrink-0" 
                  style={{ transform: 'skewX(-8deg)', boxShadow: '-1px 1px 0 #000, -2px 2px 0 #000, -3px 3px 0 #000, -4px 4px 0 #000, -4px 5px 0 #000' }}
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

        <main className="flex-grow relative w-full overflow-hidden flex flex-col">
          <Routes>
             <Route path="/" element={
              <div className="absolute inset-0 w-full h-full flex flex-col bg-[#fdfbf7]">
                
                {/* 1. BACKGROUND FULL-SCREEN MAP */}
                <div 
                  className="absolute inset-0 z-0"
                  onPointerDownCapture={handleMapInteractionStart}
                  onPointerUpCapture={handleMapInteractionEnd}
                  onPointerCancelCapture={handleMapInteractionEnd}
                >
                  <KindnessGraph data={globalGraph} onNodeClick={setSelectedNode} /> 
                </div>

                {/* 2. HUD OVERLAYS - notice pb-8 (padding-bottom) added for Android Nav Bars! */}
                <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 pb-8 sm:p-6 lg:p-8 overflow-hidden">
                  
                  {/* TOP LEFT: LIVE BADGE */}
                  <div className={`flex justify-start pointer-events-auto transition-all duration-300 ease-in-out md:translate-y-0 md:opacity-100 ${isMapInteracting ? '-translate-y-20 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
                    <div className="bg-white border-2 sm:border-4 border-black px-2 py-1 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl shadow-[2px_2px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] font-black text-[9px] sm:text-sm flex items-center gap-1.5 sm:gap-2 transform -rotate-2 w-max">
                      <span className="relative flex h-2 w-2 sm:h-3 sm:w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 sm:h-3 sm:w-3 bg-green-500"></span></span> 
                      GLOBAL NETWORK LIVE
                    </div>
                  </div>

                  {/* BOTTOM SECTION: ALL ON ONE ROW (flex-row) */}
                  <div className={`flex flex-row justify-between items-end gap-2 sm:gap-6 pointer-events-none w-full transition-all duration-300 ease-in-out md:translate-y-0 md:opacity-100 ${isMapInteracting ? 'translate-y-40 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
                    
                    {/* BOTTOM LEFT: USER INFO */}
                    <div className="flex flex-col items-start gap-1 sm:gap-3 w-auto pointer-events-none">
                      {session && myPrimaryNode ? (
                        <>
                          <div className="bg-yellow-300 border-2 sm:border-4 border-black rounded-full px-2 py-0.5 sm:px-4 sm:py-1 w-max shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] md:-rotate-2 transition-transform pointer-events-auto">
                            <span className="font-black text-black text-[8px] sm:text-sm uppercase tracking-wider">🏆 Global Rank: #{myRankNumber}</span>
                          </div>
                          <h1 className="text-[16px] sm:text-4xl md:text-5xl font-black leading-none text-black tracking-tight drop-shadow-sm mt-0.5 mb-0.5 sm:mb-2 bg-white/90 px-1.5 py-1 sm:p-3 rounded-lg sm:rounded-2xl border-2 sm:border-4 border-black w-max backdrop-blur-sm shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] md:rotate-1 transition-transform pointer-events-auto">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">{myRank}</span>
                          </h1>
                          
                          {/* Re-Stacked horizontally to stay slim on mobile! */}
                          <div className="flex flex-col gap-1 sm:gap-3 w-max pointer-events-none">
                            <div className="bg-lime-300 border-2 sm:border-4 border-black rounded-md sm:rounded-2xl px-1.5 py-0.5 sm:p-3 shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] md:rotate-1 hover:rotate-0 transition-transform w-max pointer-events-auto">
                              <span className="font-black text-black text-[8px] sm:text-base uppercase tracking-wider flex items-center gap-1 sm:gap-2">
                                🤝 You helped <span className="text-[10px] sm:text-xl bg-white border border-black sm:border-2 rounded sm:rounded-lg px-1 sm:px-2 py-0.5 shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)]">{myHelpedCount}</span>
                              </span>
                            </div>
                            <div className="bg-cyan-300 border-2 sm:border-4 border-black rounded-md sm:rounded-2xl px-1.5 py-0.5 sm:p-3 shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_rgba(0,0,0,1)] md:-rotate-1 hover:rotate-0 transition-transform w-max pointer-events-auto">
                              <span className="font-black text-black text-[8px] sm:text-base uppercase tracking-wider flex items-center gap-1 sm:gap-2">
                                💖 Helped by <span className="text-[10px] sm:text-xl bg-white border border-black sm:border-2 rounded sm:rounded-lg px-1 sm:px-2 py-0.5 shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)]">{myHelpedByCount}</span>
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="bg-white/90 backdrop-blur-md border-2 sm:border-4 border-black rounded-xl sm:rounded-3xl p-2 sm:p-5 shadow-[2px_2px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_rgba(0,0,0,1)] transform rotate-1 pointer-events-auto">
                          <h1 className="text-lg sm:text-4xl font-black leading-none text-black tracking-tight drop-shadow-sm mb-1 sm:mb-3">
                            Your impact, <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">fully custom.</span>
                          </h1>
                          <p className="text-slate-700 text-[9px] sm:text-base font-bold leading-relaxed max-w-[150px] sm:max-w-none">
                            Start a chain of kindness today and leave your unique mark on the world's graph. 🌍
                          </p>
                        </div>
                      )}
                    </div>

                    {/* BOTTOM RIGHT: ACTIONS & STATS */}
                    <div className="flex flex-col items-end gap-1.5 sm:gap-4 w-auto pointer-events-none z-10">
                      
                      {/* QUICK CONNECT BUTTON */}
                      {session && myPrimaryNode && (
                        <div onClick={() => setShowQRModal(true)} className="bg-yellow-400 border-2 sm:border-4 border-black rounded-lg sm:rounded-3xl p-1 sm:p-3 shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1 sm:gap-3 md:-rotate-2 hover:rotate-0 hover:-translate-y-1 sm:hover:-translate-y-2 transition-all cursor-pointer hover:bg-yellow-300 group w-max self-end pointer-events-auto">
                          <div className="bg-black text-white p-1 sm:p-3 rounded sm:rounded-xl transform group-hover:scale-110 transition-transform shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)] border border-black flex items-center justify-center">
                            <span className="text-[12px] sm:text-3xl">⚡</span>
                          </div>
                          <div className="flex flex-col text-left pr-1 sm:pr-2">
                            <span className="font-black text-black uppercase text-[10px] sm:text-xl leading-none tracking-tight">Quick Connect</span>
                            <span className="text-[6px] sm:text-xs font-black text-slate-800 uppercase mt-0.5 sm:mt-1 tracking-widest bg-white/80 px-1 sm:px-2 py-0.5 rounded border border-black sm:border-2 w-max">Scan / Show QR 📷</span>
                          </div>
                        </div>
                      )}

                      {/* STATS DASHBOARD */}
                      {session && (
                        <div className="bg-white/90 backdrop-blur-md border-2 sm:border-4 border-black rounded-lg sm:rounded-2xl p-1 sm:p-3 shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_rgba(0,0,0,1)] flex gap-1 sm:gap-3 w-max overflow-x-auto md:rotate-1 self-end pointer-events-auto">
                          <div className="bg-slate-100 border sm:border-2 border-black rounded px-1.5 sm:px-3 py-0.5 sm:py-2 text-center shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)] min-w-[35px] sm:min-w-[70px]">
                            <p className="text-[10px] sm:text-xl font-black text-black leading-none">{totalNodes}</p>
                            <p className="text-[6px] sm:text-[9px] font-black uppercase text-slate-800 mt-0.5 sm:mt-1">Nodes</p>
                          </div>
                          <div className="bg-slate-100 border sm:border-2 border-black rounded px-1.5 sm:px-3 py-0.5 sm:py-2 text-center shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)] min-w-[35px] sm:min-w-[70px]">
                            <p className="text-[10px] sm:text-xl font-black text-black leading-none">{totalConnections}</p>
                            <p className="text-[6px] sm:text-[9px] font-black uppercase text-slate-800 mt-0.5 sm:mt-1">Links</p>
                          </div>
                          <div className="bg-slate-100 border sm:border-2 border-black rounded px-1.5 sm:px-3 py-0.5 sm:py-2 text-center shadow-[1px_1px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_rgba(0,0,0,1)] min-w-[35px] sm:min-w-[70px]">
                            <p className="text-[10px] sm:text-xl font-black text-black leading-none">{activeChainsCount}</p>
                            <p className="text-[6px] sm:text-[9px] font-black uppercase text-slate-800 mt-0.5 sm:mt-1">Chains</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            } />
            <Route path="/join" element={<LogKindnessForm onComplete={setUserData} session={session} isAuthLoading={isAuthLoading} />} />
            <Route path="/dashboard" element={<Dashboard userData={userData} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;