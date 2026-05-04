import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ytwhznzzymvyeiixwxuv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0d2h6bnp6eW12eWVpaXh3eHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTQ5MTIsImV4cCI6MjA5MTg5MDkxMn0.A13yvWrQnWYDR0jaUyHMd8HpBnljGsqk3HbKxvDxyCE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Board {
  id: string;
  title: string;
  board_code: string;
  created_at: string;
}

export interface Category {
  id: string;
  board_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface Question {
  id: string;
  category_id: string;
  point_value: number;
  question_text: string;
  answer_text: string;
  is_answered: boolean;
  is_daily_double: boolean;
  image_url: string | null;
  created_at: string;
}

export interface GameSession {
  id: string;
  board_id: string;
  join_code: string;
  is_active: boolean;
  buzzer_open: boolean;
  buzzer_question_id: string | null;
  daily_double_player_id: string | null;
  daily_double_wager: number | null;
  daily_double_max_wager: number | null;
  created_at: string;
}

export interface BuzzerEvent {
  id: string;
  session_id: string;
  player_id: string;
  question_id: string;
  buzzed_at: string;
  status: 'pending' | 'correct' | 'incorrect';
}

export interface Player {
  id: string;
  session_id: string;
  name: string;
  score: number;
  avatar_id: number;
  device_token: string;
  created_at: string;
}

export function generateJoinCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) code += digits[Math.floor(Math.random() * digits.length)];
  return code;
}

export function generateBoardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function generateDeviceToken(): string {
  return crypto.randomUUID();
}
