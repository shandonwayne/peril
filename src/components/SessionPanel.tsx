import { useEffect, useState } from 'react';
import { Users, Copy, Check } from 'lucide-react';
import { supabase, Player } from '../lib/supabase';

const FONT_TITLE = "'Jacquard 12', serif";
const FONT_BODY = "'Germania One', serif";

interface SessionPanelProps {
  joinCode: string;
  sessionId: string;
  players: Player[];
  onPlayersChange: (players: Player[]) => void;
}

export function SessionPanel({ joinCode, sessionId, players, onPlayersChange }: SessionPanelProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Initial load
    supabase
      .from('players')
      .select('*')
      .eq('session_id', sessionId)
      .order('score', { ascending: false })
      .then(({ data }) => { if (data) onPlayersChange(data); });

    // Real-time subscription
    const channel = supabase
      .channel(`host_session_${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `session_id=eq.${sessionId}`,
      }, async () => {
        const { data } = await supabase
          .from('players')
          .select('*')
          .eq('session_id', sessionId)
          .order('score', { ascending: false });
        if (data) onPlayersChange(data);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, onPlayersChange]);

  const copyCode = () => {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-5xl">
      {/* Join code bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border border-stone-800 bg-stone-950">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span
              className="text-stone-600 tracking-widest uppercase"
              style={{ fontFamily: FONT_BODY, fontSize: '11px' }}
            >
              Join at this page ·
            </span>
            <span
              className="text-stone-500 tracking-widest uppercase"
              style={{ fontFamily: FONT_BODY, fontSize: '11px' }}
            >
              Code:
            </span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 group"
              title="Copy join code"
            >
              <span
                className="text-amber-500 tracking-widest"
                style={{ fontFamily: FONT_TITLE, fontSize: '20px' }}
              >
                {joinCode}
              </span>
              {copied
                ? <Check size={12} className="text-amber-500" />
                : <Copy size={12} className="text-stone-700 group-hover:text-stone-500 transition-colors" />
              }
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-stone-600">
          <Users size={12} />
          <span style={{ fontFamily: FONT_BODY, fontSize: '12px' }}>
            {players.length} player{players.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Players list */}
      {players.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap px-1">
          {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-2 px-3 py-1.5 border border-stone-800"
              style={{ backgroundColor: '#111009' }}
            >
              <span
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: '12px',
                  color: i === 0 && p.score > 0 ? '#d4a843' : '#78716c',
                }}
              >
                {p.name}
              </span>
              <span
                style={{
                  fontFamily: FONT_TITLE,
                  fontSize: '16px',
                  color: i === 0 && p.score > 0 ? '#d4a843' : '#57534e',
                }}
              >
                {p.score}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
