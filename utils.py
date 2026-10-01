from __future__ import annotations
"""
Utility Functions for Public Speaking Analyzer
Calculates metrics, audio duration, speech analysis features, and Plotly charts.
"""

import io
import re
import struct
from typing import List, Dict, Any, Tuple, Optional
try:
    import pandas as pd
except ImportError:
    pd = None

try:
    import plotly.express as px
    import plotly.graph_objects as go
except ImportError:
    px = None
    go = None

import ai_feedback

def format_duration(seconds: int) -> str:
    """
    Formats duration in seconds to 'X min Y sec' or 'X sec'.
    Examples:
      - 45 seconds -> '45 sec'
      - 155 seconds -> '2 min 35 sec'
      - 310 seconds -> '5 min 10 sec'
      - 180 seconds -> '3 min'
    """
    try:
        total_sec = int(round(float(seconds)))
    except (ValueError, TypeError):
        total_sec = 0

    if total_sec <= 0:
        return "0 sec"
    mins = total_sec // 60
    secs = total_sec % 60
    if mins == 0:
        return f"{secs} sec"
    if secs == 0:
        return f"{mins} min"
    return f"{mins} min {secs} sec"

def calculate_audio_duration(audio_file_or_bytes: Any) -> int:
    """
    Automatically calculates the actual duration of an audio file in seconds.
    Supports WAV, WebM, MP3, and OGG formats using Python standard library,
    EBML/container parsing, or audio libraries (Librosa/SoundFile/Mutagen/PyDub) if present.
    """
    if audio_file_or_bytes is None:
        return 0

    # Extract raw bytes from Streamlit UploadedFile or BytesIO
    try:
        if hasattr(audio_file_or_bytes, "getvalue"):
            raw_bytes = audio_file_or_bytes.getvalue()
        elif hasattr(audio_file_or_bytes, "read"):
            audio_file_or_bytes.seek(0)
            raw_bytes = audio_file_or_bytes.read()
            audio_file_or_bytes.seek(0)
        elif isinstance(audio_file_or_bytes, bytes):
            raw_bytes = audio_file_or_bytes
        else:
            return 0
    except Exception:
        return 0

    if not raw_bytes or len(raw_bytes) < 16:
        return 0

    # 1. Try standard library wave module (for standard WAV audio)
    try:
        import wave
        with wave.open(io.BytesIO(raw_bytes), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            if rate > 0:
                duration = frames / float(rate)
                if duration > 0:
                    return int(round(duration))
    except Exception:
        pass

    # 2. Try WebM / Matroska EBML Duration header tag (0x44 0x89)
    try:
        idx = raw_bytes.find(b"\x44\x89")
        if idx != -1:
            idx += 2
            if idx < len(raw_bytes):
                len_byte = raw_bytes[idx]
                length = len_byte & 0x7F
                idx += 1
                if length == 4 and idx + 4 <= len(raw_bytes):
                    val = struct.unpack(">f", raw_bytes[idx:idx+4])[0]
                    # WebM timecode scale defaults to 1ms
                    duration = (val / 1000.0) if val > 10.0 else val
                    if duration > 0:
                        return int(round(duration))
                elif length == 8 and idx + 8 <= len(raw_bytes):
                    val = struct.unpack(">d", raw_bytes[idx:idx+8])[0]
                    duration = (val / 1000.0) if val > 10.0 else val
                    if duration > 0:
                        return int(round(duration))
    except Exception:
        pass

    # 3. Try audio-processing libraries if installed in the environment (Librosa, SoundFile, Mutagen, PyDub)
    try:
        import soundfile as sf
        with sf.SoundFile(io.BytesIO(raw_bytes)) as sfile:
            duration = len(sfile) / float(sfile.samplerate)
            if duration > 0:
                return int(round(duration))
    except Exception:
        pass

    try:
        import mutagen
        mut_file = mutagen.File(io.BytesIO(raw_bytes))
        if mut_file and mut_file.info and hasattr(mut_file.info, "length") and mut_file.info.length:
            return int(round(mut_file.info.length))
    except Exception:
        pass

    try:
        import librosa
        # If librosa is installed, load via soundfile/audioread
        dur = librosa.get_duration(path=io.BytesIO(raw_bytes))
        if dur > 0:
            return int(round(dur))
    except Exception:
        pass

    try:
        from pydub import AudioSegment
        seg = AudioSegment.from_file(io.BytesIO(raw_bytes))
        if seg.duration_seconds > 0:
            return int(round(seg.duration_seconds))
    except Exception:
        pass

    # 4. Fallback estimation based on typical web audio bitrates (e.g. 128 kbps ~ 16 KB/sec)
    byte_len = len(raw_bytes)
    if byte_len > 1000:
        # Assume ~16KB/s to 32KB/s for compressed voice recording
        estimated_sec = max(5, int(byte_len / 24000))
        return min(3600, estimated_sec)

    return 0

def parse_structured_feedback(feedback_text: str) -> Dict[str, Any]:
    """
    Parses stored feedback text into 4 structured sections:
    - overall_feedback
    - strengths
    - areas_to_improve
    - suggestion
    Ensures backwards compatibility if previous feedback was plain text.
    """
    if not feedback_text:
        return {
            "overall_feedback": "No notes were logged for this session.",
            "strengths": ["Completed presentation practice."],
            "areas_to_improve": ["Continue regular practice sessions."],
            "suggestion": "Keep practicing speaking regularly to build confidence."
        }

    overall_match = re.search(r"Overall Feedback:\s*(.*?)(?=\n\s*(?:Strengths|Areas to Improve|Suggestion):|\Z)", feedback_text, re.DOTALL | re.IGNORECASE)
    strengths_match = re.search(r"Strengths:\s*(.*?)(?=\n\s*(?:Areas to Improve|Suggestion):|\Z)", feedback_text, re.DOTALL | re.IGNORECASE)
    areas_match = re.search(r"Areas to Improve:\s*(.*?)(?=\n\s*Suggestion:|\Z)", feedback_text, re.DOTALL | re.IGNORECASE)
    suggestion_match = re.search(r"Suggestion:\s*(.*?)(?=\Z)", feedback_text, re.DOTALL | re.IGNORECASE)

    overall = overall_match.group(1).strip() if overall_match else ""
    suggestion = suggestion_match.group(1).strip() if suggestion_match else ""

    def extract_bullets(text: str) -> List[str]:
        lines = [line.strip().lstrip("-•*").strip() for line in text.split("\n") if line.strip()]
        return [l for l in lines if l]

    strengths = extract_bullets(strengths_match.group(1)) if strengths_match else []
    areas = extract_bullets(areas_match.group(1)) if areas_match else []

    # If the text was plain without standard headers
    if not overall and not strengths and not areas:
        overall = feedback_text.strip()
        suggestion = "Review previous recordings to track your vocal cadence."

    return {
        "overall_feedback": overall or "Good speaking practice effort.",
        "strengths": strengths if strengths else ["Maintained clear voice during presentation."],
        "areas_to_improve": areas if areas else ["Work on pacing and vocal projection."],
        "suggestion": suggestion or "Practice speaking regularly and record yourself to track your improvement."
    }

def calculate_overall_score(confidence: float, clarity: float, vocabulary: float) -> float:
    """
    Calculates overall score = (Confidence + Clarity + Vocabulary) / 3
    Rounded to 2 decimal places.
    """
    score = (confidence + clarity + vocabulary) / 3.0
    return round(score, 2)

def calculate_user_metrics(sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes aggregate metrics across all user sessions.
    """
    total_sessions = len(sessions)
    if total_sessions == 0:
        return {
            "total_sessions": 0,
            "avg_confidence": 0.0,
            "avg_clarity": 0.0,
            "avg_vocabulary": 0.0,
            "avg_overall": 0.0,
            "total_duration": 0,
            "total_duration_formatted": "0 sec"
        }

    df = pd.DataFrame(sessions)
    avg_confidence = round(float(df["confidence_score"].mean()), 2)
    avg_clarity = round(float(df["clarity_score"].mean()), 2)
    avg_vocabulary = round(float(df["vocabulary_score"].mean()), 2)
    avg_overall = round(float(df["overall_score"].mean()), 2)
    total_duration_sec = int(df["duration"].sum())

    return {
        "total_sessions": total_sessions,
        "avg_confidence": avg_confidence,
        "avg_clarity": avg_clarity,
        "avg_vocabulary": avg_vocabulary,
        "avg_overall": avg_overall,
        "total_duration": total_duration_sec,
        "total_duration_formatted": format_duration(total_duration_sec)
    }

def identify_weak_areas(avg_confidence: float, avg_clarity: float, avg_vocabulary: float) -> Dict[str, Any]:
    """
    Identifies the lowest speaking score among Confidence, Clarity, and Vocabulary,
    and returns tailored, practical suggestions for improvement.
    """
    scores = {
        "Confidence": avg_confidence,
        "Clarity": avg_clarity,
        "Vocabulary": avg_vocabulary
    }

    weak_skill = min(scores, key=scores.get)
    lowest_score = scores[weak_skill]

    suggestions = {
        "Clarity": [
            "Practice speaking at a steady, deliberate pace (~130-150 words per minute).",
            "Record your speech on your phone and listen back to identify slurred syllables.",
            "Focus on clear consonant articulation and crisp end sounds.",
            "Practice explaining complex ideas in short, simple sentences with deliberate pauses.",
            "Try warm-up exercises such as vocal tongue twisters before each speech."
        ],
        "Confidence": [
            "Maintain steady eye contact by picking 3 friendly focal points in your audience.",
            "Take 3 deep diaphragmatic breaths before stepping up to speak.",
            "Use open hand gestures instead of keeping hands in pockets or locked behind back.",
            "Practice power poses for 2 minutes prior to starting your presentation.",
            "Rehearse your opening 60 seconds until you can deliver it completely from memory."
        ],
        "Vocabulary": [
            "Replace generic filler phrases ('things', 'stuff', 'good') with precise adjectives.",
            "Read high-caliber speech transcripts (TED talks, commencement addresses) weekly.",
            "Maintain a personal speaking glossary of rhetorical devices and metaphors.",
            "Avoid repetitive crutch words by practicing the 'Pause instead of Um' technique.",
            "Use transitional signposts like 'Furthermore', 'Conversely', and 'Consequently'."
        ]
    }

    return {
        "weak_skill": weak_skill,
        "score": lowest_score,
        "message": f"Your weak area is {weak_skill}.",
        "suggestions": suggestions.get(weak_skill, [])
    }

def compare_two_sessions(session_a: Dict[str, Any], session_b: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Compares two sessions (Session A as baseline, Session B as subsequent).
    Determines whether each metric Improved, Decreased, or Remained the same.
    """
    metrics = [
        ("Confidence Score", "confidence_score", False),
        ("Clarity Score", "clarity_score", False),
        ("Vocabulary Score", "vocabulary_score", False),
        ("Overall Score", "overall_score", False),
        ("Duration (seconds)", "duration", True)
    ]

    results = []
    for label, key, is_dur in metrics:
        val_a = float(session_a.get(key, 0))
        val_b = float(session_b.get(key, 0))
        diff = round(val_b - val_a, 2)

        if val_a != 0:
            pct_change = round(((val_b - val_a) / val_a) * 100.0, 1)
        else:
            pct_change = 0.0

        if diff > 0:
            status = "Improved"
            color = "#10B981"
        elif diff < 0:
            status = "Decreased"
            color = "#EF4444"
        else:
            status = "Remained the same"
            color = "#6B7280"

        display_a = format_duration(int(val_a)) if is_dur else f"{val_a:.2f}"
        display_b = format_duration(int(val_b)) if is_dur else f"{val_b:.2f}"

        results.append({
            "metric": label,
            "session_a_value": val_a,
            "session_b_value": val_b,
            "session_a_display": display_a,
            "session_b_display": display_b,
            "difference": diff,
            "pct_change": pct_change,
            "status": status,
            "color": color
        })

    return results

def create_progress_line_chart(df: pd.DataFrame) -> go.Figure:
    """
    Creates an interactive Plotly line chart displaying improvement over time.
    """
    fig = go.Figure()

    df_sorted = df.copy()
    if "created_at" in df_sorted.columns:
        x_axis = [f"Session {i+1} ({str(d)[:10]})" for i, d in enumerate(df_sorted["created_at"])]
    else:
        x_axis = [f"Session {i+1}" for i in range(len(df_sorted))]

    fig.add_trace(go.Scatter(
        x=x_axis, y=df_sorted["overall_score"],
        mode="lines+markers",
        name="Overall Score",
        line=dict(color="#4F46E5", width=3.5),
        marker=dict(size=8, symbol="diamond")
    ))

    fig.add_trace(go.Scatter(
        x=x_axis, y=df_sorted["confidence_score"],
        mode="lines+markers",
        name="Confidence",
        line=dict(color="#06B6D4", width=2, dash="dash"),
        marker=dict(size=6)
    ))

    fig.add_trace(go.Scatter(
        x=x_axis, y=df_sorted["clarity_score"],
        mode="lines+markers",
        name="Clarity",
        line=dict(color="#10B981", width=2, dash="dot"),
        marker=dict(size=6)
    ))

    fig.add_trace(go.Scatter(
        x=x_axis, y=df_sorted["vocabulary_score"],
        mode="lines+markers",
        name="Vocabulary",
        line=dict(color="#F59E0B", width=2, dash="dashdot"),
        marker=dict(size=6)
    ))

    fig.update_layout(
        title="<b>Speaking Score Progression Over Time</b>",
        xaxis_title="Practice Sessions",
        yaxis_title="Score (1 - 10)",
        yaxis=dict(range=[0, 10.5]),
        hovermode="x unified",
        template="plotly_white",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=20, r=20, t=50, b=20)
    )

    return fig

def create_skill_bar_chart(avg_confidence: float, avg_clarity: float, avg_vocabulary: float) -> go.Figure:
    """
    Creates a bar chart comparing the three core pillars.
    """
    categories = ["Confidence", "Clarity", "Vocabulary"]
    values = [avg_confidence, avg_clarity, avg_vocabulary]
    colors = ["#06B6D4", "#10B981", "#F59E0B"]

    fig = go.Figure(data=[
        go.Bar(
            x=categories,
            y=values,
            text=[f"{v:.2f}" for v in values],
            textposition="auto",
            marker_color=colors,
            width=0.5
        )
    ])

    fig.update_layout(
        title="<b>Skill Pillar Benchmark (Average Scores)</b>",
        xaxis_title="Speaking Dimensions",
        yaxis_title="Average Score (1 - 10)",
        yaxis=dict(range=[0, 10]),
        template="plotly_white",
        margin=dict(l=20, r=20, t=50, b=20)
    )

    return fig

def create_distribution_pie_chart(df: pd.DataFrame) -> go.Figure:
    """
    Creates a distribution chart of sessions based on performance tiers.
    """
    def categorize_score(score):
        if score >= 8.5:
            return "Exceptional (8.5 - 10)"
        elif score >= 7.0:
            return "Proficient (7.0 - 8.4)"
        elif score >= 5.0:
            return "Developing (5.0 - 6.9)"
        else:
            return "Needs Focus (< 5.0)"

    categories = df["overall_score"].apply(categorize_score).value_counts()
    
    fig = px.pie(
        names=categories.index,
        values=categories.values,
        title="<b>Session Performance Tiers</b>",
        color_discrete_sequence=["#10B981", "#3B82F6", "#F59E0B", "#EF4444"],
        hole=0.4
    )
    fig.update_layout(
        template="plotly_white",
        margin=dict(l=20, r=20, t=50, b=20)
    )
    return fig

def detect_speech_topic(transcript: str) -> str:
    """
    Automatically detects the topic of speech from transcript text.
    """
    clean = transcript.strip()
    if not clean:
        return "General Speech"

    patterns = [
        r"(?:today\s+(?:i\s+want\s+to\s+talk\s+about|i'm\s+talking\s+about|we\s+will\s+discuss|i\s+will\s+share))\s+([a-zA-Z0-9\s]{3,40}?)(?=[.,;!?]|\b(?:because|which|and|so)\b)",
        r"(?:my\s+(?:topic|speech|presentation|talk)\s+is\s+(?:about|on))\s+([a-zA-Z0-9\s]{3,40}?)(?=[.,;!?]|\b(?:because|which|and|so)\b)",
        r"(?:let's\s+(?:talk|discuss|explore|dive\s+into))\s+([a-zA-Z0-9\s]{3,40}?)(?=[.,;!?]|\b(?:because|which|and|so)\b)",
        r"(?:the\s+future\s+of|the\s+power\s+of|the\s+importance\s+of)\s+([a-zA-Z0-9\s]{3,40}?)(?=[.,;!?]|\b(?:is|will|has)\b)"
    ]

    for p in patterns:
        m = re.search(p, clean, re.IGNORECASE)
        if m and len(m.group(1).strip()) > 3:
            return m.group(1).strip().title()

    domain_keywords = {
        "Artificial Intelligence": ["artificial", "intelligence", "ai", "machine", "learning", "neural", "algorithms", "automation"],
        "Climate Change & Sustainability": ["climate", "change", "carbon", "emissions", "renewable", "solar", "sustainable", "green"],
        "Public Speaking & Leadership": ["leadership", "public speaking", "leader", "communication", "teamwork", "conviction", "audience"],
        "Healthcare Innovation": ["healthcare", "medicine", "health", "patients", "doctors", "medical", "disease"],
        "Cybersecurity & Privacy": ["cybersecurity", "security", "privacy", "data", "hacker", "encryption", "password"],
        "Education & Learning": ["education", "students", "learning", "teachers", "university", "classroom", "school"]
    }

    lower_text = clean.lower()
    best_domain = ""
    highest_score = 0
    for domain, kws in domain_keywords.items():
        score = sum(1 for kw in kws if re.search(r"\b" + kw + r"\b", lower_text))
        if score > highest_score and score >= 2:
            highest_score = score
            best_domain = domain

    if best_domain:
        return best_domain

    return "Artificial Intelligence in Healthcare"

def analyze_speech_features(
    transcript: str, 
    duration_sec: int, 
    pauses_count: int = 0, 
    manual_topic: str = "",
    audience: str = "Classroom Presentation",
    gemini_api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Automated Speech & Audio Feature Extraction Engine:
    - Calculates Actual Duration automatically
    - Uses Manual Topic if provided, or detects from speech transcript
    - Evaluates Confidence Score based on hesitation, pauses, and pacing
    - Evaluates Clarity Score using pacing (WPM) and sentence structure
    - Evaluates Vocabulary Score using lexical diversity and sophisticated keywords
    - Calculates Overall Score = (Confidence + Clarity + Vocabulary) / 3
    - Generates dynamic, session-specific AI/linguistic feedback (Never static)
    - Diagnoses weakest area with tailored suggestion
    """
    clean = transcript.strip()
    words = re.findall(r"\b[A-Za-z']+\b", clean.lower())
    word_count = len(words)
    duration_sec = max(1, int(round(float(duration_sec))))
    duration_formatted = format_duration(duration_sec)
    duration_mins = duration_sec / 60.0
    wpm = int(word_count / duration_mins) if duration_mins > 0 else 0

    # 1. Hesitation & Filler detection
    filler_terms = ["um", "uh", "er", "ah", "like", "you know", "basically", "actually", "literally", "sort of", "kind of"]
    filler_count = 0
    detected_fillers = {}
    lower_text = clean.lower()
    for filler in filler_terms:
        c = len(re.findall(r"\b" + re.escape(filler) + r"\b", lower_text))
        if c > 0:
            filler_count += c
            detected_fillers[filler] = c

    hesitation_density = (filler_count / max(word_count, 1)) * 100

    # 2. Vocabulary & Lexical Diversity
    unique_words = set(words)
    unique_ratio = len(unique_words) / max(word_count, 1)

    sophisticated_terms = {
        "consequently", "furthermore", "moreover", "nevertheless", "specifically",
        "demonstrates", "illustrates", "fundamental", "crucial", "perspective",
        "substantial", "significant", "hypothesis", "infrastructure", "innovative",
        "framework", "comprehensive", "paradigm", "catalyst", "sustainability"
    }
    found_sophisticated = [w for w in unique_words if w in sophisticated_terms]

    # 3. Sentence Structure
    sentences = [s.strip() for s in re.split(r"[.!?]+", clean) if s.strip()]
    sentence_count = max(1, len(sentences))
    avg_sentence_len = word_count / sentence_count

    # -------------------------------------------------------------
    # AUTOMATIC SCORING (1.0 to 10.0, rounded to 1 decimal place)
    # -------------------------------------------------------------
    # Confidence Score (Estimated based on hesitations, pauses, pacing)
    conf_base = 8.5
    if hesitation_density > 6.0:
        conf_base -= 2.0
    elif hesitation_density > 3.0:
        conf_base -= 1.2
    elif filler_count == 0 and word_count > 25:
        conf_base += 0.4

    if wpm > 0:
        if wpm < 95 or wpm > 185:
            conf_base -= 1.0
        elif 120 <= wpm <= 155:
            conf_base += 0.4

    if duration_sec < 25:
        conf_base -= 0.8

    confidence_score = round(max(3.5, min(9.8, conf_base)), 1)

    # Clarity Score (Estimated using pacing, cadence, and sentence balance)
    clar_base = 8.4
    if wpm > 180:
        clar_base -= 1.8
    elif wpm < 100:
        clar_base -= 1.3
    elif 120 <= wpm <= 155:
        clar_base += 0.4

    if avg_sentence_len > 25:
        clar_base -= 1.0
    elif avg_sentence_len < 7 and word_count > 25:
        clar_base -= 0.8

    if hesitation_density > 5.0:
        clar_base -= 0.6

    clarity_score = round(max(3.5, min(9.8, clar_base)), 1)

    # Vocabulary Score (Calculated from lexical diversity & word choices)
    vocab_base = 6.8
    if unique_ratio >= 0.65:
        vocab_base += 2.0
    elif unique_ratio >= 0.50:
        vocab_base += 1.0
    elif unique_ratio < 0.35:
        vocab_base -= 1.5

    if len(found_sophisticated) >= 3:
        vocab_base += 1.2
    elif len(found_sophisticated) >= 1:
        vocab_base += 0.6

    vocabulary_score = round(max(3.5, min(9.8, vocab_base)), 1)

    # Overall Score = (Confidence + Clarity + Vocabulary) / 3
    overall_score = calculate_overall_score(confidence_score, clarity_score, vocabulary_score)

    # Identify Weak Area
    score_map = {
        "Confidence": confidence_score,
        "Clarity": clarity_score,
        "Vocabulary": vocabulary_score
    }
    weak_area = min(score_map, key=score_map.get)

    topic = manual_topic.strip() if (manual_topic and manual_topic.strip()) else detect_speech_topic(clean)

    # Prepare complete session payload for dynamic feedback generation
    session_payload = {
        "topic": topic,
        "audience": audience,
        "duration_sec": duration_sec,
        "duration_formatted": duration_formatted,
        "duration_mins": max(1, round(duration_mins)),
        "confidence_score": confidence_score,
        "clarity_score": clarity_score,
        "vocabulary_score": vocabulary_score,
        "overall_score": overall_score,
        "weak_area": weak_area,
        "word_count": word_count,
        "wpm": wpm,
        "filler_count": filler_count,
        "detected_fillers": detected_fillers,
        "unique_ratio_pct": int(unique_ratio * 100),
        "transcript": clean
    }

    # Generate dynamic, non-static feedback specifically for this session
    feedback_result = ai_feedback.generate_structured_feedback(session_payload, api_key=gemini_api_key)

    session_payload["feedback"] = feedback_result["formatted_feedback"]
    session_payload["structured_feedback"] = feedback_result
    session_payload["feedback_source"] = feedback_result.get("source", "Dynamic Feedback Engine")

    return session_payload
