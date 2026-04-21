import React from 'react';

interface DSFrameProps {
  children?: React.ReactNode;
  className?: string;
  cornerSize?: number;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const BORDER = 'rgba(139,96,64,0.7)';
const BORDER_DIM = 'rgba(139,96,64,0.22)';

function PixelCorner({ size, deg }: { size: number; deg: number }) {
  const s = size;

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 16 16"
      fill="none"
      style={{ transform: `rotate(${deg}deg)`, display: 'block', flexShrink: 0, imageRendering: 'pixelated' }}
    >
      {/* outer L arms – 1px wide */}
      <rect x={0} y={0} width={10} height={1} fill={BORDER} />
      <rect x={0} y={0} width={1} height={10} fill={BORDER} />

      {/* inner echo arms – dimmer */}
      <rect x={2} y={2} width={6} height={1} fill={BORDER_DIM} />
      <rect x={2} y={2} width={1} height={6} fill={BORDER_DIM} />

      {/* corner pixel accent */}
      <rect x={0} y={0} width={2} height={2} fill={BORDER} />

      {/* end ticks */}
      <rect x={9} y={0} width={1} height={2} fill={BORDER} />
      <rect x={0} y={9} width={2} height={1} fill={BORDER} />
    </svg>
  );
}

export function DSFrame({ children, className = '', cornerSize = 22, style, onClick }: DSFrameProps) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        border: `1px solid ${BORDER}`,
        boxShadow: `inset 0 0 14px rgba(0,0,0,0.5)`,
        imageRendering: 'pixelated',
        ...style,
      }}
      onClick={onClick}
    >
      <span style={{ position: 'absolute', top: -(cornerSize / 2), left: -(cornerSize / 2), zIndex: 2, lineHeight: 0 }}>
        <PixelCorner size={cornerSize} deg={0} />
      </span>
      <span style={{ position: 'absolute', top: -(cornerSize / 2), right: -(cornerSize / 2), zIndex: 2, lineHeight: 0 }}>
        <PixelCorner size={cornerSize} deg={90} />
      </span>
      <span style={{ position: 'absolute', bottom: -(cornerSize / 2), right: -(cornerSize / 2), zIndex: 2, lineHeight: 0 }}>
        <PixelCorner size={cornerSize} deg={180} />
      </span>
      <span style={{ position: 'absolute', bottom: -(cornerSize / 2), left: -(cornerSize / 2), zIndex: 2, lineHeight: 0 }}>
        <PixelCorner size={cornerSize} deg={270} />
      </span>
      {children}
    </div>
  );
}
