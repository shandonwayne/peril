import { Sword, Eye } from 'lucide-react';

interface ModeToggleProps {
  isEditMode: boolean;
  onToggle: () => void;
}

export function ModeToggle({ isEditMode, onToggle }: ModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 text-stone-600 hover:text-stone-500 transition-colors duration-200 cursor-pointer bg-transparent border-none outline-none"
      style={{ fontSize: '11px', letterSpacing: '0.05em' }}
    >
      {isEditMode ? (
        <>
          <Eye size={10} />
          <span>game mode</span>
        </>
      ) : (
        <>
          <Sword size={10} />
          <span>edit mode</span>
        </>
      )}
    </button>
  );
}
