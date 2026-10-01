import { User, SpeakingSession, UserMetrics, ComparisonMetric, WeakAreaDiagnosis } from '../types';

// Updated storage keys to completely eliminate any legacy demo users/sessions
const USERS_STORAGE_KEY = 'psa_users_v2';
const SESSIONS_STORAGE_KEY = 'psa_sessions_v2';
const CURRENT_USER_KEY = 'psa_current_user_v2';

// Clean out legacy keys if present
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('psa_users_v1');
    localStorage.removeItem('psa_sessions_v1');
    localStorage.removeItem('psa_current_user_v1');
  } catch {}
}

/**
 * Secure Password Hashing Utilities using Web Crypto API.
 * Uses a cryptographically secure 16-byte random salt and SHA-256 digest.
 * Plain-text passwords are NEVER stored in the database.
 */
async function hashPassword(password: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(`${password}:${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `$sha256$${salt}$${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    // Expected format: ['', 'sha256', salt, hashHex]
    if (parts.length !== 4 || parts[1] !== 'sha256') {
      return false;
    }
    const salt = parts[2];
    const originalHash = parts[3];
    
    const encoder = new TextEncoder();
    const data = encoder.encode(`${password}:${salt}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex === originalHash;
  } catch {
    return false;
  }
}

export class DatabaseService {
  /**
   * Retrieves all registered users from MySQL storage representation.
   * Starts with an empty database: NO DEMO USERS OR PRELOADED ACCOUNTS.
   */
  private static getUsers(): User[] {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private static saveUsers(users: User[]) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  /**
   * Retrieves speaking practice sessions.
   * When userId is supplied, STRICTLY returns only sessions belonging to that user.
   * If the database is empty, returns an empty array.
   */
  public static getSessions(userId?: number): SpeakingSession[] {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    let sessions: SpeakingSession[] = [];
    if (raw) {
      try {
        sessions = JSON.parse(raw);
      } catch {
        sessions = [];
      }
    }

    if (userId !== undefined) {
      // Strict data isolation: User A CANNOT see User B's sessions
      return sessions
        .filter(s => s.user_id === userId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return sessions;
  }

  public static saveSessions(sessions: SpeakingSession[]) {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  }

  // --- Auth Operations ---

  /**
   * Returns currently logged-in user or null.
   * NEVER automatically logs in any user on first visit.
   */
  public static getCurrentUser(): User | null {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }

  /**
   * Registers a new user.
   * Requires Name, Email, and Password.
   * Hashes password using SHA-256 with unique cryptographic salt.
   * Does NOT automatically log the user in.
   */
  public static async registerUser(
    name: string, 
    email: string, 
    password: string
  ): Promise<{ success: boolean; message: string; user?: User }> {
    const users = this.getUsers();
    const cleanEmail = email.trim().toLowerCase();

    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, message: 'An account with this email address already exists. Please log in.' };
    }

    const passwordHash = await hashPassword(password);
    const newUser: User = {
      id: Date.now(),
      name: name.trim(),
      email: cleanEmail,
      password_hash: passwordHash,
      created_at: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);
    
    // Explicitly return success without setting current user session
    return { 
      success: true, 
      message: 'Account successfully registered! Please log in with your email and password.', 
      user: newUser 
    };
  }

  /**
   * Authenticates an existing user against securely hashed credentials.
   * Establishes login session only upon successful match.
   */
  public static async loginUser(
    email: string, 
    password: string
  ): Promise<{ success: boolean; message: string; user?: User }> {
    const users = this.getUsers();
    const cleanEmail = email.trim().toLowerCase();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return { success: false, message: 'No account found with this email. Please check your credentials or register.' };
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return { success: false, message: 'Incorrect password. Please try again.' };
    }

    this.setCurrentUser(user);
    return { success: true, message: 'Authentication successful! Redirecting to Dashboard...', user };
  }

  /**
   * Logs out the user: clears login state from storage and redirects to Login.
   */
  public static logout() {
    this.setCurrentUser(null);
  }

  // --- Session Operations ---

  public static calculateOverallScore(conf: number, clar: number, vocab: number): number {
    const score = (conf + clar + vocab) / 3.0;
    return Math.round(score * 100) / 100;
  }

  /**
   * Saves a speaking session strictly tied to userId.
   * Only called when the logged-in user explicitly saves their rehearsal.
   */
  public static createSession(
    userId: number,
    topic: string,
    duration: number,
    audience: string,
    confidence: number,
    clarity: number,
    vocabulary: number,
    feedback: string,
    transcript?: string,
    duration_formatted?: string,
    weak_area?: 'Confidence' | 'Clarity' | 'Vocabulary',
    audio_url?: string
  ): { success: boolean; message: string; session?: SpeakingSession } {
    if (!userId) return { success: false, message: 'User must be authenticated to save a speaking session.' };
    if (!topic.trim()) return { success: false, message: 'Speech topic cannot be empty.' };
    if (!audience.trim()) return { success: false, message: 'Audience cannot be empty.' };
    if (duration <= 0) return { success: false, message: 'Duration must be greater than 0.' };
    if (confidence < 1 || confidence > 10) return { success: false, message: 'Confidence score must be between 1 and 10.' };
    if (clarity < 1 || clarity > 10) return { success: false, message: 'Clarity score must be between 1 and 10.' };
    if (vocabulary < 1 || vocabulary > 10) return { success: false, message: 'Vocabulary score must be between 1 and 10.' };

    const overall = this.calculateOverallScore(confidence, clarity, vocabulary);
    const sessions = this.getSessions(); // all raw sessions

    // Determine weak area if not passed
    let determinedWeak = weak_area;
    if (!determinedWeak) {
      if (confidence <= clarity && confidence <= vocabulary) determinedWeak = 'Confidence';
      else if (clarity <= confidence && clarity <= vocabulary) determinedWeak = 'Clarity';
      else determinedWeak = 'Vocabulary';
    }

    const newSession: SpeakingSession = {
      id: Date.now(),
      user_id: userId,
      topic: topic.trim(),
      duration: Math.max(0.1, Math.round(duration * 10) / 10),
      duration_formatted: duration_formatted || `${Math.round(duration)} min`,
      audience: audience.trim(),
      confidence_score: Math.round(confidence * 100) / 100,
      clarity_score: Math.round(clarity * 100) / 100,
      vocabulary_score: Math.round(vocabulary * 100) / 100,
      overall_score: overall,
      feedback: feedback.trim(),
      weak_area: determinedWeak,
      transcript: transcript?.trim(),
      audio_url,
      created_at: new Date().toISOString()
    };

    sessions.push(newSession);
    this.saveSessions(sessions);
    return { success: true, message: 'Speaking practice session saved successfully!', session: newSession };
  }

  public static deleteSession(sessionId: number, userId: number): boolean {
    const sessions = this.getSessions();
    const updated = sessions.filter(s => !(s.id === sessionId && s.user_id === userId));
    if (updated.length !== sessions.length) {
      this.saveSessions(updated);
      return true;
    }
    return false;
  }

  // --- Metrics & Analytics ---

  /**
   * Calculates dashboard statistics ONLY for the specific userId.
   * If the user has 0 sessions, returns all zeroes without any fake data.
   */
  public static calculateUserMetrics(userId: number): UserMetrics {
    const sessions = this.getSessions(userId);
    if (sessions.length === 0) {
      return {
        total_sessions: 0,
        avg_confidence: 0,
        avg_clarity: 0,
        avg_vocabulary: 0,
        avg_overall: 0,
        total_duration: 0,
      };
    }

    const total = sessions.length;
    const sumConf = sessions.reduce((acc, s) => acc + s.confidence_score, 0);
    const sumClar = sessions.reduce((acc, s) => acc + s.clarity_score, 0);
    const sumVocab = sessions.reduce((acc, s) => acc + s.vocabulary_score, 0);
    const sumOverall = sessions.reduce((acc, s) => acc + s.overall_score, 0);
    const totalDuration = sessions.reduce((acc, s) => acc + s.duration, 0);

    return {
      total_sessions: total,
      avg_confidence: Math.round((sumConf / total) * 100) / 100,
      avg_clarity: Math.round((sumClar / total) * 100) / 100,
      avg_vocabulary: Math.round((sumVocab / total) * 100) / 100,
      avg_overall: Math.round((sumOverall / total) * 100) / 100,
      total_duration: Math.round(totalDuration * 10) / 10,
    };
  }

  /**
   * Identifies weak area based on the user's sessions.
   */
  public static identifyWeakArea(metrics: UserMetrics): WeakAreaDiagnosis {
    if (metrics.total_sessions === 0) {
      return {
        weak_skill: 'Confidence',
        score: 0,
        message: 'No practice sessions recorded yet.',
        suggestions: [
          'Record your first practice session to get tailored recommendations.',
          'Speak clearly into your microphone on your chosen topic.',
          'Our AI engine will analyze your pacing, fillers, and vocabulary.'
        ],
        drills: []
      };
    }

    const scores: { skill: 'Confidence' | 'Clarity' | 'Vocabulary'; val: number }[] = [
      { skill: 'Confidence', val: metrics.avg_confidence },
      { skill: 'Clarity', val: metrics.avg_clarity },
      { skill: 'Vocabulary', val: metrics.avg_vocabulary },
    ];

    scores.sort((a, b) => a.val - b.val);
    const weakest = scores[0];

    const suggestionMap = {
      Clarity: [
        'Practice speaking at a measured pace (~130 - 150 words per minute).',
        'Record yourself on your phone and listen back to identify slurred syllables.',
        'Focus on crisp consonant articulation and clear endings of words.',
        'Practice explaining complex ideas in short, simple sentences with intentional pauses.',
        'Do 3-minute vocal warm-ups (tongue twisters) before every presentation.'
      ],
      Confidence: [
        'Maintain steady eye contact by picking 3 friendly focal points in the audience.',
        'Take 3 deep diaphragmatic breaths before taking the stage to steady your heart rate.',
        'Adopt an open posture: keep hands unclasped and avoid checking notes continuously.',
        'Rehearse your introductory 60 seconds until you can deliver it without looking down.',
        'Visualize yourself finishing the speech with applause before you begin.'
      ],
      Vocabulary: [
        'Replace vague filler words ("things", "stuff", "good") with descriptive adjectives.',
        'Study transcripts of memorable TED talks and note their rhetorical transitions.',
        'Maintain a personal speaking glossary of domain-specific terminology.',
        'Embrace deliberate silence: substitute the word "um" or "like" with a silent breath.',
        'Practice using signpost phrases: "In contrast", "Crucially", "As evidenced by".'
      ]
    };

    const drillMap = {
      Clarity: [
        { title: 'The Cork Drill', desc: 'Hold a pen or cork lightly between your front teeth and read a paragraph aloud for 2 minutes to force hyper-articulation.', icon: 'Mic' },
        { title: 'Tongue Twister Sprint', desc: 'Repeat "Red leather, yellow leather" and "She sells seashells by the seashore" with exaggerated lip movement.', icon: 'Sparkles' },
        { title: 'Pacing Metronome', desc: 'Speak to a 60 BPM metronome beat, pronouncing one distinct phrase per click to avoid rushing.', icon: 'Clock' },
      ],
      Confidence: [
        { title: 'The Power Stance', desc: 'Stand tall with feet shoulder-width apart, shoulders back, and hands resting naturally at sides for 2 minutes.', icon: 'Award' },
        { title: '3-Point Triangle Gaze', desc: 'Look at Left Room, Center Room, Right Room for 4 seconds each while explaining a single concept.', icon: 'Eye' },
        { title: 'Cold-Start Rehearsal', desc: 'Deliver your opening sentence without looking at notes, smiling warmly at an imaginary camera.', icon: 'Smile' },
      ],
      Vocabulary: [
        { title: 'Synonym Escalation', desc: 'Pick common words ("bad", "nice", "big") and force yourself to name 4 sophisticated alternatives in 10 seconds.', icon: 'BookOpen' },
        { title: 'The "Um" Penalty Jar', desc: 'Record a 2-minute impromptu monologue. Count every filler word and try to beat your personal lowest score.', icon: 'Target' },
        { title: 'Rhetorical Signposts', desc: 'Deliver a mini 1-minute speech intentionally incorporating "Consequently", "On the other hand", and "Ultimately".', icon: 'FileText' },
      ]
    };

    return {
      weak_skill: weakest.skill,
      score: weakest.val,
      message: `Your weak area is ${weakest.skill}.`,
      suggestions: suggestionMap[weakest.skill],
      drills: drillMap[weakest.skill]
    };
  }

  public static compareSessions(sessionA: SpeakingSession, sessionB: SpeakingSession): ComparisonMetric[] {
    const list: { name: string; key: keyof SpeakingSession }[] = [
      { name: 'Confidence Score', key: 'confidence_score' },
      { name: 'Clarity Score', key: 'clarity_score' },
      { name: 'Vocabulary Score', key: 'vocabulary_score' },
      { name: 'Overall Score', key: 'overall_score' },
      { name: 'Duration (mins)', key: 'duration' },
    ];

    return list.map(item => {
      const valA = Number(sessionA[item.key]) || 0;
      const valB = Number(sessionB[item.key]) || 0;
      const diff = Math.round((valB - valA) * 100) / 100;
      const pct = valA !== 0 ? Math.round(((valB - valA) / valA) * 1000) / 10 : 0;

      let status: 'Improved' | 'Decreased' | 'Remained the same' = 'Remained the same';
      if (diff > 0) status = 'Improved';
      else if (diff < 0) status = 'Decreased';

      return {
        metric: item.name,
        key: item.key as string,
        session_a_value: valA,
        session_b_value: valB,
        difference: diff,
        pct_change: pct,
        status,
      };
    });
  }

  // --- SQL Sandbox Runner for Student Demo ---
  public static executeMockSql(query: string, userId: number): { columns: string[]; rows: any[]; error?: string } {
    const q = query.trim().toUpperCase();
    const sessions = this.getSessions(userId);
    const users = this.getUsers().filter(u => u.id === userId);

    if (q.startsWith('SELECT') && q.includes('FROM SPEAKING_SESSIONS')) {
      const cols = ['id', 'user_id', 'topic', 'duration', 'confidence_score', 'clarity_score', 'vocabulary_score', 'overall_score', 'created_at'];
      const rows = sessions.map(s => [
        s.id, s.user_id, s.topic, s.duration, s.confidence_score, s.clarity_score, s.vocabulary_score, s.overall_score, s.created_at.slice(0, 10)
      ]);
      return { columns: cols, rows };
    }

    if (q.startsWith('SELECT') && q.includes('FROM USERS')) {
      const cols = ['id', 'name', 'email', 'password_hash', 'created_at'];
      const rows = users.map(u => [
        u.id, u.name, u.email, u.password_hash.slice(0, 20) + '...', u.created_at.slice(0, 10)
      ]);
      return { columns: cols, rows };
    }

    if (q.startsWith('SELECT') && (q.includes('AVG') || q.includes('COUNT'))) {
      const metrics = this.calculateUserMetrics(userId);
      const cols = ['total_sessions', 'avg_confidence', 'avg_clarity', 'avg_vocabulary', 'avg_overall'];
      const rows = [[metrics.total_sessions, metrics.avg_confidence, metrics.avg_clarity, metrics.avg_vocabulary, metrics.avg_overall]];
      return { columns: cols, rows };
    }

    // Default return user sessions
    const cols = ['id', 'topic', 'duration', 'confidence_score', 'clarity_score', 'vocabulary_score', 'overall_score'];
    const rows = sessions.map(s => [s.id, s.topic, s.duration, s.confidence_score, s.clarity_score, s.vocabulary_score, s.overall_score]);
    return { columns: cols, rows };
  }
}
