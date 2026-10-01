"""
AI Speech Feedback Module for Public Speaking Analyzer
Generates dynamic, session-specific feedback using Google Gemini API
or an intelligent rule-based linguistic evaluation engine if the API key is not configured.

Each practice session receives customized feedback with:
1. Overall Feedback (evaluating topic, actual duration, scores, and delivery)
2. Strengths (highlighting high-performing dimensions)
3. Areas to Improve (pinpointing lowest scores, hesitations, and pace)
4. Suggestion (actionable drill for the student's weakest area)
"""

import os
import re
import json
from typing import Dict, Any, List, Optional
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def generate_dynamic_fallback_feedback(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Intelligent, score-driven linguistic analyzer for offline / fallback execution.
    Generates non-static, session-specific feedback that adapts dynamically to:
    - Speech transcript
    - Actual speech duration
    - Confidence score
    - Clarity score
    - Vocabulary score
    - Speaking pace (WPM)
    - Filler words and hesitations
    - Weak area diagnosis
    """
    topic = session_data.get("topic", "General Speech").strip()
    audience = session_data.get("audience", "Audience").strip()
    duration_sec = int(session_data.get("duration_sec", 60))
    duration_formatted = session_data.get("duration_formatted", f"{duration_sec} sec")
    conf = float(session_data.get("confidence_score", 7.0))
    clar = float(session_data.get("clarity_score", 7.0))
    vocab = float(session_data.get("vocabulary_score", 7.0))
    overall = float(session_data.get("overall_score", (conf + clar + vocab) / 3.0))
    wpm = int(session_data.get("wpm", 130))
    filler_count = int(session_data.get("filler_count", 0))
    detected_fillers = session_data.get("detected_fillers", {})
    transcript = session_data.get("transcript", "")
    weak_area = session_data.get("weak_area", "Clarity")

    # -------------------------------------------------------------
    # 1. DYNAMIC OVERALL FEEDBACK
    # -------------------------------------------------------------
    overall_sentences = []

    # Opening sentence based on overall score and duration
    if overall >= 8.5:
        overall_sentences.append(f"Outstanding delivery throughout your {duration_formatted} presentation on '{topic}'. Your ideas were compelling and well structured.")
    elif overall >= 7.5:
        overall_sentences.append(f"Solid practice performance on '{topic}' lasting {duration_formatted}. Your core message was clear and effectively communicated.")
    elif overall >= 6.0:
        overall_sentences.append(f"Good practice effort on '{topic}' across {duration_formatted}. Your presentation showed genuine effort and understandable thoughts.")
    else:
        overall_sentences.append(f"Promising rehearsal attempt on '{topic}' ({duration_formatted}). Consistent practice will help you build steadiness and fluency.")

    # Specific score-driven observation sentences (per prompt specifications)
    if conf < 7.0:
        overall_sentences.append("Your confidence can be improved. Try practicing in short sessions and gradually increase your speaking duration.")
    elif conf >= 8.5:
        overall_sentences.append("You exhibited strong self-assurance and an authoritative speaking presence.")

    if clar < 7.0:
        overall_sentences.append("Your ideas are understandable, but your speech clarity needs improvement. Try speaking slightly slower and pronounce words clearly.")
    elif clar >= 8.5:
        overall_sentences.append("Your vocal articulation was exceptionally crisp, making each point effortless to follow.")

    if vocab >= 7.5:
        overall_sentences.append("You used a good range of vocabulary in this session.")
    elif vocab < 6.0:
        overall_sentences.append("Consider incorporating more varied vocabulary and descriptive language to enhance your speech.")

    # Filler words and duration checks
    if filler_count >= 3:
        sample_fillers = [f"'{k}'" for k in list(detected_fillers.keys())[:3]] if detected_fillers else ["'um'", "'like'", "'actually'"]
        overall_sentences.append(f"Try reducing filler words such as {', '.join(sample_fillers)}.")

    if duration_sec < 40 and len(transcript.split()) < 50:
        overall_sentences.append("Try developing your ideas further and practice speaking for a longer duration.")
    elif wpm > 175:
        overall_sentences.append(f"Your pace was fairly rapid (~{wpm} WPM); pacing yourself will give your listeners time to absorb complex concepts.")
    elif wpm < 100 and wpm > 0:
        overall_sentences.append(f"Your delivery pace was measured (~{wpm} WPM); building slight forward momentum will keep audience engagement peaked.")

    overall_feedback = " ".join(overall_sentences)

    # -------------------------------------------------------------
    # 2. DYNAMIC STRENGTHS (Recognize actual high-performing areas)
    # -------------------------------------------------------------
    strengths = []

    if conf >= 7.5:
        strengths.append(f"Strong confidence and steady vocal conviction when addressing {audience}.")
    if clar >= 7.5:
        strengths.append("Clear articulation with well-spaced thoughts that made points easy to understand.")
    if vocab >= 7.5:
        strengths.append("Rich, diverse vocabulary usage that effectively illustrated your subject matter.")
    if 115 <= wpm <= 160:
        strengths.append(f"Well-regulated speaking pace (~{wpm} WPM) maintaining optimal listener comprehension.")
    if filler_count <= 1 and duration_sec >= 30:
        strengths.append("Minimal reliance on filler words, resulting in smooth transitions between thoughts.")
    if duration_sec >= 90:
        strengths.append(f"Maintained good speaking stamina across a full {duration_formatted} delivery.")

    # Fallback to relative best dimensions if scores are all developing
    if not strengths:
        max_dim = max([("Confidence", conf), ("Clarity", clar), ("Vocabulary", vocab)], key=lambda x: x[1])
        strengths.append(f"Demonstrated good baseline capability in {max_dim[0]} (scored {max_dim[1]:.1f}/10).")
        strengths.append("Committed to practicing and refining your public speaking skills.")
    elif len(strengths) == 1:
        if 110 <= wpm <= 165:
            strengths.append(f"Maintained an approachable presentation tempo (~{wpm} WPM).")
        else:
            strengths.append("Structured speech thoughts in an understandable sequence.")

    # -------------------------------------------------------------
    # 3. DYNAMIC AREAS TO IMPROVE (Focus on lowest-scoring pillars)
    # -------------------------------------------------------------
    areas_to_improve = []

    if weak_area == "Confidence" or conf < 7.5:
        if filler_count > 0:
            areas_to_improve.append(f"Reduce unnecessary pauses and filler words ({filler_count} detected) by using deliberate silent breaths.")
        else:
            areas_to_improve.append("Work on vocal projection and steady eye contact to convey greater conviction.")

    if weak_area == "Clarity" or clar < 7.5:
        if wpm > 165:
            areas_to_improve.append(f"Moderate your speaking speed (~{wpm} WPM) and articulate end consonants distinctly.")
        elif wpm < 105 and wpm > 0:
            areas_to_improve.append(f"Pick up speaking tempo slightly (~{wpm} WPM) to prevent hesitation between sentences.")
        else:
            areas_to_improve.append("Improve speech clarity by speaking slightly slower and enunciating key terminology.")

    if weak_area == "Vocabulary" or vocab < 7.5:
        areas_to_improve.append("Try using more varied vocabulary and replace repeated everyday words with specific rhetorical terms.")

    if duration_sec < 45:
        areas_to_improve.append(f"Extend speech duration beyond {duration_formatted} by providing supporting evidence or examples.")

    if not areas_to_improve:
        areas_to_improve.append(f"Fine-tune vocal inflections at major transition points for {topic}.")
        areas_to_improve.append("Experiment with rhetorical questions to engage the listener more deeply.")

    # -------------------------------------------------------------
    # 4. DYNAMIC ACTIONABLE SUGGESTION (Specific to weakest pillar)
    # -------------------------------------------------------------
    if weak_area == "Confidence":
        suggestion = "Practice speaking regularly and record yourself to track your improvement and build confidence."
    elif weak_area == "Clarity":
        suggestion = "Practice speaking at a relaxed pace and pause briefly between key thoughts to improve clarity."
    elif weak_area == "Vocabulary":
        suggestion = "Practice using new words in your daily conversations to expand your speaking vocabulary."
    else:
        suggestion = "Practice speaking in front of a mirror or friendly audience to refine your natural body language."

    # Format the complete feedback block for database persistence
    formatted_feedback = (
        f"Overall Feedback:\n{overall_feedback}\n\n"
        f"Strengths:\n" + "\n".join([f"- {s}" for s in strengths]) + "\n\n"
        f"Areas to Improve:\n" + "\n".join([f"- {a}" for a in areas_to_improve]) + "\n\n"
        f"Suggestion:\n{suggestion}"
    )

    return {
        "overall_feedback": overall_feedback,
        "strengths": strengths,
        "areas_to_improve": areas_to_improve,
        "suggestion": suggestion,
        "formatted_feedback": formatted_feedback,
        "source": "Dynamic Linguistic Evaluation Engine"
    }

def generate_structured_feedback(session_data: Dict[str, Any], api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Generates structured, session-specific feedback using Google Gemini API if configured.
    Falls back gracefully to the dynamic rule-based engine if the API is unavailable,
    ensuring zero crashes and always producing customized feedback.
    """
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key or key.strip() in ("", "your_gemini_api_key_here", "None"):
        return generate_dynamic_fallback_feedback(session_data)

    try:
        from google import genai
        client = genai.Client(api_key=key)

        topic = session_data.get("topic", "General Speech")
        audience = session_data.get("audience", "General Audience")
        duration_formatted = session_data.get("duration_formatted", "2 min 30 sec")
        duration_sec = session_data.get("duration_sec", 150)
        conf = session_data.get("confidence_score", 7.0)
        clar = session_data.get("clarity_score", 7.0)
        vocab = session_data.get("vocabulary_score", 7.0)
        overall = session_data.get("overall_score", 7.0)
        wpm = session_data.get("wpm", 130)
        filler_count = session_data.get("filler_count", 0)
        weak_area = session_data.get("weak_area", "Clarity")
        transcript = session_data.get("transcript", "")

        prompt = f"""
        You are an expert speech coach and communications jury panelist.
        Analyze this specific student practice session and generate tailored, non-static feedback.

        Session Data:
        - Topic: {topic}
        - Audience: {audience}
        - Actual Duration: {duration_formatted} ({duration_sec} seconds)
        - Confidence Score: {conf:.1f} / 10.0
        - Clarity Score: {clar:.1f} / 10.0
        - Vocabulary Score: {vocab:.1f} / 10.0
        - Overall Score: {overall:.2f} / 10.0
        - Primary Weak Area: {weak_area}
        - Speaking Pace: ~{wpm} Words Per Minute
        - Filler Words Count: {filler_count}
        - Transcript:
        \"\"\"{transcript}\"\"\"

        Requirements:
        1. Base your evaluation strictly on this student's actual performance metrics.
        2. If confidence is low, focus advice on building delivery poise.
        3. If clarity is low, focus advice on articulation and pacing.
        4. If vocabulary is high, acknowledge it as a strength; if low, suggest variety.
        5. If filler words are high, advise reducing specific crutch words.
        6. Return your response as a valid JSON object with EXACTLY these four keys:
        {{
            "overall_feedback": "2-3 dynamic sentences evaluating their speech, mentioning topic and duration",
            "strengths": ["Specific strength 1 based on actual data", "Specific strength 2"],
            "areas_to_improve": ["Specific area 1 to improve based on weakest score", "Specific area 2"],
            "suggestion": "One practical, actionable practice recommendation tailored to their weakest area"
        }}
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        raw_text = response.text.strip()
        # Clean any markdown code fences if Gemini outputs ```json ... ```
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

        parsed = json.loads(raw_text)

        overall_fb = str(parsed.get("overall_feedback", "")).strip()
        strengths_list = [str(s).lstrip("-•* ").strip() for s in parsed.get("strengths", [])]
        areas_list = [str(a).lstrip("-•* ").strip() for a in parsed.get("areas_to_improve", [])]
        sugg = str(parsed.get("suggestion", "")).strip()

        if not overall_fb or not strengths_list:
            raise ValueError("Incomplete JSON response from Gemini API.")

        formatted_feedback = (
            f"Overall Feedback:\n{overall_fb}\n\n"
            f"Strengths:\n" + "\n".join([f"- {s}" for s in strengths_list]) + "\n\n"
            f"Areas to Improve:\n" + "\n".join([f"- {a}" for a in areas_list]) + "\n\n"
            f"Suggestion:\n{sugg}"
        )

        return {
            "overall_feedback": overall_fb,
            "strengths": strengths_list,
            "areas_to_improve": areas_list,
            "suggestion": sugg,
            "formatted_feedback": formatted_feedback,
            "source": "Google Gemini AI (gemini-2.5-flash)"
        }

    except Exception as e:
        # Graceful fallback to dynamic local engine
        fallback = generate_dynamic_fallback_feedback(session_data)
        fallback["api_note"] = f"Gemini API request note ({str(e)}). Used dynamic linguistic evaluator."
        return fallback

def analyze_speech_transcript_local(transcript: str) -> Dict[str, Any]:
    """
    Legacy helper for standalone transcript analysis tab.
    """
    words = re.findall(r"\b[A-Za-z']+\b", transcript.lower())
    total_words = len(words)
    
    if total_words == 0:
        return {
            "source": "Local Analyzer",
            "clarity_feedback": "No words detected in transcript.",
            "vocabulary_feedback": "N/A",
            "grammar_feedback": "N/A",
            "repeated_words": [],
            "possible_improvements": ["Please provide a transcript of at least 20 words."],
            "overall_suggestions": "Speak clearly and transcribe your practice session."
        }

    filler_terms = ["um", "uh", "like", "you know", "basically", "actually", "literally", "sort of", "kind of"]
    filler_counts = {}
    lower_text = transcript.lower()
    for filler in filler_terms:
        count = len(re.findall(r"\b" + re.escape(filler) + r"\b", lower_text))
        if count > 0:
            filler_counts[filler] = count

    stop_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", "is", "was", "it", "that", "this", "i", "you", "we", "they"}
    content_words = [w for w in words if w not in stop_words and len(w) > 2]
    freq = {}
    for w in content_words:
        freq[w] = freq.get(w, 0) + 1
    
    repeated = sorted([(w, c) for w, c in freq.items() if c > 2], key=lambda x: x[1], reverse=True)[:5]
    unique_ratio = len(set(words)) / total_words

    sentences = [s.strip() for s in re.split(r"[.!?]+", transcript) if s.strip()]
    avg_sentence_len = total_words / max(len(sentences), 1)

    if avg_sentence_len > 25:
        clarity_note = "Sentences are quite long (avg > 25 words). Consider breaking thoughts into shorter, punchier phrases."
    elif avg_sentence_len < 8:
        clarity_note = "Sentences are very brief. Blend short phrases with compound sentences for natural cadence."
    else:
        clarity_note = f"Balanced sentence structure (averaging {avg_sentence_len:.1f} words per sentence)."

    if unique_ratio > 0.65:
        vocab_note = f"Exceptional lexical diversity ({int(unique_ratio * 100)}% unique words)."
    elif unique_ratio > 0.45:
        vocab_note = f"Good vocabulary variety ({int(unique_ratio * 100)}% unique words)."
    else:
        vocab_note = f"Moderate vocabulary repetition ({int(unique_ratio * 100)}% unique words). Practice using synonyms."

    improvements = []
    if filler_counts:
        most_common_filler = max(filler_counts, key=filler_counts.get)
        improvements.append(f"Noticeable use of filler words (e.g. '{most_common_filler}' appeared {filler_counts[most_common_filler]} times). Replace with deliberate silent pauses.")
    if repeated:
        repeated_list = ", ".join([f"'{w}' ({c}x)" for w, c in repeated[:3]])
        improvements.append(f"Frequently repeated key terms: {repeated_list}. Try varying your descriptive language.")
    if avg_sentence_len > 22:
        improvements.append("Shorten complex run-on clauses to give your audience breathing room to absorb key points.")
    if not improvements:
        improvements.append("Speech delivery is concise and well-paced. Continue expanding rhetorical devices.")

    return {
        "source": "Local Linguistic Analyzer",
        "clarity_feedback": clarity_note,
        "vocabulary_feedback": vocab_note,
        "grammar_feedback": "Sentence syntax appears sound. Ensure subjects and verbs align across subordinate clauses.",
        "repeated_words": [f"'{w}': {c} times" for w, c in repeated] + ([f"Filler '{k}': {v} times" for k, v in filler_counts.items()] if filler_counts else []),
        "possible_improvements": improvements,
        "overall_suggestions": "Your core message is articulated well. Emphasize inflection at key transitions and maintain purposeful pauses."
    }

def analyze_speech_with_gemini(transcript: str, api_key: str = None) -> Dict[str, Any]:
    """
    Sends the speech transcript to Google Gemini API for comprehensive public speaking analysis.
    Falls back gracefully to local analyzer if API key is invalid or unavailable.
    """
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key or key.strip() in ("", "your_gemini_api_key_here", "None"):
        result = analyze_speech_transcript_local(transcript)
        result["note"] = "Running offline local linguistic analysis. Set GEMINI_API_KEY in .env for generative AI insights."
        return result

    try:
        from google import genai
        client = genai.Client(api_key=key)

        prompt = f"""
        You are an expert speech coach and communications professor.
        Analyze this student's public speaking transcript and return structured constructive evaluation.

        Transcript:
        \"\"\"{transcript}\"\"\"

        Provide your feedback in these structured sections:
        1. Clarity: Evaluate clarity, sentence structure, flow, and pacing.
        2. Vocabulary: Evaluate word choice, diversity, and rhetoric.
        3. Grammar: Note any grammatical discrepancies or awkward phrasing.
        4. Repeated Words & Fillers: Identify frequent crutch words, fillers (um, like, etc.), and repeated vocabulary.
        5. Actionable Improvements: 3 bullet points on what to fix next.
        6. Overall Suggestions: A motivational summary recommendation for the student.
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        return {
            "source": "Google Gemini AI (gemini-2.5-flash)",
            "ai_raw_feedback": response.text,
            "status": "success"
        }
    except Exception as e:
        local_res = analyze_speech_transcript_local(transcript)
        local_res["note"] = f"Gemini API request note: {str(e)}. Showing local linguistic analysis."
        return local_res
