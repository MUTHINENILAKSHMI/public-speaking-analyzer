export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface SpeakingSession {
  id: number;
  user_id: number;
  topic: string;
  duration: number; // in minutes or seconds
  duration_seconds?: number; // actual duration in seconds
  duration_formatted?: string; // e.g. "2 min 35 sec"
  audience: string;
  confidence_score: number; // 1.0 - 10.0 (Estimated)
  clarity_score: number;    // 1.0 - 10.0 (Estimated)
  vocabulary_score: number; // 1.0 - 10.0 (Calculated)
  overall_score: number;    // (confidence + clarity + vocabulary) / 3
  feedback: string;
  weak_area?: 'Confidence' | 'Clarity' | 'Vocabulary';
  transcript?: string;
  audio_url?: string;
  created_at: string;
}

export interface UserMetrics {
  total_sessions: number;
  avg_confidence: number;
  avg_clarity: number;
  avg_vocabulary: number;
  avg_overall: number;
  total_duration: number;
}

export interface ComparisonMetric {
  metric: string;
  key: string;
  session_a_value: number;
  session_b_value: number;
  difference: number;
  pct_change: number;
  status: 'Improved' | 'Decreased' | 'Remained the same';
}

export interface WeakAreaDiagnosis {
  weak_skill: 'Confidence' | 'Clarity' | 'Vocabulary';
  score: number;
  message: string;
  suggestions: string[];
  drills: { title: string; desc: string; icon: string }[];
}

export interface SpeechAnalysis {
  source: string;
  clarity_feedback: string;
  vocabulary_feedback: string;
  grammar_feedback: string;
  word_count: number;
  unique_ratio: number;
  filler_words: { word: string; count: number }[];
  repeated_words: { word: string; count: number }[];
  possible_improvements: string[];
  overall_suggestions: string;
  ai_raw?: string;
}

export type PageName = 
  | 'Dashboard'
  | 'New Practice Session'
  | 'My Sessions'
  | 'Compare Sessions'
  | 'Identify Weak Areas'
  | 'AI Speech Feedback'
  | 'Profile'
  | 'Project Code & SQL';
