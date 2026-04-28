import { useState, useEffect, useRef } from 'react';
import { X, Check, Radio, RadioTower, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Question, Player, BuzzerEvent, supabase } from '../lib/supabase';
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

  // Buzzer state
  const [buzzerOpen, setBuzzerOpen] = useState(false);
  const [buzzerEvents, setBuzzerEvents] = useState<BuzzerEvent[]>([]);
  const [adjudicating, setAdjudicating] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Auto-open buzzer 4 seconds after question is shown
  useEffect(() => {
    if (!animationDone) return;
    const timer = setTimeout(() => {
      setBuzzerEvents([]);
      setBuzzerOpen(true);
      supabase
        .from('game_sessions')
        .update({ buzzer_open: true, buzzer_question_id: question.id })
        .eq('id', sessionId);
    }, 4000);
    return () => clearTimeout(timer);
  }, [animationDone, question.id, sessionId]);

  // Subscribe to buzzer events for this question while modal is open
  useEffect(() => {
    const channel = supabase
      .channel(`host_buzzer_${sessionId}_${question.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'buzzer_events',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const ev = payload.new as BuzzerEvent;
        if (ev.question_id !== question.id) return;
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
  }, [sessionId, question.id]);

  const openBuzzer = async () => {
    // Clear any previous events for this question
    setBuzzerEvents([]);
    setBuzzerOpen(true);
    await supabase
      .from('game_sessions')
      .update({ buzzer_open: true, buzzer_question_id: question.id })
      .eq('id', sessionId);
  };

  const closeBuzzer = async () => {
    setBuzzerOpen(false);
    await supabase
      .from('game_sessions')
      .update({ buzzer_open: false, buzzer_question_id: null })
      .eq('id', sessionId);
  };

  const handleCorrect = async (ev: BuzzerEvent) => {
    if (adjudicating) return;
    setAdjudicating(true);

    const p = players.find(pl => pl.id === ev.player_id);
    if (p) {
      const newScore = p.score + question.point_value;
      await supabase.from('players').update({ score: newScore }).eq('id', p.id);
      setAwardedTo(p.id);
    }

    await supabase.from('buzzer_events').update({ status: 'correct' }).eq('id', ev.id);
    setBuzzerEvents(prev => prev.map(e => e.id === ev.id ? { ...e, status: 'correct' } : e));
    await closeBuzzer();
    setAdjudicating(false);
  };

  const handleIncorrect = async (ev: BuzzerEvent) => {
    if (adjudicating) return;
    setAdjudicating(true);

    const p = players.find(pl => pl.id === ev.player_id);
    if (p) {
      const newScore = p.score - question.point_value;
      await supabase.from('players').update({ score: newScore }).eq('id', p.id);
    }

    await supabase.from('buzzer_events').update({ status: 'incorrect' }).eq('id', ev.id);
    setBuzzerEvents(prev => prev.map(e => e.id === ev.id ? { ...e, status: 'incorrect' } : e));

    // Re-open buzzer so remaining players can buzz
    const remainingPending = buzzerEvents.filter(e => e.id !== ev.id && e.status === 'pending');
    if (remainingPending.length === 0) {
      // No one else has buzzed — keep buzzer open for late buzzers
      await supabase
        .from('game_sessions')
        .update({ buzzer_open: true, buzzer_question_id: question.id })
        .eq('id', sessionId);
    }
    setAdjudicating(false);
  };

  const handleClose = async () => {
    if (buzzerOpen) await closeBuzzer();
    if (showAnswer) {
      onMarkAnswered(question.id);
    }
    onClose();
  };

  const handleReveal = () => setShowAnswer(true);

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name ?? 'Unknown';
  };

  // Pending events are those not yet adjudicated, sorted by buzz time
  const pendingEvents = buzzerEvents.filter(e => e.status === 'pending');
  const resolvedEvents = buzzerEvents.filter(e => e.status !== 'pending');
  // The "active" buzz is the earliest pending one
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
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

        <div
          className="text-stone-500 tracking-widest"
          style={{ fontFamily: FONT, fontSize: '28px' }}
        >
          {question.point_value}
        </div>

        {/* Buzzer control */}
        <div className="w-full flex flex-col items-center gap-4">
          {!buzzerOpen ? (
            <button
              onClick={openBuzzer}
              className="flex items-center gap-2 px-6 py-2.5 border border-stone-700 text-stone-400 hover:border-amber-700 hover:text-amber-500 transition-all duration-200 tracking-widest"
              style={{ fontFamily: FONT, fontSize: '15px' }}
            >
              <Radio size={14} />
              Open Buzzer
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 tracking-widest"
                style={{ fontFamily: FONT, fontSize: '14px', color: '#d4a843' }}
              >
                <RadioTower size={14} className="animate-pulse" />
                Buzzer Open
              </div>
              <button
                onClick={closeBuzzer}
                className="text-stone-600 hover:text-stone-400 transition-colors"
                style={{ fontFamily: FONT, fontSize: '13px' }}
              >
                close
              </button>
            </div>
          )}

          {/* Buzz queue */}
          {buzzerEvents.length > 0 && (
            <div className="w-full flex flex-col gap-2">
              <div
                className="text-stone-600 tracking-widest uppercase text-center"
                style={{ fontFamily: FONT, fontSize: '11px' }}
              >
                Buzz Order
              </div>

              {/* Active buzz — first pending */}
              {activeBuzz && (
                <div
                  className="buzz-item flex items-center justify-between px-5 py-3 border"
                  style={{
                    borderColor: 'rgba(212,168,67,0.4)',
                    backgroundColor: 'rgba(212,168,67,0.06)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-4 text-right"
                      style={{ fontFamily: FONT, fontSize: '13px', color: '#d4a843' }}
                    >
                      1
                    </span>
                    <span
                      style={{ fontFamily: FONT, fontSize: '18px', color: '#e8d5a8' }}
                    >
                      {getPlayerName(activeBuzz.player_id)}
                    </span>
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
                </div>
              )}

              {/* Remaining pending buzzes */}
              {pendingEvents.slice(1).map((ev, i) => (
                <div
                  key={ev.id}
                  className="buzz-item flex items-center gap-3 px-5 py-2 border border-stone-900"
                  style={{ backgroundColor: '#0d0c0b' }}
                >
                  <span
                    className="w-4 text-right"
                    style={{ fontFamily: FONT, fontSize: '13px', color: '#57534e' }}
                  >
                    {i + 2}
                  </span>
                  <span
                    style={{ fontFamily: FONT, fontSize: '16px', color: '#78716c' }}
                  >
                    {getPlayerName(ev.player_id)}
                  </span>
                </div>
              ))}

              {/* Resolved buzzes */}
              {resolvedEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="buzz-item flex items-center justify-between px-5 py-2 border border-stone-900 opacity-50"
                >
                  <span
                    style={{ fontFamily: FONT, fontSize: '15px', color: '#57534e' }}
                  >
                    {getPlayerName(ev.player_id)}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT,
                      fontSize: '13px',
                      color: ev.status === 'correct' ? '#6b8f5e' : '#8f3b3b',
                    }}
                  >
                    {ev.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reveal / Answer section */}
        {!showAnswer ? (
          <button
            onClick={handleReveal}
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

            {/* Manual award points panel (fallback when not using buzzer) */}
            {players.length > 0 && !awardedTo && buzzerEvents.filter(e => e.status === 'correct').length === 0 && (
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
                        const newScore = p.score + question.point_value;
                        await supabase.from('players').update({ score: newScore }).eq('id', p.id);
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

            {(awardedTo || buzzerEvents.find(e => e.status === 'correct')) && (
              <div
                className="text-stone-600"
                style={{ fontFamily: FONT, fontSize: '12px' }}
              >
                Points awarded
              </div>
            )}
          </div>
        )}
      </DSFrame>
    </div>
  );
}
