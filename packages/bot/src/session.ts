export interface SessionData {
  userId?: string;
  state: 'idle' | 'awaiting_front' | 'awaiting_back' | 'awaiting_info' | 'awaiting_wallet' | 'awaiting_vote' | 'awaiting_suggestion';
  pendingSubmissionId?: string;
  currentBookmarkId?: string;
  missingFields?: string[];
  currentField?: string;
  tempData?: Record<string, unknown>;
}

export function getInitialSessionData(): SessionData {
  return {
    state: 'idle',
  };
}
