// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import KindnessGraph from './components/KindnessGraph';
import { supabase } from './supabaseClient';

// --- SETTINGS MODAL ---
function SettingsModal({ session, onClose }) {
  // Grab automatic Google data from session metadata, or fallback to empty
  const [name, setName] = useState(session?.user?.user_metadata?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(session?.user?.user_metadata?.avatar_url || '');
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg('');

    // Update user metadata in Supabase
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name, avatar_url: avatarUrl }
    });

    setIsLoading(false);
    if (error) {
      setMsg(`⚠️ ${error.message}`);
    } else {
      onClose(); // Close modal on success
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border-4 border-black rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-md relative transform rotate-1">
        <button onClick={onClose} className="absolute -top-3 -right-3 bg-red-400 text-black border-4 border-black rounded-full w-10 h-10 flex items-center justify-center font-black text-xl hover:scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform z-10">
          ✖
        </button>
        <h2 className="text-2xl font-black mb-6 uppercase tracking-tight transform -rotate-2 w-max bg-blue-300 px-3 py-1 border-2 border-black rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          ⚙️ Edit Profile
        </h2>
        
        {msg && <p className="mb-4 text-sm font-bold text-red-600 bg-red-100 p-2 border-2 border-red-600 rounded-lg">{msg}</p>}
        
        <form onSubmit={handleSave} className="flex flex-col gap-5 transform -rotate-1">
          <div>
            <label className="block text-sm font-black uppercase mb-1">Display Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="w-full border-4 border-black rounded-xl p-3 font-bold focus:outline-none focus:bg-blue-50 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-black uppercase mb-1">Profile Picture URL</label>
            <input type="url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} required
              className="w-full border-4 border-black rounded-xl p-3 font-bold focus:outline-none focus:bg-blue-50 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-colors" />
          </div>
          
          <div className="flex items-center gap-4 bg-slate-100 p-3 rounded-xl border-2 border-black border-dashed mt-2">
            <img src={avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="Preview" className="w-12 h-12 rounded-full border-2 border-black bg-white object-cover" />
            <p className="text-xs font-bold text-slate-500">Google loaded this automatically. You can paste any image URL to change it!</p>
          </div>

          <button type="submit" disabled={isLoading} className="mt-2 bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-black text-lg font-black py-3 rounded-xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all uppercase tracking-widest">
            {isLoading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}


// --- THE ADVANCED FORM ---
function LogKindnessForm({ onComplete, session }) {
  const navigate = useNavigate();
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [helperId, setHelperId] = useState('');
  const [myId, setMyId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [nodeShape, setNodeShape] = useState('circle');
  const [nodeType, setNodeType] = useState('color'); 
  const [nodeValue, setNodeValue] = useState('#10b981'); 
  const [linkColor, setLinkColor] = useState('#cbd5e1'); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session) {
      setErrorMsg("Please sign in to add to the chain!");
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    const finalMyId = myId.toUpperCase().trim();
    const finalHelperId = helperId.toUpperCase().trim();

    try {
      const { error: nodeError } = await supabase.from('nodes').insert({
        id: finalMyId,
        user_id: session.user.id,
        shape: nodeShape,
        type: nodeType,
        value: nodeValue
      });

      if (nodeError) {
        if (nodeError.code === '23505') throw new Error("This K-Tag is already taken! Try another one.");
        throw nodeError;
      }

      if (!isStartingNew && finalHelperId) {
        const { error: linkError } = await supabase.from('links').insert({
          source: finalHelperId,
          target: finalMyId,
          custom_color: linkColor
        });

        if (linkError) {
          if (linkError.code === '23503') {
             await supabase.from('nodes').delete().eq('id', finalMyId);
             throw new Error("Helper's K-Tag not found! Please check the spelling.");
          }
          throw linkError;
        }
      }

      onComplete({
        myId: finalMyId,
        helperId: isStartingNew ? null : finalHelperId,
        isOriginator: isStartingNew,
        customShape: nodeShape,
        customType: nodeType,
        customValue: nodeValue,
        customLinkColor: linkColor
      });
      navigate('/dashboard');

    } catch (error) {
      setErrorMsg(error.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

 if (!session) {
    return (
      <div className="w-full max-w-xl mx-auto mt-12 sm:mt-20 p-8 sm:p-12 bg-pink-300 rounded-3xl border-4 border-black text-center shadow-[8px_8px_0px_rgba(0,0,0,1)] transform rotate-1 hover:rotate-0 transition-transform mb-20">
        <h2 className="text-3xl sm:text-4xl font-black mb-4 text-black uppercase tracking-tight">🔒 Hold Up!</h2>
        <p className="text-black font-bold mb-8 text-lg">You need to sign in to claim your custom node and join the global chain.</p>
        <button onClick={() => supabase.auth.signInWithOAuth({ 
          provider: 'google', 
          options: { redirectTo: `${window.location.origin}/join` } 
        })} 
          className="bg-lime-400 hover:bg-lime-300 text-black text-xl font-black py-4 px-8 rounded-xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-[0px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-3 mx-auto w-full sm:w-auto">
          <span>🚀</span> Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 sm:mt-12 p-6 sm:p-8 bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] mb-20">
      <h1 className="text-3xl sm:text-4xl font-black mb-8 text-black text-center tracking-tight uppercase transform -rotate-1">🎨 Claim Your Node</h1>
      
      {errorMsg && (
        <div className="bg-red-400 text-white p-4 rounded-xl mb-6 text-sm font-black border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row bg-white p-2 rounded-2xl mb-8 border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] gap-2">
        <button type="button" onClick={() => setIsStartingNew(false)}
          className={`flex-1 py-3 text-sm sm:text-base font-black rounded-xl border-2 transition-all ${!isStartingNew ? 'bg-pink-400 border-black text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] translate-y-[2px]' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100'}`}>
          🥺 I Was Helped
        </button>
        <button type="button" onClick={() => setIsStartingNew(true)}
          className={`flex-1 py-3 text-sm sm:text-base font-black rounded-xl border-2 transition-all ${isStartingNew ? 'bg-lime-400 border-black text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] translate-y-[2px]' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100'}`}>
          🔥 Start a Chain
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {!isStartingNew && (
            <div>
              <label className="block text-sm font-black text-black mb-2 uppercase">Helper's K-Tag</label>
              <input type="text" placeholder="e.g., DELHI-MAX" value={helperId} onChange={(e) => setHelperId(e.target.value)} required={!isStartingNew}
                className="w-full bg-blue-50 border-4 border-black rounded-xl p-4 uppercase font-black focus:outline-none focus:bg-blue-100 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-colors" />
            </div>
          )}
          <div className={isStartingNew ? "md:col-span-2" : ""}>
            <label className="block text-sm font-black text-black mb-2 uppercase">Create Your K-Tag</label>
            <input type="text" placeholder="e.g., PUNE-ROCKY" value={myId} onChange={(e) => setMyId(e.target.value)} required
              className="w-full bg-yellow-50 border-4 border-black rounded-xl p-4 uppercase font-black focus:outline-none focus:bg-yellow-100 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-colors" />
          </div>
        </div>

        <div className="border-t-4 border-black border-dashed pt-8 mt-2">
          <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2 transform -rotate-1 w-max bg-purple-300 px-4 py-2 border-2 border-black rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">✨ Customize</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-black uppercase">Shape</label>
              <select value={nodeShape} onChange={(e) => setNodeShape(e.target.value)} className="p-3 border-4 border-black rounded-xl bg-white font-bold shadow-[4px_4px_0px_rgba(0,0,0,1)] focus:outline-none cursor-pointer">
                <option value="circle">Circle 🟡</option>
                <option value="square">Square 🟦</option>
                <option value="hexagon">Hexagon ⬢</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-black uppercase">Content</label>
              <select value={nodeType} onChange={(e) => {
                  setNodeType(e.target.value);
                  if (e.target.value === 'color') setNodeValue('#10b981');
                  if (e.target.value === 'emoji') setNodeValue('💖');
                  if (e.target.value === 'image') setNodeValue('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix');
                }} 
                className="p-3 border-4 border-black rounded-xl bg-white font-bold shadow-[4px_4px_0px_rgba(0,0,0,1)] focus:outline-none cursor-pointer"
              >
                <option value="color">Solid Color 🎨</option>
                <option value="emoji">Emoji 😎</option>
                <option value="image">Avatar / Img 🖼️</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-black uppercase">
                {nodeType === 'color' ? 'Pick Color' : nodeType === 'emoji' ? 'Type Emoji' : 'Image URL'}
              </label>
              {nodeType === 'color' ? (
                <input type="color" value={nodeValue} onChange={(e) => setNodeValue(e.target.value)} className="w-full h-[56px] p-1 border-4 border-black rounded-xl cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)]" />
              ) : nodeType === 'emoji' ? (
                <input type="text" maxLength="2" value={nodeValue} onChange={(e) => setNodeValue(e.target.value)} className="p-3 h-[56px] border-4 border-black rounded-xl bg-white text-center text-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)] focus:outline-none" />
              ) : (
                <input type="url" value={nodeValue} onChange={(e) => setNodeValue(e.target.value)} className="p-3 h-[56px] border-4 border-black rounded-xl bg-white text-sm font-bold shadow-[4px_4px_0px_rgba(0,0,0,1)] focus:outline-none" placeholder="https://..." />
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <label className="text-xs font-black text-black uppercase">Arrow Color (Your Outgoing Chain)</label>
            <div className="flex flex-wrap gap-3">
              {['#000000', '#f43f5e', '#a855f7', '#3b82f6', '#facc15', '#22c55e'].map(color => (
                <button type="button" key={color} onClick={() => setLinkColor(color)}
                  className={`w-12 h-12 rounded-full border-4 shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all ${linkColor === color ? 'border-black scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)]' : 'border-black/20 hover:scale-105'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <button type="submit" disabled={isLoading} className="w-full mt-6 bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 disabled:opacity-50 text-black text-xl font-black py-5 px-4 rounded-xl border-4 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-[0px_0px_0px_rgba(0,0,0,1)] transition-all uppercase tracking-widest">
          {isLoading ? 'Processing... 🌀' : (isStartingNew ? 'Launch My Chain 🚀' : 'Connect Me ⚡')}
        </button>
      </form>
    </div>
  );
}

// --- DASHBOARD ---
function Dashboard({ userData }) {
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
      </div>
      <div className="w-full lg:w-1/2 h-[50vh] min-h-[350px] lg:h-[500px] relative border-4 border-black rounded-3xl bg-white shadow-[8px_8px_0px_rgba(0,0,0,1)] p-2">
        <KindnessGraph data={treeData} />
      </div>
    </div>
  );
}

// --- MAIN APP ---
function App() {
  const [userData, setUserData] = useState(null);
  const [session, setSession] = useState(null);
  const [showSettings, setShowSettings] = useState(false); // Controls our new settings modal
  const [globalGraph, setGlobalGraph] = useState({ nodes: [], links: [] });

  const mockFallbackTree = {
    nodes: [
      { id: 'SEED-NODE', shape: 'hexagon', type: 'emoji', value: '🌱' }
    ],
    links: []
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    fetchGlobalGraph();
    return () => subscription.unsubscribe();
  }, []);

  const fetchGlobalGraph = async () => {
    const { data: dbNodes, error: nodesError } = await supabase.from('nodes').select('*');
    const { data: dbLinks, error: linksError } = await supabase.from('links').select('*');

    if (!nodesError && !linksError && dbNodes.length > 0) {
      setGlobalGraph({
        nodes: dbNodes.map(n => ({ id: n.id, shape: n.shape, type: n.type, value: n.value })),
        links: dbLinks.map(l => ({ source: l.source, target: l.target, customColor: l.custom_color }))
      });
    } else {
      setGlobalGraph(mockFallbackTree);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/join` 
      }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Router>
      <div className="min-h-screen font-sans text-slate-900 flex flex-col selection:bg-pink-400 selection:text-white">
        
        {/* Render Settings Modal conditionally */}
        {showSettings && <SettingsModal session={session} onClose={() => setShowSettings(false)} />}

        <nav className="flex justify-between items-center p-4 md:p-6 lg:px-12 bg-white/80 backdrop-blur-md border-b-4 border-black sticky top-0 z-40">
          <Link to="/" className="text-2xl md:text-3xl font-black tracking-tighter text-black flex items-center gap-2 hover:scale-105 transition-transform">
            <span>🫶</span> KINDNESS<span className="text-pink-500">CHAIN</span>
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            {session ? (
              <div className="flex items-center gap-3">
                {/* Visual User Profile populated automatically from Google */}
                <div className="hidden sm:flex items-center gap-2 bg-yellow-300 px-3 py-1.5 border-2 border-black rounded-full shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <img 
                    src={session.user.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} 
                    alt="avatar" 
                    className="w-6 h-6 rounded-full border border-black bg-white object-cover" 
                  />
                  <span className="text-sm font-bold text-black max-w-[100px] truncate">
                    {session.user.user_metadata?.full_name || 'User'}
                  </span>
                </div>
                
                {/* Settings Button */}
                <button onClick={() => setShowSettings(true)} className="text-sm font-bold text-black hover:text-blue-600 transition-colors flex items-center gap-1">
                  ⚙️ <span className="hidden sm:inline">Settings</span>
                </button>
                
                <button onClick={handleLogout} className="text-sm font-bold text-black hover:text-pink-600 transition-colors">
                  Logout
                </button>
              </div>
            ) : (
              <button onClick={handleGoogleLogin} className="text-sm font-bold text-black hover:text-pink-600 transition-colors">
                Sign In
              </button>
            )}
            <Link to="/join" className="bg-lime-400 hover:bg-lime-300 text-black text-sm md:text-base font-black py-2.5 px-4 md:px-6 rounded-xl border-2 md:border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-[0px_0px_0px_rgba(0,0,0,1)] transition-all">
              Join Chain 🚀
            </Link>
          </div>
        </nav>

        <main className="flex-grow flex flex-col px-4 sm:px-6 lg:px-12 pb-12 overflow-x-hidden">
          <Routes>
             <Route path="/" element={
              <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 h-full flex-grow items-center justify-center mt-8 lg:mt-16 max-w-7xl mx-auto w-full">
                <div className="w-full lg:w-1/2 flex flex-col gap-6 lg:gap-8 text-center lg:text-left z-10">
                  <div className="inline-block mx-auto lg:mx-0 bg-yellow-300 border-2 border-black rounded-full px-4 py-1 w-max shadow-[4px_4px_0px_rgba(0,0,0,1)] mb-[-10px] transform -rotate-2">
                    <span className="font-bold text-black text-sm uppercase tracking-wider">✨ The live network</span>
                  </div>
                  <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-none text-black tracking-tight drop-shadow-sm">
                    Your impact, <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">
                      fully custom.
                    </span>
                  </h1>
                  <p className="text-slate-600 text-lg sm:text-xl font-medium leading-relaxed max-w-lg mx-auto lg:mx-0">
                    Avatars. Emojis. Hexagons. Custom arrows. Start a chain of kindness today and leave your unique mark on the world's graph. 🌍
                  </p>
                </div>
                <div className="w-full lg:w-1/2 h-[50vh] min-h-[400px] lg:h-[600px] border-4 border-black rounded-3xl shadow-[8px_8px_0px_rgba(0,0,0,1)] bg-white overflow-hidden p-2 relative">
                  <div className="absolute top-4 left-4 z-10 bg-white border-2 border-black px-3 py-1 rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] font-bold text-xs flex items-center gap-2">
                    <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span> LIVE
                  </div>
                  <KindnessGraph data={globalGraph} /> 
                </div>
              </div>
            } />
            <Route path="/join" element={<LogKindnessForm onComplete={setUserData} session={session} />} />
            <Route path="/dashboard" element={<Dashboard userData={userData} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;