
export enum Sentiment {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  IMPROVEMENT = 'improvement'
}

export type Severity = 'minor' | 'moderate' | 'significant';

export interface FeedbackMessage {
  id: string;
  category: string;
  subcategory?: string;
  message: string;
  sentiment: Sentiment;
  severity?: Severity;
  timestamp: number;
}

export interface TranscriptionEntry {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface InterviewState {
  isActive: boolean;
  isPaused: boolean;
  feedbacks: FeedbackMessage[];
  transcriptions: TranscriptionEntry[];
  currentQuestionCount: number;
}
