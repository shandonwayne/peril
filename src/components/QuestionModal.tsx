import { useState, useEffect, useRef } from 'react';
import { X, Check, ThumbsUp, ThumbsDown, Zap } from 'lucide-react';
import { Question, Player, BuzzerEvent, GameSession, supabase } from '../lib/supabase';
import { DSFrame } from './DSFrame';
import { DailyDoubleAnimation } from './DailyDoubleAnimation';

const FONT = "'Germania One', serif";

interface QuestionModalProps {
  question: Question;
  categoryName: string;
  sessionId: string;
  onClose: () => void;
  onMarkAnswered: (id: string) => void;
  players?: Player[];
}

export function QuestionModal({ question, categoryName, sessionId, onClose, onMarkAnswered, players = [] }: QuestionModalProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [animationDone, setAnimationDone] = useState(!question.is_daily_double);
  const [awardedTo, setAwardedTo] = useState<string | null>(null);
  const [buzzerEvents, setBuzzerEvents] = useState<BuzzerEvent[]>([]);
  const [adjudicating, setAdjudicating] = useState(false);
  // Daily double wager state (polled from DB)
  const [wager, setWager] = useState<number | null>(null);
  const wagerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // The player who wagers on daily double = player in first place (highest score)
  const wagerPlayer = players.length > 0
    ? [...players].sort((a, b) => b.score - a.score)[0]
    : null;

  // When animation done: register active question and (for daily double) set the wager player
  useEffect(() => {
    if (!animationDone || !sessionId) return;

    const update: Record<string, unknown> = { buzzer_question_id: question.id, buzzer_open: !question.is_daily_double };

    if (question.is_daily_double && wagerPlayer) {
      update.daily_double_player_id = wagerPlayer.id;
      update.daily_double_wager = null;
    }

    supabase.from('game_sessions').update(update).eq('id', sessionId);

    if (!question.is_daily_double) {
      // Poll for buzzer events
      const poll = setInterval(async () => {
        const { data } = await supabase
          .from('buzzer_events')
          .select('*')
          .eq('session_id', sessionId)
          .eq('question_id', question.id)
          .order('buzzed_at', { ascending: true });
        if (data && data.length > 0) {
          setBuzzerEvents(prev => {
            const merged = [...prev];
            for (const ev of data) {
              if (!merged.find(e => e.id === ev.id)) merged.push(ev);
            }
            return merged.sort((a, b) => a.buzzed_at.localeCompare(b.buzzed_at));
          });
        }
      }, 1000);
      return () => clearInterval(poll);
    } else {
      // Poll for wager submission
      wagerPollRef.current = setInterval(async () => {
        const { data } = await supabase
          .from('game_sessions')
          .select('daily_double_wager')
          .eq('id', sessionId)
          .maybeSingle() as { data: Pick<GameSession, 'daily_double_wager'> | null };
        if (data?.daily_double_wager != null) {
          setWager(data.daily_double_wager);
          if (wagerPollRef.current) clearInterval(wagerPollRef.current);
        }
      }, 800);
      return () => { if (wagerPollRef.current) clearInterval(wagerPollRef.current); };
    }
  }, [animationDone, question.id, question.is_daily_double, sessionId, wagerPlayer]);

  // Subscribe to buzzer events (only for non-daily-double)
  useEffect(() => {
    if (question.is_daily_double) return;

    const channel = supabase
      .channel(`host_buzzer_${sessionId}_${question.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'buzzer_events',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const ev = payload.new as BuzzerEvent;
        if (ev.question_id !== null && ev.question_id !== question.id) return;
        setBuzzerEvents(prev => {
          if (prev.find(e => e.id === ev.id)) return prev;
          return [...prev, ev].sort((a, b) => a.buzzed_at.localeCompare(b.buzzed_at));
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'buzzer_events',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const ev = payload.new as BuzzerEvent;
        setBuzzerEvents(prev => prev.map(e => e.id === ev.id ? ev : e));
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, question.id, question.is_daily_double]);

  // Subscribe to session updates to catch wager submissions in real time
  useEffect(() => {
    if (!question.is_daily_double) return;

    const channel = supabase
      .channel(`host_dd_wager_${sessionId}_${question.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        const updated = payload.new as GameSession;
        if (updated.daily_double_wager != null) {
          setWager(updated.daily_double_wager);
          if (wagerPollRef.current) clearInterval(wagerPollRef.current);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, question.id, question.is_daily_double]);

  const clearBuzzer = async () => {
    await supabase
      .from('game_sessions')
      .update({ buzzer_open: false, buzzer_question_id: null, daily_double_player_id: null, daily_double_wager: null })
      .eq('id', sessionId);
  };

  const effectivePoints = question.is_daily_double && wager != null ? wager : question.point_value;

  const handleCorrect = async (ev: BuzzerEvent) => {
    if (adjudicating) return;
    setAdjudicating(true);
    await supabase.rpc('increment_player_score', { player_id: ev.player_id, delta: effectivePoints });
    setAwardedTo(ev.player_id);
    await supabase.from('buzzer_events').update({ status: 'correct' }).eq('id', ev.id);
    setBuzzerEvents(prev => prev.map(e => e.id === ev.id ? { ...e, status: 'correct' } : e));
    await clearBuzzer();
    setAdjudicating(false);
  };

  const handleIncorrect = async (ev: BuzzerEvent) => {
    if (adjudicating) return;
    setAdjudicating(true);
    await supabase.rpc('increment_player_score', { player_id: ev.player_id, delta: -effectivePoints });
    await supabase.from('buzzer_events').update({ status: 'incorrect' }).eq('id', ev.id);
    setBuzzerEvents(prev => prev.map(e => e.id === ev.id ? { ...e, status: 'incorrect' } : e));
    setAdjudicating(false);
  };

  // Daily double: correct/incorrect applied directly to the wager player (no buzzer needed)
  const handleDDCorrect = async () => {
    if (!wagerPlayer || adjudicating) return;
    setAdjudicating(true);
    await supabase.rpc('increment_player_score', { player_id: wagerPlayer.id, delta: effectivePoints });
    setAwardedTo(wagerPlayer.id);
    await clearBuzzer();
    setAdjudicating(false);
  };

  const handleDDIncorrect = async () => {
    if (!wagerPlayer || adjudicating) return;
    setAdjudicating(true);
    await supabase.rpc('increment_player_score', { player_id: wagerPlayer.id, delta: -effectivePoints });
    setAwardedTo(`incorrect_${wagerPlayer.id}`);
    await clearBuzzer();
    setAdjudicating(false);
  };

  const handleClose = async () => {
    await clearBuzzer();
    if (showAnswer) onMarkAnswered(question.id);
    onClose();
  };

  const getPlayerName = (playerId: string) =>
    players.find(p => p.id === playerId)?.name ?? 'Unknown';

  const pendingEvents = buzzerEvents.filter(e => e.status === 'pending');
  const resolvedEvents = buzzerEvents.filter(e => e.status !== 'pending');
  const activeBuzz = pendingEvents[0] ?? null;

  if (!animationDone) {
    return <DailyDoubleAnimation onComplete={() => setAnimationDone(true)} />;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', animation: 'fadeIn 0.4s ease-out' }}
      onClick={handleClose}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes buzzSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .buzz-item { animation: buzzSlideIn 0.25s ease-out both; }
      `}</style>
      <DSFrame
        cornerSize={28}
        className="relative w-full max-w-2xl mx-4 p-10 flex flex-col items-center gap-8"
        style={{ backgroundColor: '#0d0c0b', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-stone-600 hover:text-stone-300 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div
            className="text-stone-500 text-center tracking-widest uppercase"
            style={{ fontFamily: FONT, fontSize: '19px' }}
          >
            {categoryName}
          </div>
          {question.is_daily_double && (
            <>
              <span className="text-stone-700">·</span>
              <div
                className="tracking-widest uppercase"
                style={{ fontFamily: FONT, fontSize: '19px', color: '#c97d28' }}
              >
                Daily Double
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 w-full">
          {question.image_url && (
            <img
              src={question.image_url}
              alt="Question"
              className="w-full object-contain border border-stone-800"
              style={{ maxHeight: '260px' }}
            />
          )}
          <div
            className="text-amber-200 text-center leading-relaxed"
            style={{ fontFamily: FONT, fontSize: '23px', lineHeight: '2' }}
          >
            {question.question_text || <span className="text-stone-600 italic">No question set</span>}
          </div>
        </div>

        {/* Point value / wager display */}
        <div
          className="text-stone-500 tracking-widest"
          style={{ fontFamily: FONT, fontSize: '28px' }}
        >
          {question.is_daily_double && wager != null ? wager : question.point_value}
          {question.is_daily_double && wager == null && (
            <span style={{ fontSize: '14px', color: '#57534e', marginLeft: '10px' }}>
              (awaiting wager)
            </span>
          )}
        </div>

        {/* Daily Double wager panel */}
        {question.is_daily_double ? (
          <div className="w-full flex flex-col items-center gap-4">
            {wager == null ? (
              <div
                className="w-full flex flex-col items-center gap-3 px-6 py-5 border"
                style={{ borderColor: 'rgba(201,125,40,0.4)', borderStyle: 'dashed', backgroundColor: 'rgba(201,125,40,0.04)' }}
              >
                <div style={{ fontFamily: FONT, fontSize: '13px', color: '#78716c', letterSpacing: '0.06em' }}>
                  Waiting for wager from
                </div>
                <div style={{ fontFamily: FONT, fontSize: '22px', color: '#c97d28', letterSpacing: '0.04em' }}>
                  {wagerPlayer?.name ?? '—'}
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-4">
                <div
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 border"
                  style={{ borderColor: 'rgba(201,125,40,0.6)', backgroundColor: 'rgba(201,125,40,0.06)' }}
                >
                  <span style={{ fontFamily: FONT, fontSize: '15px', color: '#78716c' }}>
                    {wagerPlayer?.name} wagered
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: '28px', color: '#c97d28' }}>
                    {wager}
                  </span>
                </div>

                {!awardedTo ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDDCorrect}
                      disabled={adjudicating}
                      className="flex items-center gap-1.5 px-6 py-2 border border-stone-700 text-stone-500 hover:border-green-800 hover:text-green-600 transition-all duration-200 disabled:opacity-40"
                      style={{ fontFamily: FONT, fontSize: '15px' }}
                    >
                      <ThumbsUp size={14} />
                      Correct
                    </button>
                    <button
                      onClick={handleDDIncorrect}
                      disabled={adjudicating}
                      className="flex items-center gap-1.5 px-6 py-2 border border-stone-700 text-stone-500 hover:border-red-900 hover:text-red-700 transition-all duration-200 disabled:opacity-40"
                      style={{ fontFamily: FONT, fontSize: '15px' }}
                    >
                      <ThumbsDown size={14} />
                      Incorrect
                    </button>
                  </div>
                ) : (
                  <div className="text-stone-600" style={{ fontFamily: FONT, fontSize: '12px' }}>
                    {awardedTo.startsWith('incorrect_') ? 'Points deducted' : 'Points awarded'}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Regular question buzzer section */
          <div className="w-full flex flex-col items-center gap-3">
            <div
              className="w-full flex items-center justify-between px-6 py-4 border transition-all duration-300"
              style={{
                borderColor: activeBuzz ? 'rgba(212,168,67,0.5)' : 'rgba(68,60,52,0.5)',
                borderStyle: activeBuzz ? 'solid' : 'dashed',
                backgroundColor: activeBuzz ? 'rgba(212,168,67,0.07)' : 'rgba(17,16,9,0.6)',
                minHeight: '68px',
              }}
            >
              {activeBuzz ? (
                <>
                  <div
                    className="flex items-center gap-3"
                    style={{ animation: 'buzzSlideIn 0.2s ease-out both' }}
                  >
                    <Zap size={18} className="text-amber-400" fill="currentColor" />
                    <span style={{ fontFamily: FONT, fontSize: '26px', color: '#e8d5a8', letterSpacing: '0.04em' }}>
                      {getPlayerName(activeBuzz.player_id)}
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: '13px', color: '#78716c' }}>buzzed first</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCorrect(activeBuzz)}
                      disabled={adjudicating}
                      className="flex items-center gap-1.5 px-4 py-1.5 border border-stone-700 text-stone-500 hover:border-green-800 hover:text-green-600 transition-all duration-200 disabled:opacity-40"
                      style={{ fontFamily: FONT, fontSize: '13px' }}
                    >
                      <ThumbsUp size={12} />
                      Correct
                    </button>
                    <button
                      onClick={() => handleIncorrect(activeBuzz)}
                      disabled={adjudicating}
                      className="flex items-center gap-1.5 px-4 py-1.5 border border-stone-700 text-stone-500 hover:border-red-900 hover:text-red-700 transition-all duration-200 disabled:opacity-40"
                      style={{ fontFamily: FONT, fontSize: '13px' }}
                    >
                      <ThumbsDown size={12} />
                      Incorrect
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 mx-auto" style={{ opacity: 0.35 }}>
                  <Zap size={16} style={{ color: '#7B695D' }} />
                  <span style={{ fontFamily: FONT, fontSize: '15px', color: '#7B695D', letterSpacing: '0.08em' }}>
                    Waiting for buzz...
                  </span>
                </div>
              )}
            </div>

            {pendingEvents.slice(1).length > 0 && (
              <div className="w-full flex flex-col gap-1 mt-1">
                <div
                  className="text-stone-600 tracking-widest uppercase text-center"
                  style={{ fontFamily: FONT, fontSize: '11px' }}
                >
                  Queue
                </div>
                {pendingEvents.slice(1).map((ev, i) => (
                  <div
                    key={ev.id}
                    className="buzz-item flex items-center gap-3 px-5 py-2 border border-stone-900"
                    style={{ backgroundColor: '#0d0c0b' }}
                  >
                    <span style={{ fontFamily: FONT, fontSize: '13px', color: '#57534e' }}>{i + 2}</span>
                    <span style={{ fontFamily: FONT, fontSize: '16px', color: '#78716c' }}>
                      {getPlayerName(ev.player_id)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {resolvedEvents.length > 0 && (
              <div className="w-full flex flex-col gap-1">
                {resolvedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="buzz-item flex items-center justify-between px-5 py-2 border border-stone-900 opacity-50"
                  >
                    <span style={{ fontFamily: FONT, fontSize: '15px', color: '#57534e' }}>
                      {getPlayerName(ev.player_id)}
                    </span>
                    <span style={{
                      fontFamily: FONT,
                      fontSize: '13px',
                      color: ev.status === 'correct' ? '#6b8f5e' : '#8f3b3b',
                    }}>
                      {ev.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reveal / Answer */}
        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="px-8 py-3 border border-amber-800 text-amber-600 hover:text-amber-300 hover:border-amber-500 transition-all duration-200 tracking-widest"
            style={{ fontFamily: FONT, fontSize: '19px' }}
          >
            Reveal Answer
          </button>
        ) : (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="w-full h-px bg-stone-800" />
            <div
              className="text-stone-300 text-center leading-relaxed"
              style={{ fontFamily: FONT, fontSize: '21px', lineHeight: '2' }}
            >
              {question.answer_text || <span className="text-stone-600 italic">No answer set</span>}
            </div>

            {/* Manual award panel — fallback if buzzer wasn't used (non-daily-double) */}
            {!question.is_daily_double && players.length > 0 && !awardedTo && buzzerEvents.filter(e => e.status === 'correct').length === 0 && (
              <div className="flex flex-col items-center gap-3 w-full">
                <div
                  className="text-stone-600 tracking-widest uppercase"
                  style={{ fontFamily: FONT, fontSize: '12px' }}
                >
                  Award {question.point_value} pts to
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {players.map(p => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        setAwardedTo(p.id);
                        await supabase.rpc('increment_player_score', { player_id: p.id, delta: question.point_value });
                      }}
                      disabled={!!awardedTo}
                      className="flex items-center gap-1.5 px-4 py-2 border transition-all duration-200 disabled:cursor-default"
                      style={{
                        fontFamily: FONT,
                        fontSize: '14px',
                        borderColor: awardedTo === p.id ? '#6b8f5e' : 'rgba(87,83,78,0.5)',
                        color: awardedTo === p.id ? '#a3c898' : awardedTo ? '#3d3935' : '#a8a29e',
                        backgroundColor: awardedTo === p.id ? 'rgba(107,143,94,0.1)' : 'transparent',
                      }}
                    >
                      {awardedTo === p.id && <Check size={12} className="text-green-600" />}
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(awardedTo && !awardedTo.startsWith('incorrect_')) || buzzerEvents.find(e => e.status === 'correct') ? (
              <div className="text-stone-600" style={{ fontFamily: FONT, fontSize: '12px' }}>
                Points awarded
              </div>
            ) : null}
          </div>
        )}
      </DSFrame>
    </div>
  );
}
