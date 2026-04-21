import { useState } from 'react';
import { X, Flame, RefreshCw, Check } from 'lucide-react';
import { Question } from '../lib/supabase';
import { DSFrame } from './DSFrame';

const FONT = "'Germania One', serif";
const POINT_VALUES = [200, 400, 600, 800, 1000];

interface GeneratedQuestion {
  point_value: number;
  question_text: string;
  answer_text: string;
}

interface GenerateCategoryModalProps {
  categoryId: string;
  categoryName: string;
  questions: Question[];
  onClose: () => void;
  onSaveQuestion: (id: string, questionText: string, answerText: string, isDailyDouble: boolean, imageUrl: string | null) => Promise<void>;
}

type Phase = 'input' | 'loading' | 'preview' | 'saving';

const LOADING_LINES = [
  'Kindling the bonfire...',
  'Summoning from the fog...',
  'Consulting the primordial serpents...',
  'Deciphering the archives...',
  'Awakening the sleeping scholar...',
];

function LoadingFlicker() {
  const [lineIdx] = useState(() => Math.floor(Math.random() * LOADING_LINES.length));
  return (
    <div className="flex flex-col items-center gap-6 py-10">
      <Flame
        size={36}
        className="text-amber-700 animate-pulse"
        style={{ filter: 'drop-shadow(0 0 8px rgba(180,100,30,0.6))' }}
      />
      <span
        className="text-stone-500 tracking-widest animate-pulse"
        style={{ fontFamily: FONT, fontSize: '18px' }}
      >
        {LOADING_LINES[lineIdx]}
      </span>
    </div>
  );
}

export function GenerateCategoryModal({
  categoryId,
  categoryName,
  questions,
  onClose,
  onSaveQuestion,
}: GenerateCategoryModalProps) {
  const [topic, setTopic] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [generated, setGenerated] = useState<GeneratedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingSet, setSavingSet] = useState<Set<number>>(new Set());
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());

  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const callGenerate = async (t: string) => {
    setPhase('loading');
    setError(null);
    try {
      if (!geminiApiKey) throw new Error('No Gemini API key configured. Add VITE_GEMINI_API_KEY to your .env file.');

      const prompt = `You are a Jeopardy question writer. Generate exactly 5 trivia questions about the topic: "${t}".

Return ONLY a valid JSON array with no other text. Each item must have:
- "point_value": one of 200, 400, 600, 800, 1000 (each used exactly once, ordered easiest to hardest)
- "question_text": the clue as it would appear on a Jeopardy board (a statement or description, not a question)
- "answer_text": the correct response in the form "What is ..." or "Who is ..."

Example format:
[
  {"point_value": 200, "question_text": "...", "answer_text": "..."},
  {"point_value": 400, "question_text": "...", "answer_text": "..."},
  {"point_value": 600, "question_text": "...", "answer_text": "..."},
  {"point_value": 800, "question_text": "...", "answer_text": "..."},
  {"point_value": 1000, "question_text": "...", "answer_text": "..."}
]`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'Gemini API error');

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const questions: GeneratedQuestion[] = JSON.parse(jsonMatch ? jsonMatch[0] : text);

      if (!Array.isArray(questions) || questions.length === 0) throw new Error('No questions returned');
      setGenerated(questions);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setPhase('input');
    }
  };

  const handleForge = () => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    callGenerate(trimmed);
  };

  const handleRegenerate = () => {
    callGenerate(topic.trim());
  };

  const handleInscribe = async () => {
    setPhase('saving');
    for (const gen of generated) {
      setSavingSet(prev => new Set(prev).add(gen.point_value));
      const q = questions.find(q => q.category_id === categoryId && q.point_value === gen.point_value);
      if (q) {
        await onSaveQuestion(q.id, gen.question_text, gen.answer_text, q.is_daily_double, q.image_url ?? null);
      }
      setSavingSet(prev => { const s = new Set(prev); s.delete(gen.point_value); return s; });
      setSavedSet(prev => new Set(prev).add(gen.point_value));
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}
      onClick={onClose}
    >
      <DSFrame
        cornerSize={28}
        className="relative w-full max-w-2xl mx-4 p-8 flex flex-col gap-6"
        style={{ backgroundColor: '#0d0c0b', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-600 hover:text-stone-300 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col gap-1">
          <div
            className="text-stone-500 tracking-widest uppercase"
            style={{ fontFamily: FONT, fontSize: '13px', letterSpacing: '0.2em' }}
          >
            Inscribe Column
          </div>
          <div
            className="text-amber-700 tracking-wide"
            style={{ fontFamily: FONT, fontSize: '22px' }}
          >
            {categoryName}
          </div>
        </div>

        {(phase === 'input' || phase === 'loading') && (
          <div className="flex flex-col gap-3">
            <label
              className="text-stone-500 tracking-widest uppercase"
              style={{ fontFamily: FONT, fontSize: '16px' }}
            >
              Topic / Prompt
            </label>
            <input
              autoFocus
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleForge(); }}
              disabled={phase === 'loading'}
              className="w-full bg-transparent border border-stone-700 text-stone-200 px-4 py-3 focus:outline-none focus:border-stone-500 transition-colors disabled:opacity-40"
              style={{ fontFamily: FONT, fontSize: '20px' }}
              placeholder="e.g. Ancient Roman Emperors"
            />
            {error && (
              <div
                className="text-red-700 tracking-wide"
                style={{ fontFamily: FONT, fontSize: '15px' }}
              >
                {error}
              </div>
            )}
          </div>
        )}

        {phase === 'loading' && <LoadingFlicker />}

        {phase === 'preview' && (
          <div className="flex flex-col gap-3">
            <div
              className="text-stone-500 tracking-widest uppercase"
              style={{ fontFamily: FONT, fontSize: '14px', letterSpacing: '0.2em' }}
            >
              Forged Questions
            </div>
            <div className="flex flex-col gap-2">
              {POINT_VALUES.map(pv => {
                const g = generated.find(x => x.point_value === pv);
                if (!g) return null;
                const saving = savingSet.has(pv);
                const saved = savedSet.has(pv);
                return (
                  <div
                    key={pv}
                    className="flex gap-3 border border-stone-800 p-3"
                    style={{ backgroundColor: '#111009' }}
                  >
                    <div
                      className="shrink-0 w-12 text-right"
                      style={{ fontFamily: "'Jacquard 12', serif", fontSize: '20px', color: '#7B695D', paddingTop: '2px' }}
                    >
                      {saving ? (
                        <RefreshCw size={14} className="animate-spin text-amber-700 ml-auto" />
                      ) : saved ? (
                        <Check size={14} className="text-amber-600 ml-auto" />
                      ) : (
                        pv
                      )}
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div
                        className="text-stone-300 leading-snug"
                        style={{ fontFamily: FONT, fontSize: '16px' }}
                      >
                        {g.question_text}
                      </div>
                      <div
                        className="text-stone-600"
                        style={{ fontFamily: FONT, fontSize: '14px' }}
                      >
                        {g.answer_text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-between gap-3 mt-auto pt-2">
          {phase === 'preview' ? (
            <>
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-2 px-4 py-2 border border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-500 transition-all"
                style={{ fontFamily: FONT, fontSize: '17px' }}
              >
                <RefreshCw size={13} />
                Try Again
              </button>
              <button
                onClick={handleInscribe}
                className="flex items-center gap-2 px-5 py-2 border border-amber-800 text-amber-600 hover:text-amber-300 hover:border-amber-500 transition-all"
                style={{ fontFamily: FONT, fontSize: '17px' }}
              >
                <Flame size={14} />
                Inscribe to Board
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2 border border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-500 transition-all"
                style={{ fontFamily: FONT, fontSize: '17px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleForge}
                disabled={!topic.trim() || phase === 'loading'}
                className="flex items-center gap-2 px-5 py-2 border border-amber-800 text-amber-600 hover:text-amber-300 hover:border-amber-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ fontFamily: FONT, fontSize: '17px' }}
              >
                <Flame size={14} />
                Forge Questions
              </button>
            </>
          )}
        </div>
      </DSFrame>
    </div>
  );
}
