import { useEffect, useState, useRef } from 'react';
import { supabase, Player, GameSession, BuzzerEvent, generateDeviceToken } from '../lib/supabase';
import PerilLogo from '../assets/perillogo.svg';

const FONT_TITLE = "'Jacquard 12', serif";
const FONT_BODY = "'Germania One', serif";
const DEVICE_TOKEN_KEY = 'peril_device_token';
const PLAYER_ID_KEY = 'peril_player_id';
const SESSION_ID_KEY = 'peril_session_id';
const GAME_CODE_KEY = 'peril_game_code';
const PLAYER_NAME_KEY = 'peril_player_name';

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
  const [buzzerActive, setBuzzerActive] = useState(false);
  const [buzzerQuestionId, setBuzzerQuestionId] = useState<string | null>(null);
  const [hasBuzzed, setHasBuzzed] = useState(false);
  const [wasFirst, setWasFirst] = useState<boolean | null>(null); // null = unknown, true = first, false = not first
  const [buzzerResult, setBuzzerResult] = useState<'correct' | 'incorrect' | null>(null);
  const [buzzing, setBuzzing] = useState(false);
  const buzzerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        .select('buzzer_question_id')
        .eq('id', sessionId)
        .maybeSingle();
      if (data?.buzzer_question_id) {
        setBuzzerQuestionId(data.buzzer_question_id);
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

    // Subscribe to session buzzer_question_id changes
    const sessionChannel = supabase
      .channel(`session_buzzer_${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        const updated = payload.new as GameSession;
        const newQid = updated.buzzer_question_id ?? null;
        setBuzzerQuestionId(prev => {
          if (prev !== newQid) {
            // New question — reset buzzer state
            setBuzzerActive(false);
            setHasBuzzed(false);
            setBuzzerResult(null);
            setWasFirst(null);
            if (buzzerTimerRef.current) clearTimeout(buzzerTimerRef.current);

            if (newQid) {
              // Activate buzzer after 4 seconds
              buzzerTimerRef.current = setTimeout(() => setBuzzerActive(true), 4000);
            }
          }
          return newQid;
        });
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
          setTimeout(() => {
            setBuzzerResult(null);
            setHasBuzzed(false);
            setWasFirst(null);
          }, 2000);
        }
      })
      .subscribe();

    // Subscribe to ALL buzzer inserts for this session to detect if someone else buzzed first
    const allBuzzesChannel = supabase
      .channel(`all_buzzes_${sessionId}_${player.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'buzzer_events',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const ev = payload.new as BuzzerEvent;
        setHasBuzzed(prev => {
          if (prev) {
            // We already buzzed — this INSERT is either ours or someone after us
            if (ev.player_id !== player.id) {
              // Someone else also buzzed — we already buzzed so we're first (or equal)
              // No change needed
            }
            return prev;
          } else {
            // We haven't buzzed yet — someone else beat us
            if (ev.player_id !== player.id) {
              setWasFirst(false);
              setHasBuzzed(true);
              if (buzzerTimerRef.current) clearTimeout(buzzerTimerRef.current);
              buzzerTimerRef.current = setTimeout(() => {
                setHasBuzzed(false);
                setWasFirst(null);
              }, 3000);
            }
            return prev;
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playerChannel);
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(buzzerEventChannel);
      supabase.removeChannel(allBuzzesChannel);
      if (buzzerTimerRef.current) clearTimeout(buzzerTimerRef.current);
    };
  }, [sessionId, player.id]);

  const handleBuzz = async () => {
    if (hasBuzzed || buzzing) return;
    setBuzzing(true);
    const { error } = await supabase.from('buzzer_events').insert({
      session_id: sessionId,
      player_id: player.id,
      question_id: buzzerQuestionId ?? null,
      status: 'pending',
    });
    if (!error) {
      setHasBuzzed(true);
      setWasFirst(true);
      buzzerTimerRef.current = setTimeout(() => {
        setHasBuzzed(false);
        setBuzzerResult(null);
        setWasFirst(null);
      }, 5000);
    }
    setBuzzing(false);
  };

  const rank = allPlayers.findIndex(p => p.id === player.id) + 1;
  const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';

  const canBuzz = !hasBuzzed;
  const tooSlow = wasFirst === false;
  const buzzerResultColor = buzzerResult === 'correct' ? '#6b8f5e' : buzzerResult === 'incorrect' ? '#8f3b3b' : null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start p-6 gap-6"
      style={{ backgroundColor: '#0a0908' }}
    >
      <img src={PerilLogo} alt="Peril" className="h-10 select-none mt-4" draggable={false} />

      {/* Player score card */}
      <div
        className="w-full max-w-sm flex flex-col items-center gap-1 py-4 px-6 border border-stone-800"
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
            fontSize: '52px',
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
          @keyframes buzzer-tooslow {
            0%, 100% { box-shadow: 0 0 0 0 rgba(180,40,40,0); }
            50% { box-shadow: 0 0 0 20px rgba(180,40,40,0.3); }
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
          .buzzer-btn-tooslow {
            animation: buzzer-tooslow 1s ease-in-out infinite;
          }
        `}</style>

        <button
          onClick={handleBuzz}
          disabled={!canBuzz || buzzing}
          className={[
            'w-48 h-48 rounded-full border-4 flex items-center justify-center transition-all duration-300 select-none',
            canBuzz && !buzzerResult && !tooSlow ? 'buzzer-btn-active' : '',
            buzzerResult === 'correct' ? 'buzzer-btn-correct' : '',
            buzzerResult === 'incorrect' ? 'buzzer-btn-incorrect' : '',
            tooSlow ? 'buzzer-btn-tooslow' : '',
          ].join(' ')}
          style={{
            fontFamily: FONT_TITLE,
            fontSize: '22px',
            letterSpacing: '0.1em',
            cursor: canBuzz ? 'pointer' : 'default',
            borderColor: buzzerResult
              ? buzzerResultColor!
              : tooSlow
              ? '#b42828'
              : canBuzz
              ? '#d4a843'
              : '#2d2926',
            color: buzzerResult
              ? buzzerResultColor!
              : tooSlow
              ? '#b42828'
              : canBuzz
              ? '#d4a843'
              : '#2d2926',
            backgroundColor: buzzerResult === 'correct'
              ? 'rgba(107,143,94,0.08)'
              : buzzerResult === 'incorrect'
              ? 'rgba(143,59,59,0.08)'
              : tooSlow
              ? 'rgba(180,40,40,0.06)'
              : canBuzz
              ? 'rgba(212,168,67,0.05)'
              : '#0a0908',
            transform: canBuzz ? 'scale(1)' : 'scale(0.97)',
          }}
        >
          {buzzerResult === 'correct'
            ? 'Correct!'
            : buzzerResult === 'incorrect'
            ? 'Incorrect'
            : tooSlow
            ? 'Too Slow'
            : hasBuzzed
            ? 'Buzzed!'
            : 'BUZZ'}
        </button>

        <div
          className="text-stone-700 text-center"
          style={{ fontFamily: FONT_BODY, fontSize: '12px' }}
        >
          {buzzerResult === 'correct'
            ? 'Points awarded!'
            : buzzerResult === 'incorrect'
            ? 'Points deducted'
            : tooSlow
            ? 'Someone else was faster'
            : hasBuzzed
            ? 'Waiting for host...'
            : 'Tap to buzz in!'}
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
  const [storedCode, setStoredCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinedPlayer, setJoinedPlayer] = useState<Player | null>(null);
  const [joinedSessionId, setJoinedSessionId] = useState<string>('');

  // Pre-fill from localStorage but never auto-advance to tracker
  useEffect(() => {
    (async () => {
      let savedCode = localStorage.getItem(GAME_CODE_KEY) ?? '';
      const savedName = localStorage.getItem(PLAYER_NAME_KEY) ?? '';

      // Migrate: if no GAME_CODE_KEY but we have a session, look up the join code
      if (!savedCode) {
        const sessionId = localStorage.getItem(SESSION_ID_KEY);
        if (sessionId) {
          const { data: session } = await supabase
            .from('game_sessions')
            .select('join_code')
            .eq('id', sessionId)
            .maybeSingle();
          if (session?.join_code) {
            savedCode = session.join_code;
            localStorage.setItem(GAME_CODE_KEY, savedCode);
          }
        }
      }

      // Migrate: if no PLAYER_NAME_KEY but we have a player id, look up the name
      let resolvedName = savedName;
      if (!resolvedName) {
        const playerId = localStorage.getItem(PLAYER_ID_KEY);
        const token = localStorage.getItem(DEVICE_TOKEN_KEY);
        if (playerId && token) {
          const { data: player } = await supabase
            .from('players')
            .select('name')
            .eq('id', playerId)
            .eq('device_token', token)
            .maybeSingle();
          if (player?.name) {
            resolvedName = player.name;
            localStorage.setItem(PLAYER_NAME_KEY, resolvedName);
          }
        }
      }

      if (savedCode) setCodeInput(savedCode);
      if (resolvedName) setNameInput(resolvedName);
      setStoredCode(savedCode);
    })();
  }, []);

  const isRejoining = storedCode.length > 0 && codeInput.trim().toUpperCase() === storedCode;

  const handleJoin = async () => {
    setError('');
    const code = codeInput.trim().toUpperCase();
    const name = nameInput.trim();

    if (!code) { setError('Enter a game code'); return; }
    if (!name) { setError('Enter your name'); return; }
    if (name.length > 20) { setError('Name must be 20 characters or less'); return; }

    setLoading(true);

    // Attempt rejoin: reuse existing player row when returning to the same game
    if (isRejoining) {
      const token = localStorage.getItem(DEVICE_TOKEN_KEY);
      const playerId = localStorage.getItem(PLAYER_ID_KEY);
      const sessionId = localStorage.getItem(SESSION_ID_KEY);

      if (token && playerId && sessionId) {
        const { data: player } = await supabase
          .from('players')
          .select('*')
          .eq('id', playerId)
          .eq('device_token', token)
          .maybeSingle();

        const { data: session } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('is_active', true)
          .maybeSingle();

        if (player && session) {
          setJoinedPlayer(player);
          setJoinedSessionId(sessionId);
          setPhase('tracker');
          setLoading(false);
          return;
        }
      }
      // Fall through to fresh join if stored records are gone
    }

    // Fresh join: look up the session by code and create a new player row
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
    localStorage.setItem(GAME_CODE_KEY, code);
    localStorage.setItem(PLAYER_NAME_KEY, name);
    setStoredCode(code);

    setJoinedPlayer(player);
    setJoinedSessionId(session.id);
    setPhase('tracker');
    setLoading(false);
  };

  if (phase === 'tracker' && joinedPlayer && joinedSessionId) {
    return <PlayerTracker player={joinedPlayer} sessionId={joinedSessionId} />;
  }

  const ctaLabel = loading
    ? (isRejoining ? 'Rejoining...' : 'Joining...')
    : (isRejoining ? 'Rejoin' : 'Join');

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
              onChange={e => { setCodeInput(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="ABCD1234"
              maxLength={8}
              className="bg-transparent border border-stone-800 text-stone-300 px-3 py-2.5 focus:outline-none focus:border-stone-600 transition-colors tracking-widest text-center"
              style={{ fontFamily: FONT_BODY, fontSize: '22px' }}
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
              onChange={e => { setNameInput(e.target.value); setError(''); }}
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
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
