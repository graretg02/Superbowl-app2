
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Shuffle, 
  Lock, 
  Unlock, 
  Settings2, 
  TrendingUp, 
  Info,
  Trophy,
  Users,
  Eraser,
  Download,
  Smartphone,
  Share2,
  Copy,
  ExternalLink,
  Check,
  CloudCheck,
  Save
} from 'lucide-react';
import { Participant, GameState } from './types';
import { COLORS, DEFAULT_STATE } from './constants';
import { getSquareAnalysis } from './services/geminiService';

const STORAGE_KEY = 'superbowl_squares_state_v3';
const ACTIVE_PLAYER_KEY = 'squares_active_player';
const VIEW_KEY = 'squares_current_view';

const App: React.FC = () => {
  // --- STATE INITIALIZATION (Local Storage Load) ---
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_STATE, ...parsed };
      }
    } catch (e) {
      console.error("Failed to load game state", e);
    }
    return DEFAULT_STATE;
  });

  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_PLAYER_KEY);
  });

  const [view, setView] = useState<'grid' | 'settings'>(() => {
    return (localStorage.getItem(VIEW_KEY) as 'grid' | 'settings') || 'grid';
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedStr, setLastSavedStr] = useState<string>('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [importCode, setImportCode] = useState('');
  
  // PWA Install logic
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Sync Main Game State to LocalStorage
  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      const stateToSave = { ...gameState, lastSaved: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      setSaveStatus('saved');
      setLastSavedStr(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 500); // Debounce save to avoid thrashing disk
    return () => clearTimeout(timer);
  }, [gameState]);

  // Sync Active Player and View
  useEffect(() => {
    if (activeParticipantId) localStorage.setItem(ACTIVE_PLAYER_KEY, activeParticipantId);
    else localStorage.removeItem(ACTIVE_PLAYER_KEY);
  }, [activeParticipantId]);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  // --- ACTIONS ---
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("Installation shortcut not available yet. Please use your browser's 'Add to Home Screen' option manually.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const addParticipant = () => {
    if (!newFirstName.trim() || !newLastName.trim()) return;
    const newP: Participant = {
      id: crypto.randomUUID(),
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      color: COLORS[gameState.participants.length % COLORS.length]
    };
    setGameState(prev => ({
      ...prev,
      participants: [...prev.participants, newP]
    }));
    setNewFirstName('');
    setNewLastName('');
    setActiveParticipantId(newP.id);
  };

  const removeParticipant = (id: string) => {
    setGameState(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p.id !== id),
      grid: prev.grid.map(row => row.map(cell => cell === id ? null : cell))
    }));
    if (activeParticipantId === id) setActiveParticipantId(null);
  };

  const toggleSquare = (r: number, c: number) => {
    if (gameState.isLocked) return;
    setGameState(prev => {
      const newGrid = [...prev.grid.map(row => [...row])];
      const currentVal = newGrid[r][c];
      if (currentVal !== null) {
        newGrid[r][c] = null;
      } else if (activeParticipantId) {
        newGrid[r][c] = activeParticipantId;
      }
      return { ...prev, grid: newGrid };
    });
  };

  const clearGrid = () => {
    if (window.confirm('WARNING: This will delete ALL players and ALL squares. Continue?')) {
      setGameState(DEFAULT_STATE);
      setAiAnalysis(null);
    }
  };

  const unlockGrid = () => {
    if (window.confirm('Unlock grid? This clears the randomized numbers but keeps your players and squares.')) {
      setGameState(prev => ({
        ...prev,
        rowNumbers: Array(10).fill(null),
        colNumbers: Array(10).fill(null),
        isLocked: false
      }));
      setAiAnalysis(null);
    }
  };

  const shuffleNumbers = () => {
    const nums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const shuffleArray = (array: number[]) => {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };
    setGameState(prev => ({
      ...prev,
      rowNumbers: shuffleArray(nums),
      colNumbers: shuffleArray(nums),
      isLocked: true
    }));
  };

  const getInitials = (p: Participant) => (p.firstName.charAt(0) + p.lastName.charAt(0)).toUpperCase();

  const handleAiAnalysis = async () => {
    if (!gameState.isLocked) return;
    setIsAnalyzing(true);
    const analysis = await getSquareAnalysis(
      gameState.team1, 
      gameState.team2, 
      gameState.rowNumbers as number[], 
      gameState.colNumbers as number[]
    );
    setAiAnalysis(analysis || "Analysis unavailable.");
    setIsAnalyzing(false);
  };

  const exportGame = () => {
    const data = btoa(JSON.stringify(gameState));
    navigator.clipboard.writeText(data);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const importGame = () => {
    try {
      const decoded = JSON.parse(atob(importCode));
      if (decoded.participants && decoded.grid) {
        setGameState(decoded);
        setImportCode('');
        alert("Game loaded successfully!");
      }
    } catch (e) {
      alert("Invalid Game Code");
    }
  };

  const filledCount = gameState.grid.flat().filter(Boolean).length;
  const isGridFull = filledCount === 100;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 pb-20 md:pb-0">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 shadow-xl">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight">Squares <span className="text-indigo-400">Pro</span></h1>
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                  <span className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    {saveStatus === 'saving' ? 'Syncing...' : `Saved ${lastSavedStr}`}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{filledCount}/100 Squares Filled</p>
            </div>
          </div>
          <div className="flex gap-2">
             <button 
              onClick={() => setView(view === 'grid' ? 'settings' : 'grid')}
              className={`p-2.5 rounded-xl transition-all ${view === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {view === 'settings' ? (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <section className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-8">
              <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
                  <Smartphone className="w-6 h-6" /> Phone Installation Guide
                </h2>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-widest border-b border-slate-800 pb-3 mb-2">
                    <span>Clean Install Status</span>
                    <span className="text-emerald-400 flex items-center gap-1"><CloudCheck className="w-4 h-4" /> Persistent Storage Active</span>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-400 shrink-0 border border-slate-700">1</div>
                    <p className="text-sm text-slate-300">Tap the <b>"Open in new window"</b> or <b>"External Preview"</b> icon in the top right of this AI Studio pane.</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-400 shrink-0 border border-slate-700">2</div>
                    <p className="text-sm text-slate-300">In the clean browser tab, tap the <b>Share</b> button (iOS) or <b>Menu ⋮</b> (Android).</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-400 shrink-0 border border-slate-700">3</div>
                    <p className="text-sm text-slate-300">Select <b>"Add to Home Screen"</b>. This ensures the app doesn't disappear when you close your browser.</p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 pt-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-indigo-400" /> Transfer to Phone
                  </h3>
                  <p className="text-xs text-slate-400">Use this to move your player list from your computer to your phone instantly.</p>
                  <div className="space-y-2">
                    <button 
                      onClick={exportGame}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-xl py-3.5 text-sm font-bold transition-all"
                    >
                      {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copySuccess ? 'Code Copied!' : 'Copy Transfer Code'}
                    </button>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Paste code on new device..."
                        value={importCode}
                        onChange={(e) => setImportCode(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                      <button 
                        onClick={importGame}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl text-xs font-bold transition-all active:scale-95"
                      >
                        Load
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-indigo-400" /> Game Details
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Home Team</label>
                        <input 
                          type="text" 
                          value={gameState.team1}
                          onChange={(e) => setGameState(p => ({...p, team1: e.target.value}))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Away Team</label>
                        <input 
                          type="text" 
                          value={gameState.team2}
                          onChange={(e) => setGameState(p => ({...p, team2: e.target.value}))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={clearGrid}
                      className="w-full flex items-center justify-center gap-2 bg-rose-900/10 hover:bg-rose-900/30 text-rose-400 border border-rose-900/30 rounded-xl py-3.5 text-xs font-bold transition-all"
                    >
                      <Trash2 className="w-4 h-4" /> Wipe All Data & Names
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-6 border-t border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  Autosave: <span className="text-emerald-500">Enabled</span>
                </div>
                <button 
                  onClick={() => setView('grid')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-12 rounded-2xl shadow-lg transition-all active:scale-95"
                >
                  SAVE & CONTINUE
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_350px] gap-8">
            <div className="space-y-4">
              <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-4 md:p-6 border border-slate-800 shadow-2xl">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-indigo-400 font-black uppercase tracking-[0.2em] text-[10px]">
                  {gameState.team2 || 'Away'} (Cols)
                </div>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 -rotate-90 text-rose-400 font-black uppercase tracking-[0.2em] text-[10px] origin-center whitespace-nowrap">
                  {gameState.team1 || 'Home'} (Rows)
                </div>

                <div className="mt-8 ml-8 overflow-x-auto custom-scrollbar">
                  <div className="inline-grid grid-cols-[auto_repeat(10,1fr)] gap-1 min-w-[450px] md:min-w-0">
                    <div className="w-10 h-10"></div>
                    {gameState.colNumbers.map((num, i) => (
                      <div key={i} className="flex items-center justify-center font-black text-lg text-indigo-400 bg-indigo-500/10 rounded-lg border border-indigo-500/20 grid-cell-aspect">
                        {num !== null ? num : '?'}
                      </div>
                    ))}
                    {Array(10).fill(null).map((_, r) => (
                      <React.Fragment key={r}>
                        <div className="w-10 h-10 flex items-center justify-center font-black text-lg text-rose-400 bg-rose-500/10 rounded-lg border border-rose-500/20">
                          {gameState.rowNumbers[r] !== null ? gameState.rowNumbers[r] : '?'}
                        </div>
                        {Array(10).fill(null).map((_, c) => {
                          const participantId = gameState.grid[r][c];
                          const participant = gameState.participants.find(p => p.id === participantId);
                          return (
                            <button
                              key={`${r}-${c}`}
                              onClick={() => toggleSquare(r, c)}
                              disabled={gameState.isLocked}
                              style={{ 
                                backgroundColor: participant ? `${participant.color}44` : undefined,
                                borderColor: participant ? participant.color : undefined
                              }}
                              className={`
                                relative grid-cell-aspect border rounded-lg transition-all duration-200 group/cell
                                ${!participant ? 'bg-slate-950 border-slate-800 hover:border-slate-600' : 'border-2'}
                                ${gameState.isLocked ? 'cursor-default' : 'cursor-pointer active:scale-90 shadow-sm'}
                                flex items-center justify-center
                              `}
                            >
                              {participant && (
                                <span className="text-[10px] font-black text-white drop-shadow-sm">
                                  {getInitials(participant)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 items-center justify-between p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-lg">
                <div className="flex gap-2">
                  {gameState.isLocked ? (
                    <span className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
                      <Lock className="w-3 h-3" /> Grid Randomized
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 rounded-full text-xs font-bold border border-amber-500/20 animate-pulse">
                      <Unlock className="w-3 h-3" /> Live Editing
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {gameState.isLocked ? (
                    <>
                      <button onClick={unlockGrid} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all active:scale-95 shadow-lg">
                        <Unlock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleAiAnalysis}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl font-bold shadow-xl shadow-fuchsia-600/30 transition-all disabled:opacity-50 active:scale-95"
                      >
                        <TrendingUp className="w-4 h-4" />
                        {isAnalyzing ? '...' : 'AI Stats'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={shuffleNumbers}
                      disabled={!isGridFull}
                      className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black transition-all active:scale-95 ${isGridFull ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}`}
                    >
                      <Shuffle className="w-5 h-5" /> 
                      {isGridFull ? 'RANDOMIZE AXES' : `${100 - filledCount} More Needed`}
                    </button>
                  )}
                </div>
              </div>

              {aiAnalysis && (
                <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-3xl p-8 animate-in slide-in-from-bottom-4 shadow-2xl">
                  <h3 className="text-lg font-black text-fuchsia-400 flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5" /> Gold Mine Analysis
                  </h3>
                  <div className="text-sm text-fuchsia-100/80 leading-relaxed whitespace-pre-line font-medium">{aiAnalysis}</div>
                </div>
              )}
            </div>

            <aside className="space-y-6">
              <section className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-6 lg:sticky lg:top-24">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" /> Players
                  </h2>
                  <div className="flex items-center gap-1.5 sm:hidden">
                    <span className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Saved</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" placeholder="First" value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                    <input 
                      type="text" placeholder="Last" value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <button onClick={addParticipant} className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
                    <Plus className="w-4 h-4" /> ADD PLAYER
                  </button>
                </div>

                <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                  {gameState.participants.map(p => {
                    const count = gameState.grid.flat().filter(id => id === p.id).length;
                    return (
                      <div 
                        key={p.id}
                        onClick={() => setActiveParticipantId(p.id)}
                        className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${activeParticipantId === p.id ? 'bg-indigo-500/10 border-indigo-500/50 shadow-inner' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg" style={{ backgroundColor: p.color }}>
                            {getInitials(p)}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-bold text-sm truncate">{p.firstName} {p.lastName}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{count} squares</p>
                          </div>
                        </div>
                        {!gameState.isLocked && (
                          <button onClick={(e) => { e.stopPropagation(); removeParticipant(p.id); }} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-rose-500 transition-all rounded-lg hover:bg-rose-500/10">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-slate-800">
                   <div className="flex items-start gap-2 text-[10px] text-slate-500">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 text-indigo-500" />
                    <p>Select a player above, then tap grid squares to fill them. Your progress is autosaved locally.</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        )}
      </main>

      <footer className="mt-20 border-t border-slate-800 p-8 text-center text-slate-600 flex flex-col items-center gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Super Bowl Squares Pro • Mobile Manager</p>
        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-700 bg-slate-900/50 px-3 py-1 rounded-full">
           <Save className="w-3 h-3" /> LOCAL STORAGE PERSISTENCE ACTIVE
        </div>
      </footer>
    </div>
  );
};

export default App;
