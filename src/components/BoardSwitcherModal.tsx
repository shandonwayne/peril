import { useState } from 'react';
import { X, FolderOpen, Plus, AlertCircle } from 'lucide-react';
import { supabase, generateBoardCode } from '../lib/supabase';

const FONT = "'Germania One', serif";
const POINT_VALUES = [200, 400, 600, 800, 1000];

interface BoardSwitcherModalProps {
  onClose?: () => void;
  onBoardLoaded: (boardId: string) => void;
}

export function BoardSwitcherModal({ onClose, onBoardLoaded }: BoardSwitcherModalProps) {
  const [tab, setTab] = useState<'load' | 'new'>('load');
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const handleLoad = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) { setError('Enter a board code.'); return; }
    setWorking(true);
    setError('');
    const { data, error: err } = await supabase
      .from('boards')
      .select('id')
      .eq('board_code', code)
      .maybeSingle();
    setWorking(false);
    if (err || !data) { setError('No board found with that code.'); return; }
    onBoardLoaded(data.id);
    onClose();
  };

  const handleNew = async () => {
    setWorking(true);
    setError('');

    let boardCode = generateBoardCode();
    // Ensure uniqueness (low probability of collision but be safe)
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase
        .from('boards')
        .select('id')
        .eq('board_code', boardCode)
        .maybeSingle();
      if (!existing) break;
      boardCode = generateBoardCode();
    }

    const { data: board, error: boardErr } = await supabase
      .from('boards')
      .insert({ title: 'PERIL', board_code: boardCode })
      .select()
      .single();

    if (boardErr || !board) {
      setWorking(false);
      setError('Failed to create board. Try again.');
      return;
    }

    // Scaffold empty categories and questions
    const categoryNames = ['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5', 'Category 6'];
    const { data: cats, error: catsErr } = await supabase
      .from('categories')
      .insert(categoryNames.map((name, i) => ({ board_id: board.id, name, display_order: i })))
      .select();

    if (catsErr || !cats) {
      setWorking(false);
      setError('Failed to scaffold categories. Try again.');
      return;
    }

    const questions = cats.flatMap(cat =>
      POINT_VALUES.map(pv => ({
        category_id: cat.id,
        point_value: pv,
        question_text: '',
        answer_text: '',
        is_answered: false,
        is_daily_double: false,
        image_url: null,
      }))
    );

    await supabase.from('questions').insert(questions);

    setWorking(false);
    onBoardLoaded(board.id);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="relative w-full max-w-md border border-stone-800"
        style={{ backgroundColor: '#111009' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-stone-800">
          <span style={{ fontFamily: FONT, fontSize: '22px', color: '#e8d5a8', letterSpacing: '0.05em' }}>
            Board
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-stone-600 hover:text-stone-400 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-800">
          {(['load', 'new'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className="flex-1 py-3 transition-colors"
              style={{
                fontFamily: FONT,
                fontSize: '14px',
                letterSpacing: '0.06em',
                color: tab === t ? '#d4a843' : '#57534e',
                borderBottom: tab === t ? '2px solid #d4a843' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t === 'load' ? 'Load by Code' : 'New Board'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-4">
          {tab === 'load' ? (
            <>
              <p style={{ fontFamily: FONT, fontSize: '14px', color: '#78716c', letterSpacing: '0.03em' }}>
                Enter an 8-character board code to restore a previous board.
              </p>
              <input
                autoFocus
                value={codeInput}
                onChange={e => { setCodeInput(e.target.value.toUpperCase()); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLoad()}
                maxLength={8}
                placeholder="e.g. ABX4HJ2Z"
                className="w-full bg-transparent border border-stone-700 focus:border-stone-500 focus:outline-none px-4 py-3 text-center tracking-widest"
                style={{ fontFamily: FONT, fontSize: '22px', color: '#e8d5a8' }}
              />
              {error && (
                <div className="flex items-center gap-2 text-red-700" style={{ fontFamily: FONT, fontSize: '13px' }}>
                  <AlertCircle size={13} />
                  {error}
                </div>
              )}
              <button
                onClick={handleLoad}
                disabled={working || !codeInput.trim()}
                className="flex items-center justify-center gap-2 w-full py-3 border border-stone-700 text-stone-400 hover:border-amber-700 hover:text-amber-400 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none"
                style={{ fontFamily: FONT, fontSize: '15px', letterSpacing: '0.06em' }}
              >
                <FolderOpen size={15} />
                {working ? 'Loading...' : 'Load Board'}
              </button>
            </>
          ) : (
            <>
              <p style={{ fontFamily: FONT, fontSize: '14px', color: '#78716c', letterSpacing: '0.03em' }}>
                Create a fresh empty board with a new code. Your current board is preserved and can still be loaded by its code.
              </p>
              {error && (
                <div className="flex items-center gap-2 text-red-700" style={{ fontFamily: FONT, fontSize: '13px' }}>
                  <AlertCircle size={13} />
                  {error}
                </div>
              )}
              <button
                onClick={handleNew}
                disabled={working}
                className="flex items-center justify-center gap-2 w-full py-3 border border-stone-700 text-stone-400 hover:border-amber-700 hover:text-amber-400 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none"
                style={{ fontFamily: FONT, fontSize: '15px', letterSpacing: '0.06em' }}
              >
                <Plus size={15} />
                {working ? 'Creating...' : 'New Empty Board'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
