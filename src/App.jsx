// frontend/src/App.jsx
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import KindnessGraph from './components/KindnessGraph';

// --- THE ADVANCED FORM ---
function LogKindnessForm({ onComplete }) {
  const navigate = useNavigate();
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [helperId, setHelperId] = useState('');
  const [myId, setMyId] = useState('');
  
  // Customization States
  const [nodeShape, setNodeShape] = useState('circle'); // circle, square, hexagon
  const [nodeType, setNodeType] = useState('color'); // color, emoji, image
  const [nodeValue, setNodeValue] = useState('#10b981'); // default green
  const [linkColor, setLinkColor] = useState('#cbd5e1'); // default arrow color

  const handleSubmit = (e) => {
    e.preventDefault();
    onComplete({
      myId: myId.toUpperCase(),
      helperId: isStartingNew ? null : helperId.toUpperCase(),
      isOriginator: isStartingNew,
      // Pass their customizations to the dashboard!
      customShape: nodeShape,
      customType: nodeType,
      customValue: nodeValue,
      customLinkColor: linkColor
    });
    navigate('/dashboard');
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-20">
      <h1 className="text-3xl font-extrabold mb-8 text-slate-900 text-center tracking-tight">Claim Your Node</h1>
      
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
        {/* Core IDs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {!isStartingNew && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Helper's ID</label>
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

        {/* --- CUSTOMIZATION SECTION --- */}
        <div className="border-t border-slate-200 pt-8 mt-2">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">🎨 Design Your Node</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Shape Picker */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">Shape</label>
              <select value={nodeShape} onChange={(e) => setNodeShape(e.target.value)} className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                <option value="circle">Circle</option>
                <option value="square">Square</option>
                <option value="hexagon">Hexagon</option>
              </select>
            </div>

            {/* Content Type Picker */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">Content</label>
              <select value={nodeType} onChange={(e) => {
                  setNodeType(e.target.value);
                  // Auto-set default values so it doesn't break
                  if (e.target.value === 'color') setNodeValue('#10b981');
                  if (e.target.value === 'emoji') setNodeValue('💖');
                  if (e.target.value === 'image') setNodeValue('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix');
                }} 
                className="p-3 border border-slate-200 rounded-xl bg-slate-50"
              >
                <option value="color">Solid Color</option>
                <option value="emoji">Emoji</option>
                <option value="image">Avatar / Image URL</option>
              </select>
            </div>

            {/* Dynamic Value Input */}
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

          {/* Arrow Color Picker */}
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

        <button type="submit" className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white text-lg font-bold py-4 px-4 rounded-xl shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5">
          {isStartingNew ? 'Start My Chain' : 'Connect Me'}
        </button>
      </form>
    </div>
  );
}

// --- DASHBOARD (Applies customizations to the tree) ---
function Dashboard({ userData }) {
  const isOriginator = userData?.isOriginator;
  const myId = userData?.myId || "ME-123";
  const helperId = userData?.helperId || "HELPER-99";

  // Construct the graph using the user's custom choices!
  const treeData = {
    nodes: isOriginator 
      ? [
          { id: myId, shape: userData?.customShape, type: userData?.customType, value: userData?.customValue }, 
          { id: 'Next Person...', ghost: true } 
        ]
      : [
          { id: helperId, shape: 'circle', type: 'color', value: '#94a3b8' }, // Generic helper
          { id: myId, shape: userData?.customShape, type: userData?.customType, value: userData?.customValue }, 
          { id: 'Next Person...', ghost: true }
        ],
    links: isOriginator
      ? [
          { source: myId, target: 'Next Person...', customColor: userData?.customLinkColor }
        ]
      : [
          { source: helperId, target: myId, customColor: '#cbd5e1' },
          { source: myId, target: 'Next Person...', customColor: userData?.customLinkColor }
        ]
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center mt-12 gap-12 w-full max-w-6xl mx-auto">
      <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">{isOriginator ? "Your chain has started!" : "You joined the chain!"}</h1>
        <p className="text-slate-500 text-lg mb-8">Your node has been customized. Give this ID to the next person you help.</p>
        <div className="bg-white border-2 border-slate-900 p-6 rounded-2xl shadow-xl w-full max-w-sm">
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2">Your ID</p>
          <p className="text-4xl font-black text-slate-900 tracking-wider">{myId}</p>
        </div>
      </div>
      <div className="w-full lg:w-1/2 h-[450px] relative border border-slate-200 rounded-3xl bg-white shadow-sm p-4 bg-grid-pattern">
        <KindnessGraph data={treeData} />
      </div>
    </div>
  );
}

// --- MAIN APP (Showing off customizations on Homepage) ---
function App() {
  const [userData, setUserData] = useState(null);

  // Crazy custom homepage tree to show what is possible!
  const homePageTree = {
    nodes: [
      { id: 'ORIGIN-MAX', shape: 'hexagon', type: 'image', value: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Max' },
      
      // Gen 1
      { id: 'SQUARE-GUY', shape: 'square', type: 'color', value: '#3b82f6' },
      { id: 'EMOJI-GAL', shape: 'circle', type: 'emoji', value: '🔥' },
      { id: 'LADY-X', shape: 'hexagon', type: 'image', value: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia' },
      
      // Gen 2
      { id: 'PINK-NODE', shape: 'circle', type: 'color', value: '#ec4899' },
      { id: 'ALIEN', shape: 'square', type: 'emoji', value: '👽' },
    ],
    links: [
      { source: 'ORIGIN-MAX', target: 'SQUARE-GUY', customColor: '#3b82f6' }, // Blue arrow
      { source: 'ORIGIN-MAX', target: 'EMOJI-GAL', customColor: '#f59e0b' }, // Yellow arrow
      { source: 'ORIGIN-MAX', target: 'LADY-X', customColor: '#10b981' },    // Green arrow
      
      { source: 'SQUARE-GUY', target: 'PINK-NODE', customColor: '#ec4899' }, // Pink arrow
      { source: 'EMOJI-GAL', target: 'ALIEN', customColor: '#8b5cf6' },      // Purple arrow
    ]
  };

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
        <nav className="flex justify-between items-center p-6 lg:px-12 bg-white border-b border-slate-200 sticky top-0 z-50">
          <Link to="/" className="text-2xl font-black tracking-tighter text-slate-900">
            KINDNESS<span className="text-emerald-500">CHAIN</span>
          </Link>
          <Link to="/join" className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-2.5 px-6 rounded-full transition-all shadow-md">
            Join the Chain
          </Link>
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
                  <KindnessGraph data={homePageTree} />
                </div>
              </div>
            } />
            <Route path="/join" element={<LogKindnessForm onComplete={setUserData} />} />
            <Route path="/dashboard" element={<Dashboard userData={userData} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;