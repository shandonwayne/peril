import { useEffect, useState, useCallback } from 'react';
import { RotateCcw, Trash2, FolderOpen } from 'lucide-react';
import { supabase, Board, Category, Question, Player, GameSession, generateJoinCode } from './lib/supabase';
import PerilLogo from './assets/perillogo.svg';
import { JeopardyBoard } from './components/JeopardyBoard';
import { ModeToggle } from './components/ModeToggle';
import { DSFrame } from './components/DSFrame';
import { SessionPanel } from './components/SessionPanel';
import { PlayerJoinPage } from './components/PlayerJoinPage';
import { BoardSwitcherModal } from './components/BoardSwitcherModal';

// Simple client-side routing: /join shows the player join page, everything else shows the host board
function useRoute(): 'host' | 'join' {
  const path = window.location.pathname;
  if (path === '/join') return 'join';
  return 'host';
}

export default function App() {
  const route = useRoute();

  if (route === 'join') {
    return <PlayerJoinPage />;
  }

  return <HostBoard />;
}

function HostBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [buzzedPlayerId, setBuzzedPlayerId] = useState<string | null>(null);
  const [showBoardSwitcher, setShowBoardSwitcher] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(true);

  useEffect(() => {
    // Always show the welcome prompt on first visit — don't auto-load any board
    setShowBoardSwitcher(true);
    setLoading(false);
  }, []);

  const loadBoard = async (boardId?: string) => {
    setLoading(true);
    setCategories([]);
    setQuestions([]);
    setSession(null);
    setPlayers([]);
    setBuzzedPlayerId(null);

    let b: Board | null = null;

    if (!boardId) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .maybeSingle();
    b = data;

    if (!b) {
      setLoading(false);
      return;
    }

    setBoard(b);

    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('board_id', b.id)
      .order('display_order', { ascending: true });

    setCategories(cats ?? []);

    if (cats && cats.length > 0) {
      const catIds = cats.map(c => c.id);
      const { data: qs } = await supabase
        .from('questions')
        .select('*')
        .in('category_id', catIds);
      setQuestions(qs ?? []);
    }

    // Create or resume a game session for this board
    await ensureSession(b.id);

    setLoading(false);
  };

  const ensureSession = async (boardId: string) => {
    // Look for an existing active session for this board
    const { data: existing } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('board_id', boardId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: GameSession | null };

    if (existing) {
      setSession(existing);
      return;
    }

    // Create a new session with a unique join code
    let code = generateJoinCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: newSession, error } = await supabase
        .from('game_sessions')
        .insert({ board_id: boardId, join_code: code, is_active: true })
        .select()
        .single() as { data: GameSession | null; error: unknown };
      if (!error && newSession) {
        setSession(newSession);
        return;
      }
      // Code collision — try another
      code = generateJoinCode();
      attempts++;
    }
  };

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`host_buzzer_board_${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'buzzer_events',
        filter: `session_id=eq.${session.id}`,
      }, (payload) => {
        const ev = payload.new as { player_id: string; status: string };
        if (ev.status === 'pending') {
          setBuzzedPlayerId(prev => prev ?? ev.player_id);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'buzzer_events',
        filter: `session_id=eq.${session.id}`,
      }, (payload) => {
        const ev = payload.new as { player_id: string; status: string };
        if (ev.status === 'correct' || ev.status === 'incorrect') {
          setBuzzedPlayerId(null);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const handleMarkAnswered = async (id: string) => {
    await supabase.from('questions').update({ is_answered: true }).eq('id', id);
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, is_answered: true } : q));
  };

  const handleSaveQuestion = async (id: string, questionText: string, answerText: string, isDailyDouble: boolean, imageUrl: string | null) => {
    await supabase.from('questions').update({ question_text: questionText, answer_text: answerText, is_daily_double: isDailyDouble, image_url: imageUrl }).eq('id', id);
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, question_text: questionText, answer_text: answerText, is_daily_double: isDailyDouble, image_url: imageUrl } : q));
  };

  const handleSaveCategoryName = async (id: string, name: string) => {
    await supabase.from('categories').update({ name }).eq('id', id);
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  const handleRestart = async () => {
    const ids = questions.map(q => q.id);
    if (ids.length > 0) {
      await supabase.from('questions').update({ is_answered: false }).in('id', ids);
    }
    setQuestions(prev => prev.map(q => ({ ...q, is_answered: false })));

    // Reset all player scores in the current session
    if (session) {
      await supabase.from('players').update({ score: 0 }).eq('session_id', session.id);
      setPlayers(prev => prev.map(p => ({ ...p, score: 0 })));
    }
  };

  const handleClearBoard = async () => {
    if (!window.confirm('Clear all questions and answers from the board? This cannot be undone.')) return;
    const ids = questions.map(q => q.id);
    if (ids.length > 0) {
      await supabase.from('questions').update({
        question_text: '',
        answer_text: '',
        is_answered: false,
        is_daily_double: false,
        image_url: null,
      }).in('id', ids);
    }
    setQuestions(prev => prev.map(q => ({
      ...q,
      question_text: '',
      answer_text: '',
      is_answered: false,
      is_daily_double: false,
      image_url: null,
    })));
  };

  // Stable callback for SessionPanel to avoid re-subscription loops
  const handlePlayersChange = useCallback((updated: Player[]) => {
    setPlayers(updated);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0908' }}>
        <span
          className="text-stone-600 animate-pulse"
          style={{ fontFamily: "'Jacquard 12', serif", fontSize: '21px', letterSpacing: '0.15em' }}
        >
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 gap-4"
      style={{ backgroundColor: '#0a0908' }}
    >
      <img src={PerilLogo} alt="Peril" className="h-12 select-none" draggable={false} />

      {session && (
        <SessionPanel
          joinCode={session.join_code}
          sessionId={session.id}
          players={players}
          onPlayersChange={handlePlayersChange}
          buzzedPlayerId={buzzedPlayerId}
          onClearBuzz={() => setBuzzedPlayerId(null)}
        />
      )}

      <DSFrame
        cornerSize={32}
        className="w-full max-w-5xl p-6 relative"
        style={{
          backgroundColor: '#111009',
          boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 20px rgba(139,96,64,0.06)',
        }}
      >
        {categories.length > 0 ? (
          <JeopardyBoard
            categories={categories}
            questions={questions}
            isEditMode={isEditMode}
            sessionId={session?.id}
            players={players}
            onMarkAnswered={handleMarkAnswered}
            onSaveQuestion={handleSaveQuestion}
            onSaveCategoryName={handleSaveCategoryName}
          />
        ) : (
          <div
            className="text-stone-600 text-center py-20"
            style={{ fontFamily: "'Jacquard 12', serif", fontSize: '20px' }}
          >
            No board data found.
          </div>
        )}

      </DSFrame>

      <div className="flex items-center gap-4">
        {!isEditMode && (
          <button
            onClick={handleRestart}
            className="flex items-center gap-1.5 text-stone-600 hover:text-stone-500 transition-colors duration-200 cursor-pointer bg-transparent border-none outline-none"
            style={{ fontSize: '11px', letterSpacing: '0.05em' }}
            title="Reset board"
          >
            <RotateCcw size={10} />
            <span>reset</span>
          </button>
        )}
        {isEditMode && (
          <>
            {board?.board_code && (
              <span
                className="text-stone-700 tracking-widest select-all"
                style={{ fontFamily: "'Jacquard 12', serif", fontSize: '13px' }}
                title="Board code — share this to reload the board later"
              >
                {board.board_code}
              </span>
            )}
            <button
              onClick={() => setShowBoardSwitcher(true)}
              className="flex items-center gap-1.5 text-stone-600 hover:text-stone-400 transition-colors duration-200 cursor-pointer bg-transparent border-none outline-none"
              style={{ fontSize: '11px', letterSpacing: '0.05em' }}
              title="Load or create a board"
            >
              <FolderOpen size={10} />
              <span>boards</span>
            </button>
            <button
              onClick={handleClearBoard}
              className="flex items-center gap-1.5 text-stone-600 hover:text-red-700 transition-colors duration-200 cursor-pointer bg-transparent border-none outline-none"
              style={{ fontSize: '11px', letterSpacing: '0.05em' }}
              title="Clear all questions and answers"
            >
              <Trash2 size={10} />
              <span>clear board</span>
            </button>
          </>
        )}
        <ModeToggle isEditMode={isEditMode} onToggle={() => setIsEditMode(e => !e)} />
      </div>

      {showBoardSwitcher && (
        <BoardSwitcherModal
          onClose={isFirstVisit ? undefined : () => setShowBoardSwitcher(false)}
          onBoardLoaded={(id) => { setIsFirstVisit(false); setShowBoardSwitcher(false); loadBoard(id); }}
        />
      )}
    </div>
  );
}
