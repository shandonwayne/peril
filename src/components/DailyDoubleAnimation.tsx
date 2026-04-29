import { useEffect, useState } from 'react';

interface DailyDoubleAnimationProps {
  onComplete: () => void;
}

export function DailyDoubleAnimation({ onComplete }: DailyDoubleAnimationProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase('hold'), 400);
    const holdTimer = setTimeout(() => setPhase('exit'), 2200);
    const exitTimer = setTimeout(() => onComplete(), 3000);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  const opacity = phase === 'exit' ? 0 : 1;
  const scale = phase === 'enter' ? 1.12 : phase === 'hold' ? 1 : 0.94;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{
        backgroundColor: '#0a0806',
        transition: phase === 'exit' ? 'opacity 0.8s ease-in' : 'none',
        opacity,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transition: phase === 'enter'
            ? 'transform 0.4s cubic-bezier(0.22,1,0.36,1)'
            : phase === 'exit'
            ? 'transform 0.8s ease-in'
            : 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            fontFamily: "'Germania One', serif",
            fontSize: 'clamp(52px, 10vw, 96px)',
            color: '#c93028',
            letterSpacing: '0.08em',
            lineHeight: 1,
            textShadow: '0 0 40px rgba(201,48,40,0.5), 0 0 80px rgba(201,48,40,0.2)',
          }}
        >
          DAILY
        </div>
        <div
          style={{
            fontFamily: "'Germania One', serif",
            fontSize: 'clamp(52px, 10vw, 96px)',
            color: '#e84a4a',
            letterSpacing: '0.08em',
            lineHeight: 1,
            textShadow: '0 0 40px rgba(232,74,74,0.55), 0 0 80px rgba(232,74,74,0.25)',
          }}
        >
          DOUBLE
        </div>
        <div
          style={{
            marginTop: '8px',
            width: 'clamp(120px, 30vw, 280px)',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(201,48,40,0.6), transparent)',
          }}
        />
      </div>

      <ScanLines />
    </div>
  );
}

function ScanLines() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
        zIndex: 1,
      }}
    />
  );
}
