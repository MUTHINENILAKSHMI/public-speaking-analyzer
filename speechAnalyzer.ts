import { GoogleGenAI } from '@google/genai';

export interface AudioSpeechFeatures {
  durationSeconds: number;
  durationFormatted: string; // e.g. "2 min 35 sec"
  wordCount: number;
  wordsPerMinute: number;
  hesitationCount: number;
  hesitationDensityPct: number;
  pauseCount: number;
  uniqueWordRatioPct: number;
  avgSentenceLength: number;
  sophisticatedWords: string[];
  detectedFillers: { word: string; count: number }[];
  detectedTopic: string;
  confidenceScore: number; // 1.0 - 10.0 (Estimated)
  clarityScore: number;    // 1.0 - 10.0 (Estimated)
  vocabularyScore: number; // 1.0 - 10.0 (Calculated)
  overallScore: number;    // (confidence + clarity + vocabulary) / 3
  feedback: string;
  weakArea: 'Confidence' | 'Clarity' | 'Vocabulary';
  detailedInsights: {
    confidenceNote: string;
    clarityNote: string;
    vocabularyNote: string;
  };
}

// Common filler crutches indicating vocal hesitation
const FILLER_WORDS = [
  'um', 'uh', 'er', 'ah', 'like', 'you know', 'basically', 'actually', 
  'literally', 'sort of', 'kind of', 'i mean', 'right'
];

// High-level academic / rhetorical signpost words that boost vocabulary score
const SOPHISTICATED_WORDS = new Set([
  'consequently', 'furthermore', 'moreover', 'nevertheless', 'specifically',
  'demonstrates', 'illustrates', 'fundamental', 'crucial', 'perspective',
  'substantial', 'significant', 'hypothesis', 'infrastructure', 'innovative',
  'framework', 'comprehensive', 'paradigm', 'catalyst', 'exponential',
  'inevitable', 'sustainability', 'articulate', 'empowerment', 'trajectory',
  'quintessential', 'methodology', 'implications', 'resilience', 'ecosystem',
  'phenomenon', 'transformative', 'adversity', 'equilibrium', 'collaboration',
  'strategic', 'synergy', 'efficiency', 'imperative', 'advocacy', 'analytical'
]);

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 
  'is', 'was', 'are', 'were', 'it', 'that', 'this', 'these', 'those', 'i', 'you', 
  'he', 'she', 'we', 'they', 'of', 'be', 'as', 'by', 'have', 'has', 'had', 'do', 
  'does', 'did', 'so', 'if', 'my', 'your', 'our', 'their', 'from', 'about', 'can', 
  'could', 'would', 'should', 'will', 'just', 'not', 'very', 'all', 'any', 'me', 'us'
]);

/**
 * Automatically format seconds into "X minutes Y seconds" or "X min Y sec"
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${secs} seconds`;
  }
  if (secs === 0) {
    return `${mins} minute${mins > 1 ? 's' : ''}`;
  }
  return `${mins} minute${mins > 1 ? 's' : ''} ${secs} second${secs > 1 ? 's' : ''}`;
}

/**
 * Intelligent topic detection from transcript using NLP frequency,
 * title patterns, and introductory phrase parsing.
 */
export function detectSpeechTopic(transcript: string): string {
  const clean = transcript.trim();
  if (!clean) return 'General Speech';

  // 1. Check for explicit opening patterns:
  // "today i am talking about...", "my topic is...", "i will discuss..."
  const introPatterns = [
    /(?:today\s+(?:i\s+want\s+to\s+talk\s+about|i'm\s+talking\s+about|we\s+will\s+discuss|i\s+will\s+share))\s+([a-z0-9\s]{3,40}?)(?=[.,;!?]|\b(?:because|which|and|so)\b)/i,
    /(?:my\s+(?:topic|speech|presentation|talk)\s+is\s+(?:about|on))\s+([a-z0-9\s]{3,40}?)(?=[.,;!?]|\b(?:because|which|and|so)\b)/i,
    /(?:let's\s+(?:talk|discuss|explore|dive\s+into))\s+([a-z0-9\s]{3,40}?)(?=[.,;!?]|\b(?:because|which|and|so)\b)/i,
    /(?:the\s+future\s+of|the\s+power\s+of|the\s+importance\s+of)\s+([a-z0-9\s]{3,40}?)(?=[.,;!?]|\b(?:is|will|has)\b)/i,
  ];

  for (const pattern of introPatterns) {
    const match = clean.match(pattern);
    if (match && match[1] && match[1].trim().length > 3) {
      const candidate = match[1].trim();
      return capitalizeTitle(candidate);
    }
  }

  // 2. Domain keyword matching
  const domainKeywords: Record<string, string[]> = {
    'Artificial Intelligence': ['artificial', 'intelligence', 'ai', 'machine', 'learning', 'neural', 'algorithms', 'deep learning', 'chatgpt', 'automation'],
    'Climate Change & Sustainability': ['climate', 'change', 'carbon', 'emissions', 'renewable', 'solar', 'global warming', 'planet', 'sustainable', 'green energy'],
    'Public Speaking & Leadership': ['leadership', 'public speaking', 'leader', 'communication', 'teamwork', 'inspire', 'confidence', 'audience', 'stage'],
    'Healthcare & Medical Innovation': ['healthcare', 'medicine', 'health', 'patients', 'doctors', 'disease', 'vaccine', 'medical', 'hospital', 'wellness'],
    'Mental Health Awareness': ['mental', 'health', 'anxiety', 'stress', 'mindfulness', 'depression', 'therapy', 'wellbeing', 'psychology'],
    'Cybersecurity & Digital Privacy': ['cybersecurity', 'security', 'privacy', 'data', 'hacker', 'encryption', 'password', 'online safety'],
    'Education & Future of Learning': ['education', 'students', 'learning', 'schools', 'teachers', 'university', 'curriculum', 'classroom'],
    'Space Exploration & Astronomy': ['space', 'mars', 'nasa', 'astronomy', 'rocket', 'cosmos', 'orbit', 'galaxy', 'universe'],
    'Entrepreneurship & Startups': ['startup', 'business', 'entrepreneur', 'market', 'pitch', 'investment', 'product', 'customer', 'revenue'],
    'Clean Water & Global Resources': ['water', 'resources', 'scarcity', 'conservation', 'ocean', 'pollution', 'environment']
  };

  const lower = clean.toLowerCase();
  let bestDomain = '';
  let highestScore = 0;

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    let score = 0;
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    if (score > highestScore && score >= 2) {
      highestScore = score;
      bestDomain = domain;
    }
  }

  if (bestDomain) {
    return bestDomain;
  }

  // 3. Fallback: Extract most prominent non-stop words
  const words = clean.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (!STOP_WORDS.has(w) && !FILLER_WORDS.includes(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }

  const sortedKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => capitalizeTitle(w));

  if (sortedKeywords.length > 0) {
    return sortedKeywords.slice(0, 2).join(' & ');
  }

  return 'Public Presentation Practice';
}

function capitalizeTitle(str: string): string {
  return str
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Core Speech & Audio Feature Analyzer
 * Automatically derives:
 * - Topic (detected from speech transcript)
 * - Duration (from recording timer start/stop)
 * - Confidence Score (Estimated based on hesitations, pauses, pacing)
 * - Clarity Score (Estimated using pacing, speech rhythm, sentence structure)
 * - Vocabulary Score (Calculated from lexical diversity, word sophistication, filler density)
 * - Overall Score = (Confidence + Clarity + Vocabulary) / 3
 * - Feedback & Weak Area
 */
export function analyzeSpeechAutomatically(
  transcript: string,
  durationSeconds: number,
  measuredPauses: number = 0,
  manualTopic?: string
): AudioSpeechFeatures {
  const durationSec = Math.max(1, Math.round(durationSeconds));
  const durationFormatted = formatDuration(durationSec);
  const clean = transcript.trim();

  // Words breakdown
  const words = clean.toLowerCase().match(/\b[a-z']+\b/g) || [];
  const wordCount = words.length;

  // Words per minute (WPM)
  const durationMinutes = durationSec / 60;
  const wordsPerMinute = durationMinutes > 0 ? Math.round(wordCount / durationMinutes) : 0;

  // 1. Detect filler words & vocal hesitations
  const lower = clean.toLowerCase();
  const detectedFillers: { word: string; count: number }[] = [];
  let totalHesitations = 0;

  for (const filler of FILLER_WORDS) {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      detectedFillers.push({ word: filler, count: matches.length });
      totalHesitations += matches.length;
    }
  }

  // Hesitation density (% of spoken words that are fillers)
  const hesitationDensityPct = wordCount > 0 
    ? Math.round((totalHesitations / wordCount) * 1000) / 10 
    : 0;

  // 2. Lexical diversity (Type-Token Ratio)
  const uniqueWords = new Set(words);
  const uniqueWordRatioPct = wordCount > 0 
    ? Math.round((uniqueWords.size / wordCount) * 100) 
    : 0;

  // 3. Sophisticated vocabulary detection
  const detectedSophisticated: string[] = [];
  for (const w of words) {
    if (SOPHISTICATED_WORDS.has(w) && !detectedSophisticated.includes(w)) {
      detectedSophisticated.push(w);
    }
  }

  // 4. Sentence structure & clarity indicators
  const sentences = clean.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const avgSentenceLength = Math.round((wordCount / sentenceCount) * 10) / 10;

  // 5. Estimated pause count (if not passed from audio silence detector, infer from pauses/sentences)
  const estimatedPauses = measuredPauses > 0 
    ? measuredPauses 
    : Math.max(0, sentenceCount - 1 + Math.round(totalHesitations * 0.7));

  // =========================================================================
  // SCORING ALGORITHMS (Scale: 1.0 to 10.0, rounded to 1 decimal place)
  // =========================================================================

  // A. CONFIDENCE SCORE (Estimated from observable hesitations, pauses, pacing)
  // "Presented as an ESTIMATED confidence score based on observable speech characteristics
  // such as hesitation, pauses and speaking patterns. Do not claim direct internal measurement."
  let confBase = 8.5;

  // Deduct for excessive filler crutches
  if (hesitationDensityPct > 8.0) {
    confBase -= 2.2;
  } else if (hesitationDensityPct > 4.5) {
    confBase -= 1.4;
  } else if (hesitationDensityPct > 2.0) {
    confBase -= 0.6;
  } else if (totalHesitations === 0 && wordCount > 30) {
    confBase += 0.5; // fluent, uninterrupted delivery
  }

  // Deduct for awkward pauses / hesitation stops per minute
  const pausesPerMinute = durationMinutes > 0 ? estimatedPauses / durationMinutes : 0;
  if (pausesPerMinute > 12) {
    confBase -= 1.0;
  } else if (pausesPerMinute < 2 && wordCount > 40) {
    confBase -= 0.4; // rushed without breath pauses
  }

  // Deduct for sluggish pacing (<90 WPM) or extreme racing (>185 WPM)
  if (wordsPerMinute > 0) {
    if (wordsPerMinute < 95) {
      confBase -= 1.0; // hesitant, halting delivery
    } else if (wordsPerMinute > 185) {
      confBase -= 0.8; // nervous rapid speech
    } else if (wordsPerMinute >= 120 && wordsPerMinute <= 155) {
      confBase += 0.4; // composed, steady delivery pace
    }
  }

  const confidenceScore = Math.min(9.8, Math.max(4.0, Math.round(confBase * 10) / 10));

  // B. CLARITY SCORE (Estimated using pacing, speech rhythm, sentence structure)
  let clarBase = 8.4;

  // Pacing clarity impact
  if (wordsPerMinute > 0) {
    if (wordsPerMinute >= 120 && wordsPerMinute <= 155) {
      clarBase += 0.5; // ideal public speaking cadence
    } else if (wordsPerMinute > 180) {
      clarBase -= 1.6; // too fast for audience retention
    } else if (wordsPerMinute < 100) {
      clarBase -= 1.2; // slow cadence may cause audience distraction
    }
  }

  // Sentence length balance (12-22 words per sentence is ideal for spoken presentations)
  if (avgSentenceLength > 26) {
    clarBase -= 1.2; // complex run-ons
  } else if (avgSentenceLength < 7 && wordCount > 25) {
    clarBase -= 0.8; // overly choppy fragments
  } else if (avgSentenceLength >= 11 && avgSentenceLength <= 20) {
    clarBase += 0.4; // punchy and accessible
  }

  // Cluttered fillers reduce intelligibility
  if (hesitationDensityPct > 5.0) {
    clarBase -= 0.8;
  }

  const clarityScore = Math.min(9.8, Math.max(4.0, Math.round(clarBase * 10) / 10));

  // C. VOCABULARY SCORE (Calculated automatically from measurable text features)
  let vocabBase = 6.8;

  // Lexical diversity (Type-Token Ratio)
  if (uniqueWordRatioPct >= 65) {
    vocabBase += 1.8;
  } else if (uniqueWordRatioPct >= 50) {
    vocabBase += 1.0;
  } else if (uniqueWordRatioPct < 35 && wordCount > 20) {
    vocabBase -= 1.5;
  }

  // Sophisticated / rhetorical signpost words
  if (detectedSophisticated.length >= 4) {
    vocabBase += 1.4;
  } else if (detectedSophisticated.length >= 2) {
    vocabBase += 0.8;
  } else if (detectedSophisticated.length === 1) {
    vocabBase += 0.4;
  }

  // Penalty for overusing fillers as replacement vocabulary
  if (detectedFillers.length >= 3) {
    vocabBase -= 0.6;
  }

  const vocabularyScore = Math.min(9.8, Math.max(4.0, Math.round(vocabBase * 10) / 10));

  // D. OVERALL SCORE = (Confidence + Clarity + Vocabulary) / 3
  const overallScore = Math.round(((confidenceScore + clarityScore + vocabularyScore) / 3) * 100) / 100;

  // E. IDENTIFY WEAK AREA (lowest of the three)
  const skills: { name: 'Confidence' | 'Clarity' | 'Vocabulary'; score: number }[] = [
    { name: 'Confidence', score: confidenceScore },
    { name: 'Clarity', score: clarityScore },
    { name: 'Vocabulary', score: vocabularyScore }
  ];
  skills.sort((a, b) => a.score - b.score);
  const weakArea = skills[0].name;

  // F. AUTOMATIC FEEDBACK GENERATION (Simple, General, Student-Friendly 4 Sections)
  const detectedTopic = manualTopic && manualTopic.trim().length > 0 
    ? manualTopic.trim() 
    : detectSpeechTopic(clean);

  const feedback = generateStudentFriendlyFeedback(
    confidenceScore,
    clarityScore,
    vocabularyScore,
    overallScore,
    weakArea,
    totalHesitations,
    durationSec,
    wordsPerMinute,
    detectedTopic
  );

  const detailedInsights = {
    confidenceNote: `Estimated ${confidenceScore}/10 based on hesitation frequency (${totalHesitations} fillers) and speaking flow.`,
    clarityNote: `Estimated ${clarityScore}/10 reflecting ~${wordsPerMinute} WPM pace and average sentence length of ${avgSentenceLength} words.`,
    vocabularyNote: `Calculated ${vocabularyScore}/10 measuring ${uniqueWordRatioPct}% lexical variety and ${detectedSophisticated.length} advanced keywords.`
  };

  return {
    durationSeconds: durationSec,
    durationFormatted,
    wordCount,
    wordsPerMinute,
    hesitationCount: totalHesitations,
    hesitationDensityPct,
    pauseCount: estimatedPauses,
    uniqueWordRatioPct,
    avgSentenceLength,
    sophisticatedWords: detectedSophisticated,
    detectedFillers,
    detectedTopic,
    confidenceScore,
    clarityScore,
    vocabularyScore,
    overallScore,
    feedback,
    weakArea,
    detailedInsights
  };
}

/**
 * Generates simple, general and student-friendly feedback with 4 standard sections:
 * 1. Overall Feedback
 * 2. Strengths
 * 3. Areas to Improve
 * 4. Suggestion
 * Based on the automatically calculated Confidence, Clarity and Vocabulary scores.
 */
export function generateStudentFriendlyFeedback(
  confidenceScore: number,
  clarityScore: number,
  vocabularyScore: number,
  overallScore: number,
  weakArea: 'Confidence' | 'Clarity' | 'Vocabulary',
  hesitationCount: number = 0,
  durationSeconds: number = 60,
  wpm: number = 130,
  topic: string = 'General Speech'
): string {
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const durationFormatted = mins === 0 ? `${secs} sec` : (secs === 0 ? `${mins} min` : `${mins} min ${secs} sec`);

  // 1. Dynamic Overall Feedback (Reflecting actual performance, scores, and duration)
  const sentences: string[] = [];

  if (overallScore >= 8.5) {
    sentences.push(`Outstanding delivery throughout your ${durationFormatted} presentation on '${topic}'. Your ideas were compelling and well structured.`);
  } else if (overallScore >= 7.5) {
    sentences.push(`Solid practice performance on '${topic}' lasting ${durationFormatted}. Your core message was clear and effectively communicated.`);
  } else if (overallScore >= 6.0) {
    sentences.push(`Good practice effort on '${topic}' across ${durationFormatted}. Your presentation showed genuine effort and understandable thoughts.`);
  } else {
    sentences.push(`Promising rehearsal attempt on '${topic}' (${durationFormatted}). Consistent practice will help you build steadiness and fluency.`);
  }

  // Score-driven specific observations
  if (confidenceScore < 7.0) {
    sentences.push('Your confidence can be improved. Try practicing in short sessions and gradually increase your speaking duration.');
  } else if (confidenceScore >= 8.5) {
    sentences.push('You exhibited strong self-assurance and an authoritative speaking presence.');
  }

  if (clarityScore < 7.0) {
    sentences.push('Your ideas are understandable, but your speech clarity needs improvement. Try speaking slightly slower and pronounce words clearly.');
  } else if (clarityScore >= 8.5) {
    sentences.push('Your vocal articulation was exceptionally crisp, making each point effortless to follow.');
  }

  if (vocabularyScore >= 7.5) {
    sentences.push('You used a good range of vocabulary in this session.');
  } else if (vocabularyScore < 6.0) {
    sentences.push('Consider incorporating more varied vocabulary and descriptive language.');
  }

  if (hesitationCount >= 3) {
    sentences.push("Try reducing filler words such as 'um', 'uh', 'like', and 'actually'.");
  }

  if (durationSeconds < 40) {
    sentences.push('Try developing your ideas further and practice speaking for a longer duration.');
  }

  const overall = sentences.join(' ');

  // 2. Strengths (Bullet points based on scores)
  const strengths: string[] = [];
  if (confidenceScore >= 7.0) {
    strengths.push('- Good confidence while speaking.');
  }
  if (clarityScore >= 7.0) {
    strengths.push('- Ideas were easy to understand.');
  }
  if (vocabularyScore >= 7.0) {
    strengths.push('- Good vocabulary usage.');
  }

  // Ensure at least 2 clear strengths
  if (strengths.length === 0) {
    if (confidenceScore >= clarityScore && confidenceScore >= vocabularyScore) {
      strengths.push('- Good confidence while speaking.');
      strengths.push('- Ideas were easy to understand.');
    } else if (clarityScore >= confidenceScore && clarityScore >= vocabularyScore) {
      strengths.push('- Ideas were easy to understand.');
      strengths.push('- Kept a steady pace while speaking.');
    } else {
      strengths.push('- Good vocabulary usage.');
      strengths.push('- Ideas were easy to understand.');
    }
  } else if (strengths.length === 1) {
    if (!strengths.includes('- Ideas were easy to understand.')) {
      strengths.push('- Ideas were easy to understand.');
    } else if (!strengths.includes('- Good confidence while speaking.')) {
      strengths.push('- Good confidence while speaking.');
    } else {
      strengths.push('- Good vocabulary usage.');
    }
  }

  // 3. Areas to Improve (Bullet points based on lower scores & weak area)
  const areasToImprove: string[] = [];
  if (weakArea === 'Clarity' || clarityScore < 7.5) {
    areasToImprove.push('- Improve speech clarity.');
  }
  if (weakArea === 'Confidence' || confidenceScore < 7.5) {
    if (hesitationCount > 0) {
      areasToImprove.push('- Reduce unnecessary pauses and filler words.');
    } else {
      areasToImprove.push('- Work on maintaining a steady speaking flow.');
    }
  }
  if (weakArea === 'Vocabulary' || vocabularyScore < 7.5) {
    areasToImprove.push('- Try using more varied vocabulary.');
  }

  // Ensure 2-3 items in Areas to Improve
  if (areasToImprove.length === 0) {
    areasToImprove.push('- Improve speech clarity.');
    areasToImprove.push('- Try using more varied vocabulary.');
  } else if (areasToImprove.length === 1) {
    if (weakArea === 'Confidence') {
      areasToImprove.push('- Reduce unnecessary pauses and filler words.');
    } else if (weakArea === 'Clarity') {
      areasToImprove.push('- Maintain a steady speaking pace.');
    } else {
      areasToImprove.push('- Try using more varied vocabulary.');
    }
  }

  // 4. Suggestion (Short, student-friendly 1-sentence tip)
  let suggestion = 'Practice speaking regularly and record yourself to track your improvement.';
  if (weakArea === 'Confidence') {
    suggestion = 'Practice speaking regularly and record yourself to track your improvement and build confidence.';
  } else if (weakArea === 'Clarity') {
    suggestion = 'Practice speaking at a relaxed pace and pause briefly between key thoughts to improve clarity.';
  } else if (weakArea === 'Vocabulary') {
    suggestion = 'Practice using new words in your daily conversations to expand your speaking vocabulary.';
  }

  return `Overall Feedback:
${overall}

Strengths:
${strengths.join('\n')}

Areas to Improve:
${areasToImprove.join('\n')}

Suggestion:
${suggestion}`;
}

/**
 * Optional Gemini AI enhancer if API key is active.
 * Refines the topic name while maintaining the exact 4-section student-friendly feedback.
 */
export async function enhanceSpeechAnalysisWithGemini(
  base: AudioSpeechFeatures,
  transcript: string,
  apiKey?: string
): Promise<AudioSpeechFeatures> {
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).__GEMINI_KEY__ || apiKey;
  if (!envKey || !transcript.trim() || transcript.trim().length < 20) {
    return base;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: envKey });
    const prompt = `
You are an evaluator in an educational Public Speaking Analyzer.
Analyze this short speech:
"${transcript.trim()}"

Topic: "${base.detectedTopic}"
Confidence Score: ${base.confidenceScore}/10
Clarity Score: ${base.clarityScore}/10
Vocabulary Score: ${base.vocabularyScore}/10
Weak Area: ${base.weakArea}

Provide student-friendly feedback in pure JSON matching this exact structure:
{
  "topic": "Concise 2 to 5 word topic title",
  "overall_feedback": "1-2 short, simple sentences summarizing the speech generally without mental health claims",
  "strengths": ["Short strength bullet 1", "Short strength bullet 2", "Short strength bullet 3"],
  "areas_to_improve": ["Short improvement bullet 1", "Short improvement bullet 2", "Short improvement bullet 3"],
  "suggestion": "1 short, simple sentence with an actionable practice tip"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    if (response?.text) {
      const parsed = JSON.parse(response.text);
      if (parsed.overall_feedback && Array.isArray(parsed.strengths) && Array.isArray(parsed.areas_to_improve) && parsed.suggestion) {
        const formattedGeminiFeedback = `Overall Feedback:\n${parsed.overall_feedback}\n\nStrengths:\n${parsed.strengths.map((s: string) => s.startsWith('-') ? s : `- ${s}`).join('\n')}\n\nAreas to Improve:\n${parsed.areas_to_improve.map((a: string) => a.startsWith('-') ? a : `- ${a}`).join('\n')}\n\nSuggestion:\n${parsed.suggestion}`;
        return {
          ...base,
          detectedTopic: base.detectedTopic && base.detectedTopic !== 'General Speech' && base.detectedTopic !== 'Public Presentation Practice' ? base.detectedTopic : (parsed.topic?.trim() || base.detectedTopic),
          feedback: formattedGeminiFeedback
        };
      }
    }
  } catch (err) {
    console.warn('Gemini enhancement note:', err);
  }

  return base;
}
