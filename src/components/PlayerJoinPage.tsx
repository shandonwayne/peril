import { useEffect, useState, useRef } from 'react';
import { supabase, Player, GameSession, BuzzerEvent, generateDeviceToken } from '../lib/supabase';
import PerilLogo from '../assets/perillogo.svg';

const FONT_TITLE = "'Jacquard 12', serif";
const FONT_BODY = "'Germania One', serif";
const DEVICE_TOKEN_KEY = 'peril_device_token';
const PLAYER_ID_KEY = 'peril_player_id';
const SESSION_ID_KEY = 'peril_session_id';

type Phase = 'join' | 'tracker';

interface PlayerTrackerProps {
  player: Player;
  sessionId: string;
}

function PlayerTracker({ player: initialPlayer, sessionId }: PlayerTrackerProps) {
  const [player, setPlayer] = useState<Player>(initialPlayer);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [scoreFlash, setScoreFlash] = useState(false);
  const prevScore = useRef(initialPlayer.score);

  // Buzzer state
  const [buzzerOpen, setBuzzerOpen] = useState(false);
  const [buzzerQuestionId, setBuzzerQuestionId] = useState<string | null>(null);
  const [hasBuzzed, setHasBuzzed] = useState(false);
  const [buzzerResult, setBuzzerResult] = useState<'correct' | 'incorrect' | null>(null);
  const [buzzing, setBuzzing] = useState(false);
  const buzzerOpenRef = useRef(false);

  useEffect(() => {
    const loadPlayers = async () => {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sessionId)
        .order('score', { ascending: false });
      if (data) setAllPlayers(data);
    };

    loadPlayers();

    // Load initial session state
    const loadSession = async () => {
      const { data } = await supabase
        .from('game_sessions')
        .select('buzzer_open, buzzer_question_id')
        .eq('id', sessionId)
        .maybeSingle();
      if (data) {
        setBuzzerOpen(data.buzzer_open ?? false);
        setBuzzerQuestionId(data.buzzer_question_id ?? null);
        buzzerOpenRef.current = data.buzzer_open ?? false;
      }
    };

    loadSession();

    // Subscribe to player score changes
    const playerChannel = supabase
      .channel(`session_players_${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Player;
          setAllPlayers(prev => {
            const next = prev.map(p => p.id === updated.id ? updated : p);
            return [...next].sort((a, b) => b.score - a.score);
          });
          if (updated.id === player.id) {
            if (updated.score !== prevScore.current) {
              setScoreFlash(true);
              setTimeout(() => setScoreFlash(false), 800);
              prevScore.current = updated.score;
            }
            setPlayer(updated);
          }
        } else if (payload.eventType === 'INSERT') {
          const inserted = payload.new as Player;
          setAllPlayers(prev => {
            if (prev.find(p => p.id === inserted.id)) return prev;
            return [...prev, inserted].sort((a, b) => b.score - a.score);
          });
        }
      })
      .subscribe();

    // Subscribe to session buzzer state changes
    const sessionChannel = supabase
      .channel(`session_buzzer_${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        const updated = payload.new as GameSession;
        const wasOpen = buzzerOpenRef.current;
        const isNowOpen = updated.buzzer_open ?? false;

        setBuzzerOpen(isNowOpen);
        setBuzzerQuestionId(updated.buzzer_question_id ?? null);
        buzzerOpenRef.current = isNowOpen;

        // Reset buzzer state when a new round opens
        if (isNowOpen && !wasOpen) {
          setHasBuzzed(false);
          setBuzzerResult(null);
        }
        // When buzzer closes, clear result display after a beat
        if (!isNowOpen && wasOpen) {
          setTimeout(() => {
            setHasBuzzed(false);
            setBuzzerResult(null);
          }, 2000);
        }
      })
      .subscribe();

    // Subscribe to our own buzzer event for result (correct/incorrect)
    const buzzerEventChannel = supabase
      .channel(`buzzer_result_${player.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'buzzer_events',
        filter: `player_id=eq.${player.id}`,
      }, (payload) => {
        const ev = payload.new as BuzzerEvent;
        if (ev.status === 'correct' || ev.status === 'incorrect') {
          setBuzzerResult(ev.status);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playerChannel);
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(buzzerEventChannel);
    };
  }, [sessionId, player.id]);

  const handleBuzz = async () => {
    if (!buzzerOpen || hasBuzzed || buzzing || !buzzerQuestionId) return;
    setBuzzing(true);
    const { error } = await supabase.from('buzzer_events').insert({
      session_id: sessionId,
      player_id: player.id,
      question_id: buzzerQuestionId,
      status: 'pending',
    });
    if (!error) {
      setHasBuzzed(true);
    }
    setBuzzing(false);
  };

  const rank = allPlayers.findIndex(p => p.id === player.id) + 1;
  const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';

  // Buzzer visual state
  const buzzerActive = buzzerOpen && !hasBuzzed;
  const buzzerResultColor = buzzerResult === 'correct' ? '#6b8f5e' : buzzerResult === 'incorrect' ? '#8f3b3b' : null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start p-6 gap-6"
      style={{ backgroundColor: '#0a0908' }}
    >
      <img src={PerilLogo} alt="Peril" className="h-10 select-none mt-4" draggable={false} />

      {/* Player score card */}
      <div
        className="w-full max-w-sm flex flex-col items-center gap-2 py-8 px-6 border border-stone-800"
        style={{ backgroundColor: '#111009' }}
      >
        <div
          className="text-stone-400 tracking-widest uppercase"
          style={{ fontFamily: FONT_BODY, fontSize: '14px' }}
        >
          {player.name}
        </div>

        <div
          className="transition-all duration-300"
          style={{
            fontFamily: FONT_TITLE,
            fontSize: '72px',
            color: scoreFlash ? '#d4a843' : '#c8b89a',
            textShadow: scoreFlash ? '0 0 24px rgba(212,168,67,0.6)' : 'none',
            lineHeight: 1,
          }}
        >
          {player.score}
        </div>

        {allPlayers.length > 0 && rank > 0 && (
          <div
            className="text-stone-600 tracking-wide"
            style={{ fontFamily: FONT_BODY, fontSize: '13px' }}
          >
            {rank}{suffix} place
          </div>
        )}
      </div>

      {/* Buzzer section */}
      <div className="w-full max-w-sm flex flex-col items-center gap-3">
        <style>{`
          @keyframes buzzer-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(212,168,67,0); }
            50% { box-shadow: 0 0 0 16px rgba(212,168,67,0.18); }
          }
          @keyframes buzzer-correct {
            0%, 100% { box-shadow: 0 0 0 0 rgba(107,143,94,0); }
            50% { box-shadow: 0 0 0 20px rgba(107,143,94,0.25); }
          }
          @keyframes buzzer-incorrect {
            0%, 100% { box-shadow: 0 0 0 0 rgba(143,59,59,0); }
            50% { box-shadow: 0 0 0 20px rgba(143,59,59,0.25); }
          }
          .buzzer-btn-active {
            animation: buzzer-pulse 1.6s ease-in-out infinite;
          }
          .buzzer-btn-correct {
            animation: buzzer-correct 1.4s ease-in-out infinite;
          }
          .buzzer-btn-incorrect {
            animation: buzzer-incorrect 1.4s ease-in-out infinite;
          }
        `}</style>

        <button
          onClick={handleBuzz}
          disabled={!buzzerActive || buzzing}
          className={[
            'w-48 h-48 rounded-full border-4 flex items-center justify-center transition-all duration-300 select-none',
            buzzerActive && !buzzerResult ? 'buzzer-btn-active' : '',
            buzzerResult === 'correct' ? 'buzzer-btn-correct' : '',
            buzzerResult === 'incorrect' ? 'buzzer-btn-incorrect' : '',
          ].join(' ')}
          style={{
            fontFamily: FONT_TITLE,
            fontSize: '22px',
            letterSpacing: '0.1em',
            cursor: buzzerActive ? 'pointer' : 'default',
            borderColor: buzzerResult
              ? buzzerResultColor!
              : buzzerActive
              ? '#d4a843'
              : '#2d2926',
            color: buzzerResult
              ? buzzerResultColor!
              : buzzerActive
              ? '#d4a843'
              : '#2d2926',
            backgroundColor: buzzerResult === 'correct'
              ? 'rgba(107,143,94,0.08)'
              : buzzerResult === 'incorrect'
              ? 'rgba(143,59,59,0.08)'
              : buzzerActive
              ? 'rgba(212,168,67,0.05)'
              : '#0a0908',
            transform: buzzerActive && !hasBuzzed ? 'scale(1)' : 'scale(0.97)',
          }}
        >
          {buzzerResult === 'correct'
            ? 'Correct!'
            : buzzerResult === 'incorrect'
            ? 'Incorrect'
            : hasBuzzed
            ? 'Buzzed!'
            : buzzerActive
            ? 'BUZZ'
            : 'Waiting...'}
        </button>

        <div
          className="text-stone-700 text-center"
          style={{ fontFamily: FONT_BODY, fontSize: '12px' }}
        >
          {buzzerResult === 'correct'
            ? 'Points awarded!'
            : buzzerResult === 'incorrect'
            ? 'Points deducted'
            : hasBuzzed
            ? 'Waiting for host...'
            : buzzerActive
            ? 'Tap to buzz in!'
            : 'Buzzer inactive'}
        </div>
      </div>

      {/* Leaderboard */}
      {allPlayers.length > 1 && (
        <div className="w-full max-w-sm flex flex-col gap-0">
          <div
            className="text-stone-600 tracking-widest uppercase mb-3 text-center"
            style={{ fontFamily: FONT_BODY, fontSize: '11px' }}
          >
            Leaderboard
          </div>
          {allPlayers.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-2 border-b border-stone-900"
              style={{
                backgroundColor: p.id === player.id ? 'rgba(139,96,64,0.08)' : 'transparent',
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-5 text-right"
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: '13px',
                    color: i === 0 ? '#d4a843' : '#57534e',
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: '15px',
                    color: p.id === player.id ? '#c8b89a' : '#78716c',
                  }}
                >
                  {p.name}
                </span>
              </div>
              <span
                style={{
                  fontFamily: FONT_TITLE,
                  fontSize: '20px',
                  color: p.id === player.id ? '#c8b89a' : '#57534e',
                }}
              >
                {p.score}
              </span>
            </div>
          ))}
        </div>
      )}

      <p
        className="text-stone-700 text-center"
        style={{ fontFamily: FONT_BODY, fontSize: '12px' }}
      >
        Keep this page open during the game
      </p>
    </div>
  );
}

export function PlayerJoinPage() {
  const [phase, setPhase] = useState<Phase>('join');
  const [codeInput, setCodeInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinedPlayer, setJoinedPlayer] = useState<Player | null>(null);
  const [joinedSessionId, setJoinedSessionId] = useState<string>('');

  // Try to reconnect from localStorage
  useEffect(() => {
    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    const sessionId = localStorage.getItem(SESSION_ID_KEY);
    if (!token || !playerId || !sessionId) return;

    (async () => {
      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .eq('device_token', token)
        .maybeSingle();

      if (!player) return;

      const { data: session } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('is_active', true)
        .maybeSingle();

      if (!session) return;

      setJoinedPlayer(player);
      setJoinedSessionId(sessionId);
      setPhase('tracker');
    })();
  }, []);

  const handleJoin = async () => {
    setError('');
    const code = codeInput.trim().toUpperCase();
    const name = nameInput.trim();

    if (!code) { setError('Enter a game code'); return; }
    if (!name) { setError('Enter your name'); return; }
    if (name.length > 20) { setError('Name must be 20 characters or less'); return; }

    setLoading(true);

    const { data: session } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('join_code', code)
      .eq('is_active', true)
      .maybeSingle() as { data: GameSession | null };

    if (!session) {
      setError('Game not found. Check the code and try again.');
      setLoading(false);
      return;
    }

    const deviceToken = generateDeviceToken();
    const { data: player, error: insertErr } = await supabase
      .from('players')
      .insert({ session_id: session.id, name, device_token: deviceToken, score: 0 })
      .select()
      .single() as { data: Player | null; error: unknown };

    if (insertErr || !player) {
      setError('Could not join the game. Try again.');
      setLoading(false);
      return;
    }

    localStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
    localStorage.setItem(PLAYER_ID_KEY, player.id);
    localStorage.setItem(SESSION_ID_KEY, session.id);

    setJoinedPlayer(player);
    setJoinedSessionId(session.id);
    setPhase('tracker');
    setLoading(false);
  };

  if (phase === 'tracker' && joinedPlayer && joinedSessionId) {
    return <PlayerTracker player={joinedPlayer} sessionId={joinedSessionId} />;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 gap-8"
      style={{ backgroundColor: '#0a0908' }}
    >
      <img src={PerilLogo} alt="Peril" className="h-12 select-none" draggable={false} />

      <div
        className="w-full max-w-sm flex flex-col gap-6 p-8 border border-stone-800"
        style={{ backgroundColor: '#111009' }}
      >
        <div
          className="text-stone-400 tracking-widest text-center"
          style={{ fontFamily: FONT_TITLE, fontSize: '22px' }}
        >
          Join Game
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-stone-600 tracking-widest uppercase"
              style={{ fontFamily: FONT_BODY, fontSize: '11px' }}
            >
              Game Code
            </label>
            <input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="ABCD1234"
              maxLength={8}
              className="bg-transparent border border-stone-800 text-stone-300 px-3 py-2.5 focus:outline-none focus:border-stone-600 transition-colors tracking-widest text-center"
              style={{ fontFamily: FONT_TITLE, fontSize: '22px' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              className="text-stone-600 tracking-widest uppercase"
              style={{ fontFamily: FONT_BODY, fontSize: '11px' }}
            >
              Your Name
            </label>
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Enter name"
              maxLength={20}
              className="bg-transparent border border-stone-800 text-stone-300 px-3 py-2.5 focus:outline-none focus:border-stone-600 transition-colors"
              style={{ fontFamily: FONT_BODY, fontSize: '16px' }}
            />
          </div>
        </div>

        {error && (
          <p
            className="text-red-700 text-center"
            style={{ fontFamily: FONT_BODY, fontSize: '13px' }}
          >
            {error}
          </p>
        )}

        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full py-3 border border-amber-800 text-amber-600 hover:text-amber-300 hover:border-amber-500 transition-all duration-200 tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontFamily: FONT_BODY, fontSize: '16px' }}
        >
          {loading ? 'Joining...' : 'Join'}
        </button>
      </div>
    </div>
  );
}
