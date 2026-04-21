import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Question, Player, supabase } from '../lib/supabase';
import { DSFrame } from './DSFrame';
import { DailyDoubleAnimation } from './DailyDoubleAnimation';

const FONT = "'Germania One', serif";

interface QuestionModalProps {
  question: Question;
  categoryName: string;
  onClose: () => void;
  onMarkAnswered: (id: string) => void;
  players?: Player[];
}

export function QuestionModal({ question, categoryName, onClose, onMarkAnswered, players = [] }: QuestionModalProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [animationDone, setAnimationDone] = useState(!question.is_daily_double);
  const [awardedTo, setAwardedTo] = useState<string | null>(null);

  const handleReveal = () => {
    setShowAnswer(true);
  };

  const handleClose = () => {
    if (showAnswer) {
      onMarkAnswered(question.id);
    }
    onClose();
  };

  const handleAward = async (player: Player) => {
    if (awardedTo) return;
    setAwardedTo(player.id);
    const newScore = player.score + question.point_value;
    await supabase.from('players').update({ score: newScore }).eq('id', player.id);
  };

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
      `}</style>
      <DSFrame
        cornerSize={28}
        className="relative w-full max-w-2xl mx-4 p-10 flex flex-col items-center gap-8"
        style={{ backgroundColor: '#0d0c0b' }}
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

            {/* Award points panel */}
            {players.length > 0 && (
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
                      onClick={() => handleAward(p)}
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
                {awardedTo && (
                  <div
                    className="text-stone-600"
                    style={{ fontFamily: FONT, fontSize: '12px' }}
                  >
                    Points awarded
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DSFrame>
    </div>
  );
}
