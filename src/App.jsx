// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import KindnessGraph from './components/KindnessGraph';
import { supabase } from './supabaseClient';

// --- THE ADVANCED FORM ---
function LogKindnessForm({ onComplete, session }) {
  const navigate = useNavigate();
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [helperId, setHelperId] = useState('');
  const [myId, setMyId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Customization States
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
      // 1. Insert Node to Database
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

      // 2. Insert Link if not starting a new chain
      if (!isStartingNew && finalHelperId) {
        const { error: linkError } = await supabase.from('links').insert({
          source: finalHelperId,
          target: finalMyId,
          custom_color: linkColor
        });

        if (linkError) {
          if (linkError.code === '23503') {
             // Rollback node if helper isn't found (optional, but good UX)
             await supabase.from('nodes').delete().eq('id', finalMyId);
             throw new Error("Helper's K-Tag not found! Please check the spelling.");
          }
          throw linkError;
        }
      }

      // 3. Success! Go to dashboard
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
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-sm">
        <h2 className="text-2xl font-bold mb-4">Sign in required</h2>
        <p className="text-slate-500 mb-6">You must be logged in to claim a node and join the chain.</p>
        <button onClick={() => supabase.auth.signInWithOAuth({ 
    provider: 'google', 
    options: { redirectTo: window.location.origin } 
  })} 
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl">
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-20">
      <h1 className="text-3xl font-extrabold mb-8 text-slate-900 text-center tracking-tight">Claim Your Node</h1>
      
      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-bold border border-red-100">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="flex bg-slate-100 p-1 rounded-xl mb-8 border border-slate-200">
        <button type="button" onClick={() => setIsStartingNew(false)}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${!isStartingNew ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          I Was Helped
        </button>
        <button type="button" onClick={() => setIsStartingNew(true)}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${isStartingNew ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          Start a Chain
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {!isStartingNew && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Helper's K-Tag</label>
              <input type="text" placeholder="e.g., DELHI-MAX" value={helperId} onChange={(e) => setHelperId(e.target.value)} required={!isStartingNew}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 uppercase font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
            </div>
          )}
          <div className={isStartingNew ? "md:col-span-2" : ""}>
            <label className="block text-sm font-bold text-slate-700 mb-2">Create Your K-Tag</label>
            <input type="text" placeholder="e.g., PUNE-ROCKY" value={myId} onChange={(e) => setMyId(e.target.value)} required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 uppercase font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-8 mt-2">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">🎨 Design Your Node</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">Shape</label>
              <select value={nodeShape} onChange={(e) => setNodeShape(e.target.value)} className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                <option value="circle">Circle</option>
                <option value="square">Square</option>
                <option value="hexagon">Hexagon</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">Content</label>
              <select value={nodeType} onChange={(e) => {
                  setNodeType(e.target.value);
                  if (e.target.value === 'color') setNodeValue('#10b981');
                  if (e.target.value === 'emoji') setNodeValue('💖');
                  if (e.target.value === 'image') setNodeValue('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix');
                }} 
                className="p-3 border border-slate-200 rounded-xl bg-slate-50"
              >
                <option value="color">Solid Color</option>
                <option value="emoji">Emoji</option>
                <option value="image">Avatar / Image</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">
                {nodeType === 'color' ? 'Pick Color' : nodeType === 'emoji' ? 'Type Emoji' : 'Image URL'}
              </label>
              {nodeType === 'color' ? (
                <input type="color" value={nodeValue} onChange={(e) => setNodeValue(e.target.value)} className="w-full h-12 rounded-xl cursor-pointer" />
              ) : nodeType === 'emoji' ? (
                <input type="text" maxLength="2" value={nodeValue} onChange={(e) => setNodeValue(e.target.value)} className="p-3 border border-slate-200 rounded-xl bg-slate-50 text-center text-xl" />
              ) : (
                <input type="url" value={nodeValue} onChange={(e) => setNodeValue(e.target.value)} className="p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm" placeholder="https://..." />
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Arrow Color (Your Outgoing Chain)</label>
            <div className="flex gap-2">
              {['#cbd5e1', '#f43f5e', '#8b5cf6', '#3b82f6', '#f59e0b', '#10b981'].map(color => (
                <button type="button" key={color} onClick={() => setLinkColor(color)}
                  className={`w-10 h-10 rounded-full border-4 transition-all ${linkColor === color ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <button type="submit" disabled={isLoading} className="w-full mt-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-lg font-bold py-4 px-4 rounded-xl shadow-lg shadow-slate-900/20 transition-all">
          {isLoading ? 'Processing...' : (isStartingNew ? 'Start My Chain' : 'Connect Me')}
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
    <div className="flex flex-col lg:flex-row items-center justify-center mt-12 gap-12 w-full max-w-6xl mx-auto">
      <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">{isOriginator ? "Your chain has started!" : "You joined the chain!"}</h1>
        <p className="text-slate-500 text-lg mb-8">Your node has been added to the database. Give this ID to the next person you help.</p>
        <div className="bg-white border-2 border-slate-900 p-6 rounded-2xl shadow-xl w-full max-w-sm">
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2">Your ID</p>
          <p className="text-4xl font-black text-slate-900 tracking-wider">{myId}</p>
        </div>
      </div>
      <div className="w-full lg:w-1/2 h-[450px] relative border border-slate-200 rounded-3xl bg-white shadow-sm p-4">
        <KindnessGraph data={treeData} />
      </div>
    </div>
  );
}

// --- MAIN APP ---
function App() {
  const [userData, setUserData] = useState(null);
  const [session, setSession] = useState(null);
  const [globalGraph, setGlobalGraph] = useState({ nodes: [], links: [] });

  // Fallback mock tree if database is empty
  const mockFallbackTree = {
    nodes: [
      { id: 'SEED-NODE', shape: 'hexagon', type: 'emoji', value: '🌱' }
    ],
    links: []
  };

  useEffect(() => {
    // 1. Setup Auth listener
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));

    // 2. Fetch Global Database Graph
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
      setGlobalGraph(mockFallbackTree); // Load dummy tree if DB is completely empty
    }
  };

  const handleGoogleLogin = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // This automatically detects if you are on localhost or the live site
      redirectTo: window.location.origin 
    }
  });
};

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
        <nav className="flex justify-between items-center p-6 lg:px-12 bg-white border-b border-slate-200 sticky top-0 z-50">
          <Link to="/" className="text-2xl font-black tracking-tighter text-slate-900">
            KINDNESS<span className="text-emerald-500">CHAIN</span>
          </Link>
          <div className="flex items-center gap-6">
            {session ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-700 hidden sm:block">
                  Hi, {session.user.user_metadata.full_name || 'User'}
                </span>
                <button onClick={handleLogout} className="text-sm font-bold text-slate-500 hover:text-slate-800">
                  Logout
                </button>
              </div>
            ) : (
              <button onClick={handleGoogleLogin} className="text-sm font-bold text-slate-600 hover:text-slate-900">
                Sign In
              </button>
            )}
            <Link to="/join" className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-2.5 px-6 rounded-full transition-all shadow-md">
              Join the Chain
            </Link>
          </div>
        </nav>

        <main className="flex-grow flex flex-col px-6 lg:px-12 pb-12">
          <Routes>
            <Route path="/" element={
              <div className="flex flex-col lg:flex-row gap-12 h-full flex-grow items-center justify-center mt-16 max-w-7xl mx-auto">
                <div className="lg:w-1/2 flex flex-col gap-8 text-center lg:text-left z-10">
                  <h1 className="text-6xl font-black leading-tight text-slate-900 tracking-tight">
                    Your impact, <br/><span className="text-emerald-500">fully customized.</span>
                  </h1>
                  <p className="text-slate-500 text-xl leading-relaxed max-w-lg mx-auto lg:mx-0">
                    Avatars. Emojis. Hexagons. Custom arrows. Start a chain of kindness today and leave your unique mark on the world's graph.
                  </p>
                </div>
                <div className="lg:w-1/2 w-full h-[500px] border border-slate-200 rounded-3xl shadow-sm bg-white overflow-hidden p-2">
                  {/* Now rendering LIVE Data from Supabase */}
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