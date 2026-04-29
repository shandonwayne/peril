import { useEffect, useState } from 'react';
import { Users, Copy, Check, Zap } from 'lucide-react';
import { supabase, Player } from '../lib/supabase';

const FONT = "'Germania One', serif";

interface SessionPanelProps {
  joinCode: string;
  sessionId: string;
  players: Player[];
  onPlayersChange: (players: Player[]) => void;
  buzzedPlayerId?: string | null;
  onClearBuzz?: () => void;
}

export function SessionPanel({ joinCode, sessionId, players, onPlayersChange, buzzedPlayerId, onClearBuzz }: SessionPanelProps) {
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

  const buzzedPlayer = buzzedPlayerId ? players.find(p => p.id === buzzedPlayerId) : null;

  const copyCode = () => {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-5xl">
      {/* Join code bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border border-stone-800 bg-stone-950">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="text-stone-300 tracking-wide"
            style={{ fontFamily: FONT, fontSize: '14px' }}
          >
            Join at <span className="text-amber-400">peril.shandoncardosa.com/join</span>
          </span>
          <span className="text-stone-700">·</span>
          <span
            className="text-stone-300 tracking-wide"
            style={{ fontFamily: FONT, fontSize: '14px' }}
          >
            Code:
          </span>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 group"
            title="Copy join code"
          >
            <span
              className="text-amber-400 tracking-widest font-bold"
              style={{ fontFamily: FONT, fontSize: '18px' }}
            >
              {joinCode}
            </span>
            {copied
              ? <Check size={13} className="text-amber-400" />
              : <Copy size={13} className="text-stone-500 group-hover:text-stone-300 transition-colors" />
            }
          </button>
        </div>

        <div className="flex items-center gap-2 text-stone-400">
          <Users size={13} />
          <span style={{ fontFamily: FONT, fontSize: '13px' }}>
            {players.length} player{players.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Buzzer banner */}
      {buzzedPlayer && (
        <div
          className="flex items-center justify-between px-4 py-3 border border-amber-600"
          style={{ backgroundColor: 'rgba(212,168,67,0.08)', animation: 'buzz-pulse 0.8s ease-in-out infinite' }}
        >
          <style>{`
            @keyframes buzz-pulse {
              0%, 100% { border-color: rgba(212,168,67,0.9); box-shadow: 0 0 12px rgba(212,168,67,0.3); }
              50% { border-color: rgba(212,168,67,0.4); box-shadow: 0 0 4px rgba(212,168,67,0.1); }
            }
          `}</style>
          <div className="flex items-center gap-3">
            <Zap size={16} className="text-amber-400" fill="currentColor" />
            <span style={{ fontFamily: FONT, fontSize: '20px', color: '#d4a843', letterSpacing: '0.06em' }}>
              {buzzedPlayer.name}
            </span>
            <span style={{ fontFamily: FONT, fontSize: '13px', color: '#78716c' }}>
              buzzed in first
            </span>
          </div>
          <button
            onClick={onClearBuzz}
            className="text-stone-600 hover:text-stone-400 transition-colors"
            style={{ fontFamily: FONT, fontSize: '12px', letterSpacing: '0.05em' }}
          >
            dismiss
          </button>
        </div>
      )}

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
                  fontFamily: FONT,
                  fontSize: '12px',
                  color: i === 0 && p.score > 0 ? '#d4a843' : '#78716c',
                }}
              >
                {p.name}
              </span>
              <span
                style={{
                  fontFamily: FONT,
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