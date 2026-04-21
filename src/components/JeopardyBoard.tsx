import { useState } from 'react';
import { Pencil, Flame } from 'lucide-react';
import { Category, Question, Player } from '../lib/supabase';
import { QuestionModal } from './QuestionModal';
import { EditQuestionModal } from './EditQuestionModal';
import { GenerateCategoryModal } from './GenerateCategoryModal';
import { DSFrame } from './DSFrame';

const POINT_VALUES = [200, 400, 600, 800, 1000];
const BG = '#111009';

interface JeopardyBoardProps {
  categories: Category[];
  questions: Question[];
  isEditMode: boolean;
  players?: Player[];
  onMarkAnswered: (id: string) => void;
  onSaveQuestion: (id: string, questionText: string, answerText: string, isDailyDouble: boolean, imageUrl: string | null) => Promise<void>;
  onSaveCategoryName: (id: string, name: string) => Promise<void>;
}

export function JeopardyBoard({
  categories,
  questions,
  isEditMode,
  players = [],
  onMarkAnswered,
  onSaveQuestion,
  onSaveCategoryName,
}: JeopardyBoardProps) {
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
  const [generatingCategory, setGeneratingCategory] = useState<Category | null>(null);

  const sorted = [...categories].sort((a, b) => a.display_order - b.display_order);

  const getQuestion = (categoryId: string, pointValue: number) =>
    questions.find(q => q.category_id === categoryId && q.point_value === pointValue);

  const handleCellClick = (q: Question | undefined) => {
    if (!q) return;
    if (isEditMode) {
      setEditingQuestion(q);
    } else {
      if (q.is_answered) return;
      setActiveQuestion(q);
    }
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setCategoryNameDraft(cat.name);
  };

  const commitCategoryName = async (id: string) => {
    if (categoryNameDraft.trim()) {
      await onSaveCategoryName(id, categoryNameDraft.trim());
    }
    setEditingCategoryId(null);
  };

  const getCategoryForQuestion = (q: Question) =>
    categories.find(c => c.id === q.category_id);

  const cols = sorted.length;

  return (
    <>
      <div className="w-full overflow-x-auto" style={{ padding: '10px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: '6px',
            minWidth: '600px',
          }}
        >
          {sorted.map(cat => (
            <DSFrame
              key={cat.id}
              cornerSize={18}
              style={{ backgroundColor: '#2a1f16' }}
              className="group"
            >
              <div
                className="flex items-center justify-center px-3 py-4 text-center"
                style={{ minHeight: '72px' }}
              >
                {isEditMode && editingCategoryId === cat.id ? (
                  <input
                    autoFocus
                    value={categoryNameDraft}
                    onChange={e => setCategoryNameDraft(e.target.value)}
                    onBlur={() => commitCategoryName(cat.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitCategoryName(cat.id);
                      if (e.key === 'Escape') setEditingCategoryId(null);
                    }}
                    className="w-full bg-transparent border-b text-stone-300 text-center focus:outline-none"
                    style={{
                      fontFamily: "'Germania One', serif",
                      fontSize: '19px',
                      lineHeight: '1.15',
                      borderColor: 'rgba(139,96,64,0.6)',
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 w-full">
                    <span
                      className={`text-stone-300 block text-center ${isEditMode ? 'cursor-pointer hover:text-amber-400 transition-colors' : ''}`}
                      style={{ fontFamily: "'Germania One', serif", fontSize: '19px', lineHeight: '1.15' }}
                      onClick={() => isEditMode && startEditCategory(cat)}
                    >
                      {cat.name}
                      {isEditMode && (
                        <Pencil size={8} className="inline ml-1.5 text-stone-600 group-hover:text-amber-600 transition-colors" />
                      )}
                    </span>
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setGeneratingCategory(cat); }}
                        className="flex items-center gap-1 px-2 py-0.5 border border-stone-800 text-stone-600 hover:text-amber-500 hover:border-amber-800 transition-all"
                        style={{ fontFamily: "'Germania One', serif", fontSize: '13px' }}
                        title="Generate questions with AI"
                      >
                        <Flame size={10} />
                        Generate
                      </button>
                    )}
                  </div>
                )}
              </div>
            </DSFrame>
          ))}

          {POINT_VALUES.map(pts =>
            sorted.map(cat => {
              const q = getQuestion(cat.id, pts);
              const answered = q?.is_answered ?? false;

              return (
                <DSFrame
                  key={`${cat.id}-${pts}`}
                  cornerSize={16}
                  style={{
                    backgroundColor: BG,
                    cursor: answered ? 'default' : 'pointer',
                    transition: 'background-color 0.15s',
                    position: 'relative',
                  }}
                  className={!answered ? (isEditMode ? 'hover:bg-stone-800' : 'hover:brightness-125 active:scale-95') : ''}
                  onClick={() => !answered && handleCellClick(q)}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{ height: '72px' }}
                  >
                    <span
                      className="select-none"
                      style={{ color: '#7B695D', fontFamily: "'Jacquard 12', serif", fontSize: '32px' }}
                    >
                      {answered ? '' : pts}
                    </span>
                    {isEditMode && !answered && q && (
                      <span
                        className="absolute bottom-1.5 right-2 text-stone-600"
                        style={{ fontFamily: "'Jacquard 12', serif", fontSize: '17px' }}
                      >
                        {q.question_text ? '●' : '○'}
                      </span>
                    )}
                  </div>
                </DSFrame>
              );
            })
          )}
        </div>
      </div>

      {activeQuestion && (
        <QuestionModal
          question={activeQuestion}
          categoryName={getCategoryForQuestion(activeQuestion)?.name ?? ''}
          onClose={() => setActiveQuestion(null)}
          onMarkAnswered={(id) => {
            onMarkAnswered(id);
            setActiveQuestion(null);
          }}
          players={players}
        />
      )}

      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          categoryName={getCategoryForQuestion(editingQuestion)?.name ?? ''}
          onClose={() => setEditingQuestion(null)}
          onSave={onSaveQuestion}
        />
      )}

      {generatingCategory && (
        <GenerateCategoryModal
          categoryId={generatingCategory.id}
          categoryName={generatingCategory.name}
          questions={questions}
          onClose={() => setGeneratingCategory(null)}
          onSaveQuestion={onSaveQuestion}
        />
      )}
    </>
  );
}
