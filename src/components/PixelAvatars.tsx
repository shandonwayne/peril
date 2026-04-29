// 6 Dark Souls–inspired tamagotchi-style pixel avatars (16×16 pixel grid)
// Each avatar is drawn with <rect> elements on a 16×16 canvas scaled via viewBox.

interface AvatarProps {
  size?: number;
  className?: string;
}

type PixelGrid = string[]; // 16 rows, each 16 chars: '.' = transparent, '#' = filled

function PixelSprite({
  pixels,
  color,
  size = 32,
  className,
}: {
  pixels: PixelGrid;
  color: string;
  size?: number;
  className?: string;
}) {
  const rects: JSX.Element[] = [];
  pixels.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') {
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />);
      }
    }
  });
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: 'pixelated' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {rects}
    </svg>
  );
}

// ──────────────────────────────────────────────
// Avatar 0: Knight – heavy helm, broad shoulders
// ──────────────────────────────────────────────
const KNIGHT: PixelGrid = [
  '......####......',
  '.....######.....',
  '.....######.....',
  '....########....',
  '....##.##.##....',
  '....########....',
  '.....######.....',
  '...##########...',
  '...##########...',
  '...##########...',
  '....##....##....',
  '....##....##....',
  '....##....##....',
  '....##....##....',
  '...####..####...',
  '................',
];

// ──────────────────────────────────────────────
// Avatar 1: Pyromancer – hood & flame hands
// ──────────────────────────────────────────────
const PYROMANCER: PixelGrid = [
  '.....######.....',
  '....########....',
  '....########....',
  '....########....',
  '....#.####.#....',
  '....########....',
  '.....######.....',
  '....########....',
  '...##########...',
  '...##########...',
  '..##..######.#..',
  '.##...######..##',
  '.#....######...#',
  '......######....',
  '.....########...',
  '................',
];

// ──────────────────────────────────────────────
// Avatar 2: Archer – hood, bow at side
// ──────────────────────────────────────────────
const ARCHER: PixelGrid = [
  '....######......',
  '...########.....',
  '...########.....',
  '...########.....',
  '...#.####.#.....',
  '...########.....',
  '....######......',
  '...########....#',
  '..##########..##',
  '..##########.##.',
  '...##....##.##..',
  '...##....####...',
  '...##....###....',
  '...##....##.....',
  '..####..####....',
  '................',
];

// ──────────────────────────────────────────────
// Avatar 3: Undead – skull face, ragged cloak
// ──────────────────────────────────────────────
const UNDEAD: PixelGrid = [
  '......####......',
  '.....######.....',
  '....########....',
  '....#.#..#.#....',
  '....########....',
  '.....##..##.....',
  '.....######.....',
  '....########....',
  '...##########...',
  '..############..',
  '..##..####..##..',
  '..#...####...#..',
  '.....######.....',
  '.....##..##.....',
  '....####.####...',
  '................',
];

// ──────────────────────────────────────────────
// Avatar 4: Cleric – bishop hat, holy symbol
// ──────────────────────────────────────────────
const CLERIC: PixelGrid = [
  '.......##.......',
  '......####......',
  '.....######.....',
  '....########....',
  '....########....',
  '....#.####.#....',
  '....########....',
  '.....######.....',
  '....########....',
  '...##########...',
  '...##########...',
  '....##.##.##....',
  '....##.##.##....',
  '....##....##....',
  '...####..####...',
  '................',
];

// ──────────────────────────────────────────────
// Avatar 5: Sorcerer – pointy hat, staff
// ──────────────────────────────────────────────
const SORCERER: PixelGrid = [
  '.......##.......',
  '......####......',
  '.....######.....',
  '....########....',
  '....########....',
  '.....######.....',
  '....########....',
  '...##########..#',
  '..##############',
  '...##########.#.',
  '....##....##....',
  '....##....##....',
  '...###....##....',
  '..####....##....',
  '.#####...####...',
  '................',
];

const AVATARS = [
  { pixels: KNIGHT,     color: '#a8956a', label: 'Knight'     },
  { pixels: PYROMANCER, color: '#c96a2a', label: 'Pyromancer' },
  { pixels: ARCHER,     color: '#6aad6a', label: 'Archer'     },
  { pixels: UNDEAD,     color: '#8aacba', label: 'Undead'     },
  { pixels: CLERIC,     color: '#d4c47a', label: 'Cleric'     },
  { pixels: SORCERER,   color: '#7aaad4', label: 'Sorcerer'   },
];

export function PixelAvatar({ id, size = 32, className }: { id: number } & AvatarProps) {
  const av = AVATARS[id] ?? AVATARS[0];
  return <PixelSprite pixels={av.pixels} color={av.color} size={size} className={className} />;
}

export function AvatarPicker({
  selected,
  onChange,
}: {
  selected: number;
  onChange: (id: number) => void;
}) {
  return (
    <div className="flex gap-3 justify-center flex-wrap">
      {AVATARS.map((av, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          title={av.label}
          className="flex flex-col items-center gap-1 p-2 border transition-all duration-150 focus:outline-none"
          style={{
            borderColor: selected === i ? av.color : '#292524',
            backgroundColor: selected === i ? 'rgba(255,255,255,0.04)' : 'transparent',
          }}
        >
          <PixelSprite pixels={av.pixels} color={av.color} size={36} />
          <span
            className="tracking-widest uppercase"
            style={{ fontFamily: "'Germania One', serif", fontSize: '9px', color: selected === i ? av.color : '#57534e' }}
          >
            {av.label}
          </span>
        </button>
      ))}
    </div>
  );
}
