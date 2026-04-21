import { useState, useRef } from 'react';
import { X, ImagePlus, Trash2 } from 'lucide-react';
import { Question, supabase } from '../lib/supabase';
import { DSFrame } from './DSFrame';

const FONT = "'Germania One', serif";

interface EditQuestionModalProps {
  question: Question;
  categoryName: string;
  onClose: () => void;
  onSave: (id: string, questionText: string, answerText: string, isDailyDouble: boolean, imageUrl: string | null) => Promise<void>;
}

export function EditQuestionModal({ question, categoryName, onClose, onSave }: EditQuestionModalProps) {
  const [questionText, setQuestionText] = useState(question.question_text);
  const [answerText, setAnswerText] = useState(question.answer_text);
  const [isDailyDouble, setIsDailyDouble] = useState(question.is_daily_double);
  const [imageUrl, setImageUrl] = useState<string | null>(question.image_url ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = previewUrl ?? imageUrl;

  const handleImageUpload = async (file: File) => {
    const local = URL.createObjectURL(file);
    setPreviewUrl(local);
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${question.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('question-images').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('question-images').getPublicUrl(path);
      setImageUrl(data.publicUrl);
    }
    URL.revokeObjectURL(local);
    setPreviewUrl(null);
    setUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(question.id, questionText, answerText, isDailyDouble, imageUrl);
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
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

        <div className="flex items-center gap-3">
          <div
            className="text-stone-500 tracking-widest uppercase"
            style={{ fontFamily: FONT, fontSize: '19px' }}
          >
            {categoryName}
          </div>
          <span className="text-stone-700">·</span>
          <div
            className="text-amber-700 tracking-widest"
            style={{ fontFamily: FONT, fontSize: '19px' }}
          >
            {question.point_value} pts
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-stone-500 tracking-widest uppercase"
            style={{ fontFamily: FONT, fontSize: '18px' }}
          >
            Question
          </label>
          <textarea
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            rows={3}
            className="w-full bg-transparent border border-stone-700 text-stone-300 p-3 resize-none focus:outline-none focus:border-stone-500 transition-colors"
            style={{ fontFamily: FONT, fontSize: '20px', lineHeight: '1.8' }}
            placeholder="Enter question..."
          />
          {displayUrl ? (
            <div className="relative group w-full mt-1">
              <img
                src={displayUrl}
                alt="Question"
                className="w-full object-contain border border-stone-700"
                style={{ maxHeight: '220px', opacity: uploading ? 0.6 : 1, transition: 'opacity 0.2s' }}
              />
              {uploading && (
                <div
                  className="absolute inset-0 flex items-center justify-center text-stone-400 tracking-widest"
                  style={{ fontFamily: FONT, fontSize: '16px', backgroundColor: 'rgba(0,0,0,0.4)' }}
                >
                  Uploading...
                </div>
              )}
              {!uploading && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 border border-stone-700 text-stone-400 hover:text-red-400 hover:border-red-800 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-3 w-full border border-dashed border-stone-700 hover:border-stone-500 text-stone-600 hover:text-stone-400 transition-all disabled:opacity-40 mt-1"
              style={{ fontFamily: FONT, fontSize: '18px', height: '72px' }}
            >
              <ImagePlus size={18} />
              Upload Image
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-stone-500 tracking-widest uppercase"
            style={{ fontFamily: FONT, fontSize: '18px' }}
          >
            Answer
          </label>
          <textarea
            value={answerText}
            onChange={e => setAnswerText(e.target.value)}
            rows={3}
            className="w-full bg-transparent border border-stone-700 text-stone-300 p-3 resize-none focus:outline-none focus:border-stone-500 transition-colors"
            style={{ fontFamily: FONT, fontSize: '20px', lineHeight: '1.8' }}
            placeholder="Enter answer..."
          />
        </div>

        <button
          type="button"
          onClick={() => setIsDailyDouble(v => !v)}
          className="flex items-center gap-3 self-start group"
        >
          <div
            className="relative flex items-center justify-center transition-all duration-200"
            style={{
              width: '40px',
              height: '22px',
              borderRadius: '11px',
              backgroundColor: isDailyDouble ? 'rgba(180,120,40,0.35)' : 'rgba(255,255,255,0.05)',
              border: isDailyDouble ? '1px solid rgba(180,120,40,0.7)' : '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div
              className="absolute transition-all duration-200"
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '7px',
                backgroundColor: isDailyDouble ? '#c97d28' : '#4a4540',
                left: isDailyDouble ? '22px' : '3px',
                top: '3px',
              }}
            />
          </div>
          <span
            className="tracking-widest uppercase transition-colors duration-200"
            style={{
              fontFamily: FONT,
              fontSize: '18px',
              color: isDailyDouble ? '#c97d28' : '#6b6055',
            }}
          >
            Daily Double
          </span>
        </button>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-500 transition-all"
            style={{ fontFamily: FONT, fontSize: '18px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="px-5 py-2 border border-amber-800 text-amber-600 hover:text-amber-300 hover:border-amber-500 transition-all disabled:opacity-40"
            style={{ fontFamily: FONT, fontSize: '18px' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </DSFrame>
    </div>
  );
}
