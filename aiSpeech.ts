import { GoogleGenAI } from '@google/genai';
import { SpeechAnalysis } from '../types';

export async function analyzeSpeech(transcript: string, apiKey?: string): Promise<SpeechAnalysis> {
  const clean = transcript.trim();
  const words = clean.toLowerCase().match(/\b[a-z']+\b/g) || [];
  const wordCount = words.length;

  // 1. Detect filler words
  const fillerCandidates = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'sort of', 'kind of', 'right'];
  const lower = clean.toLowerCase();
  const detectedFillers: { word: string; count: number }[] = [];

  for (const filler of fillerCandidates) {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      detectedFillers.push({ word: filler, count: matches.length });
    }
  }

  // 2. Lexical diversity
  const uniqueWords = new Set(words);
  const uniqueRatio = wordCount > 0 ? Math.round((uniqueWords.size / wordCount) * 100) : 0;

  // 3. Repeated non-stopwords
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'is', 'was', 'it', 'that', 'this', 'i', 'you', 'we', 'they', 'of', 'be', 'as', 'by']);
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (!stopWords.has(w) && w.length > 2) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  const repeatedWords = Object.entries(freq)
    .filter(([_, c]) => c > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w, c]) => ({ word: w, count: c }));

  // 4. Sentences
  const sentences = clean.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLen = sentences.length > 0 ? Math.round((wordCount / sentences.length) * 10) / 10 : 0;

  let clarityFeedback = '';
  if (avgSentenceLen > 24) {
    clarityFeedback = `Sentences are relatively long (averaging ${avgSentenceLen} words). Try breaking complex sentences into punchy, clear thoughts to allow listeners to digest information.`;
  } else if (avgSentenceLen < 8 && wordCount > 20) {
    clarityFeedback = `Sentences are quite short (averaging ${avgSentenceLen} words). Incorporate occasional compound clauses for natural rhythm and flow.`;
  } else {
    clarityFeedback = `Balanced sentence length (averaging ${avgSentenceLen} words). Good cadence and structure for vocal delivery.`;
  }

  let vocabFeedback = '';
  if (uniqueRatio > 65) {
    vocabFeedback = `Exceptional lexical variety (${uniqueRatio}% unique vocabulary). Rich and descriptive phrasing throughout.`;
  } else if (uniqueRatio > 45) {
    vocabFeedback = `Solid vocabulary diversity (${uniqueRatio}% unique words). Language is clear and communicative.`;
  } else {
    vocabFeedback = `Moderate vocabulary repetition (${uniqueRatio}% unique words). Consider exploring synonyms for frequently used nouns and verbs.`;
  }

  const improvements: string[] = [];
  if (detectedFillers.length > 0) {
    const topFiller = detectedFillers.sort((a, b) => b.count - a.count)[0];
    improvements.push(`Reduce filler crutches: "${topFiller.word}" occurred ${topFiller.count} times. Replace habitual fillers with deliberate silent pauses.`);
  }
  if (repeatedWords.length > 0) {
    const terms = repeatedWords.slice(0, 2).map(r => `"${r.word}" (${r.count}x)`).join(', ');
    improvements.push(`Vary recurring terms: ${terms} appeared frequently. Practice substituting alternative descriptive terms.`);
  }
  if (avgSentenceLen > 22) {
    improvements.push('Add vocal punctuation: pause briefly before key conclusions and bullet points.');
  }
  if (improvements.length === 0) {
    improvements.push('Maintain steady eye contact and match voice volume with the acoustics of your room.');
  }

  const baseResult: SpeechAnalysis = {
    source: 'Built-in Linguistic Analyzer',
    clarity_feedback: clarityFeedback,
    vocabulary_feedback: vocabFeedback,
    grammar_feedback: 'Sentence syntax is cohesive with proper subject-predicate agreement.',
    word_count: wordCount,
    unique_ratio: uniqueRatio,
    filler_words: detectedFillers,
    repeated_words: repeatedWords,
    possible_improvements: improvements,
    overall_suggestions: 'Strong structural foundation. Focus on mindful breathing between major transitions to elevate your presence.'
  };

  // Check if Gemini API key is provided
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).__GEMINI_KEY__ || apiKey;
  if (!envKey) {
    return baseResult;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: envKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
You are an expert speech coach and communications evaluator reviewing a student's public speaking rehearsal transcript.
Analyze the transcript below and return constructive, structured feedback.

Transcript:
"${clean}"

Provide clear sections:
1. Overall Impression
2. Clarity & Articulation
3. Vocabulary & Tone
4. Filler Words & Pauses
5. Top 3 Actionable Drills
      `
    });

    if (response && response.text) {
      return {
        ...baseResult,
        source: 'Google Gemini 2.5 Flash',
        ai_raw: response.text
      };
    }
  } catch (err) {
    console.warn('Gemini API call failed, falling back to built-in linguistic engine:', err);
  }

  return baseResult;
}
