import streamlit as st
import sqlite3
import hashlib
import re
import io
import wave
from datetime import datetime

import pandas as pd
import plotly.express as px


# ============================================================
# CONFIGURATION
# ============================================================

st.set_page_config(
    page_title="Public Speaking Analyzer",
    page_icon="🎙️",
    layout="wide"
)

DB_FILE = "public_speaking_analyzer.db"


# ============================================================
# DATABASE
# ============================================================

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            topic TEXT NOT NULL,
            audience TEXT,
            duration REAL,
            transcript TEXT,
            word_count INTEGER,
            wpm REAL,
            filler_count INTEGER,
            confidence REAL,
            clarity REAL,
            vocabulary REAL,
            topic_relevance REAL,
            overall REAL,
            feedback TEXT,
            created_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def hash_password(password):
    return hashlib.sha256(
        password.encode("utf-8")
    ).hexdigest()


def register_user(name, email, password):

    conn = get_connection()

    try:

        conn.execute(
            """
            INSERT INTO users
            (name, email, password, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                name.strip(),
                email.strip().lower(),
                hash_password(password),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            )
        )

        conn.commit()
        return True, "Account created successfully."

    except sqlite3.IntegrityError:

        return False, "Email already registered."

    finally:

        conn.close()


def authenticate_user(email, password):

    conn = get_connection()

    user = conn.execute(
        """
        SELECT *
        FROM users
        WHERE email = ?
        AND password = ?
        """,
        (
            email.strip().lower(),
            hash_password(password)
        )
    ).fetchone()

    conn.close()

    if user:
        return dict(user)

    return None


def save_session(user_id, result):

    conn = get_connection()

    conn.execute(
        """
        INSERT INTO sessions (
            user_id,
            topic,
            audience,
            duration,
            transcript,
            word_count,
            wpm,
            filler_count,
            confidence,
            clarity,
            vocabulary,
            topic_relevance,
            overall,
            feedback,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            result["topic"],
            result["audience"],
            result["duration"],
            result["transcript"],
            result["word_count"],
            result["wpm"],
            result["filler_count"],
            result["confidence"],
            result["clarity"],
            result["vocabulary"],
            result["topic_relevance"],
            result["overall"],
            result["feedback"],
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
    )

    conn.commit()
    conn.close()


def get_user_sessions(user_id):

    conn = get_connection()

    rows = conn.execute(
        """
        SELECT *
        FROM sessions
        WHERE user_id = ?
        ORDER BY id DESC
        """,
        (user_id,)
    ).fetchall()

    conn.close()

    return [dict(row) for row in rows]


def delete_session(session_id, user_id):

    conn = get_connection()

    conn.execute(
        """
        DELETE FROM sessions
        WHERE id = ?
        AND user_id = ?
        """,
        (session_id, user_id)
    )

    conn.commit()
    conn.close()


# ============================================================
# AUDIO DURATION
# ============================================================

def get_audio_duration(audio_file):

    try:

        audio_file.seek(0)

        data = audio_file.read()

        audio_file.seek(0)

        with wave.open(io.BytesIO(data), "rb") as wav:

            frames = wav.getnframes()
            rate = wav.getframerate()

            if rate > 0:
                return frames / rate

    except Exception:

        return 0

    return 0


# ============================================================
# ACTUAL MICROPHONE → TEXT
# ============================================================

def transcribe_audio(audio_file):

    try:

        import speech_recognition as sr

    except ImportError:

        return "", (
            "SpeechRecognition is not installed. "
            "Run: pip install SpeechRecognition"
        )

    try:

        audio_file.seek(0)

        audio_bytes = audio_file.read()

        audio_file.seek(0)

        recognizer = sr.Recognizer()

        with sr.AudioFile(
            io.BytesIO(audio_bytes)
        ) as source:

            audio = recognizer.record(source)

        text = recognizer.recognize_google(audio)

        return text.strip(), ""

    except sr.UnknownValueError:

        return "", (
            "I could not understand your speech. "
            "Please speak clearly and record again."
        )

    except sr.RequestError:

        return "", (
            "Speech recognition service is unavailable. "
            "Please check your internet connection."
        )

    except Exception as e:

        return "", f"Audio processing error: {e}"


# ============================================================
# TEXT PROCESSING
# ============================================================

FILLER_WORDS = {
    "um",
    "uh",
    "erm",
    "hmm",
    "like",
    "basically",
    "actually"
}

MULTI_WORD_FILLERS = [
    "you know",
    "sort of",
    "kind of",
    "i mean"
]


STOP_WORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "if",
    "then",
    "is",
    "am",
    "are",
    "was",
    "were",
    "be",
    "been",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "at",
    "by",
    "from",
    "as",
    "it",
    "this",
    "that",
    "these",
    "those",
    "i",
    "we",
    "you",
    "he",
    "she",
    "they",
    "my",
    "our",
    "your",
    "their",
    "me",
    "us",
    "do",
    "does",
    "did",
    "have",
    "has",
    "had",
    "will",
    "would",
    "can",
    "could",
    "should",
    "may",
    "might",
    "about",
    "into",
    "than",
    "so",
    "very",
    "also",
    "just",
    "not"
}


def get_words(text):

    return re.findall(
        r"[A-Za-z]+(?:'[A-Za-z]+)?",
        text.lower()
    )


def get_topic_keywords(topic):

    words = get_words(topic)

    return {
        word
        for word in words
        if len(word) >= 3
        and word not in STOP_WORDS
    }


# ============================================================
# FILLER ANALYSIS
# ============================================================

def count_fillers(text):

    lower_text = text.lower()

    count = 0

    for phrase in MULTI_WORD_FILLERS:

        count += len(
            re.findall(
                r"\b" + re.escape(phrase) + r"\b",
                lower_text
            )
        )

    words = get_words(text)

    for word in words:

        if word in FILLER_WORDS:

            count += 1

    return count


# ============================================================
# TOPIC RELEVANCE
# ============================================================

def calculate_topic_relevance(text, topic):

    speech_words = set(get_words(text))

    topic_words = get_topic_keywords(topic)

    if not topic_words:

        return 5.0

    matched_words = speech_words.intersection(
        topic_words
    )

    match_ratio = (
        len(matched_words) /
        len(topic_words)
    )

    score = 2.0 + (
        match_ratio * 8.0
    )

    return round(
        max(0, min(10, score)),
        2
    )


# ============================================================
# VOCABULARY SCORE
# ============================================================

def calculate_vocabulary(text):

    words = get_words(text)

    if not words:

        return 0

    unique_words = len(set(words))
    total_words = len(words)

    diversity = unique_words / total_words

    length_factor = min(
        total_words / 80,
        1
    )

    score = (
        diversity * 7
        +
        length_factor * 3
    )

    return round(
        max(0, min(10, score)),
        2
    )


# ============================================================
# CLARITY SCORE
# ============================================================

def calculate_clarity(text):

    words = get_words(text)

    if not words:

        return 0

    sentences = [
        sentence.strip()
        for sentence in re.split(
            r"[.!?]+",
            text
        )
        if sentence.strip()
    ]

    sentence_count = max(
        len(sentences),
        1
    )

    average_sentence_length = (
        len(words) /
        sentence_count
    )

    if 8 <= average_sentence_length <= 24:

        sentence_score = 10

    elif (
        5 <= average_sentence_length < 8
        or
        24 < average_sentence_length <= 32
    ):

        sentence_score = 8

    elif (
        3 <= average_sentence_length < 5
        or
        32 < average_sentence_length <= 40
    ):

        sentence_score = 6

    else:

        sentence_score = 4

    filler_count = count_fillers(text)

    filler_rate = (
        filler_count /
        len(words)
    )

    if filler_rate <= 0.01:

        filler_score = 10

    elif filler_rate <= 0.03:

        filler_score = 8.5

    elif filler_rate <= 0.06:

        filler_score = 7

    elif filler_rate <= 0.10:

        filler_score = 5

    else:

        filler_score = 3

    repeated_words = 0

    for first, second in zip(
        words,
        words[1:]
    ):

        if first == second:

            repeated_words += 1

    penalty = min(
        repeated_words * 0.8,
        2.5
    )

    score = (
        sentence_score * 0.65
        +
        filler_score * 0.35
        -
        penalty
    )

    return round(
        max(0, min(10, score)),
        2
    )


# ============================================================
# CONFIDENCE INDICATOR
# ============================================================

def calculate_confidence(text, duration):

    words = get_words(text)

    if not words:

        return 0

    minutes = max(
        duration / 60,
        1 / 60
    )

    wpm = len(words) / minutes

    filler_count = count_fillers(text)

    filler_rate = (
        filler_count /
        len(words)
    )

    # Speaking speed
    if 120 <= wpm <= 160:

        pace_score = 10

    elif 100 <= wpm < 120 or 160 < wpm <= 180:

        pace_score = 8.5

    elif 80 <= wpm < 100 or 180 < wpm <= 200:

        pace_score = 7

    elif 60 <= wpm < 80 or 200 < wpm <= 220:

        pace_score = 5.5

    else:

        pace_score = 4

    # Fillers
    if filler_rate <= 0.01:

        filler_score = 10

    elif filler_rate <= 0.03:

        filler_score = 8.5

    elif filler_rate <= 0.06:

        filler_score = 7

    elif filler_rate <= 0.10:

        filler_score = 5

    else:

        filler_score = 3

    score = (
        pace_score * 0.65
        +
        filler_score * 0.35
    )

    return round(
        max(0, min(10, score)),
        2
    )


# ============================================================
# FEEDBACK
# ============================================================

def generate_feedback(
    text,
    confidence,
    clarity,
    vocabulary,
    relevance,
    wpm,
    fillers
):

    strengths = []
    improvements = []

    # Topic
    if relevance >= 7:

        strengths.append(
            "Your speech is reasonably related to the selected topic."
        )

    else:

        improvements.append(
            "Stay more focused on the selected topic."
        )

    # Vocabulary
    if vocabulary >= 7:

        strengths.append(
            "You used a reasonable variety of vocabulary."
        )

    else:

        improvements.append(
            "Use more varied and topic-specific vocabulary."
        )

    # Clarity
    if clarity >= 7:

        strengths.append(
            "Your sentence structure is reasonably clear."
        )

    else:

        improvements.append(
            "Use shorter and more complete sentences."
        )

    # Pace
    if 120 <= wpm <= 160:

        strengths.append(
            "Your speaking pace is in a comfortable range."
        )

    elif wpm < 120:

        improvements.append(
            "Try to maintain a slightly faster and continuous pace."
        )

    else:

        improvements.append(
            "Slow down slightly and use short pauses between ideas."
        )

    # Fillers
    if fillers == 0:

        strengths.append(
            "No common filler words were detected."
        )

    else:

        improvements.append(
            f"{fillers} filler word occurrence(s) were detected. "
            "Try to reduce them."
        )

    if not strengths:

        strengths.append(
            "Your speech contains analyzable content."
        )

    if not improvements:

        improvements.append(
            "Continue practicing and maintain the same consistency."
        )

    feedback = (
        "STRENGTHS\n"
        +
        "\n".join(
            "• " + item
            for item in strengths
        )
        +
        "\n\nAREAS TO IMPROVE\n"
        +
        "\n".join(
            "• " + item
            for item in improvements
        )
    )

    return feedback


# ============================================================
# COMPLETE SPEECH ANALYSIS
# ============================================================

def analyze_speech(
    transcript,
    topic,
    audience,
    duration
):

    transcript = transcript.strip()

    words = get_words(transcript)

    if not words:

        raise ValueError(
            "No speech text found."
        )

    word_count = len(words)

    duration = max(
        float(duration),
        1
    )

    wpm = (
        word_count /
        (duration / 60)
    )

    filler_count = count_fillers(
        transcript
    )

    confidence = calculate_confidence(
        transcript,
        duration
    )

    clarity = calculate_clarity(
        transcript
    )

    vocabulary = calculate_vocabulary(
        transcript
    )

    relevance = calculate_topic_relevance(
        transcript,
        topic
    )

    # Overall score
    overall = (
        confidence * 0.25
        +
        clarity * 0.25
        +
        vocabulary * 0.20
        +
        relevance * 0.30
    )

    feedback = generate_feedback(
        transcript,
        confidence,
        clarity,
        vocabulary,
        relevance,
        wpm,
        filler_count
    )

    scores = {
        "Confidence": confidence,
        "Clarity": clarity,
        "Vocabulary": vocabulary,
        "Topic Relevance": relevance
    }

    weak_area = min(
        scores,
        key=scores.get
    )

    return {
        "topic": topic,
        "audience": audience,
        "duration": round(duration, 2),
        "transcript": transcript,
        "word_count": word_count,
        "wpm": round(wpm, 1),
        "filler_count": filler_count,
        "confidence": round(confidence, 2),
        "clarity": round(clarity, 2),
        "vocabulary": round(vocabulary, 2),
        "topic_relevance": round(relevance, 2),
        "overall": round(overall, 2),
        "feedback": feedback,
        "weak_area": weak_area
    }


# ============================================================
# INITIALIZE
# ============================================================

init_database()

if "logged_in" not in st.session_state:

    st.session_state.logged_in = False

if "user" not in st.session_state:

    st.session_state.user = None

if "page" not in st.session_state:

    st.session_state.page = "Login"

if "analysis_result" not in st.session_state:

    st.session_state.analysis_result = None


# ============================================================
# SIDEBAR
# ============================================================

st.sidebar.title(
    "🎙️ Public Speaking Analyzer"
)

if st.session_state.logged_in:

    user = st.session_state.user

    st.sidebar.success(
        f"👤 {user['name']}"
    )

    pages = [
        "Dashboard",
        "New Practice Session",
        "My Sessions",
        "Compare Sessions",
        "Identify Weak Areas",
        "Profile"
    ]

    st.session_state.page = st.sidebar.radio(
        "Navigation",
        pages
    )

    if st.sidebar.button(
        "🚪 Logout",
        use_container_width=True
    ):

        st.session_state.logged_in = False
        st.session_state.user = None
        st.session_state.analysis_result = None
        st.session_state.page = "Login"

        st.rerun()

else:

    st.session_state.page = st.sidebar.radio(
        "Welcome",
        ["Login", "Register"]
    )


# ============================================================
# LOGIN
# ============================================================

if (
    not st.session_state.logged_in
    and
    st.session_state.page == "Login"
):

    st.title("🔐 Student Login")

    with st.form("login_form"):

        email = st.text_input(
            "Email"
        )

        password = st.text_input(
            "Password",
            type="password"
        )

        submit = st.form_submit_button(
            "Sign In",
            use_container_width=True
        )

    if submit:

        if not email or not password:

            st.error(
                "Please enter email and password."
            )

        else:

            user = authenticate_user(
                email,
                password
            )

            if user:

                st.session_state.logged_in = True
                st.session_state.user = user
                st.session_state.page = "Dashboard"

                st.rerun()

            else:

                st.error(
                    "Invalid email or password."
                )


# ============================================================
# REGISTER
# ============================================================

elif (
    not st.session_state.logged_in
    and
    st.session_state.page == "Register"
):

    st.title("📝 Student Registration")

    with st.form("register_form"):

        name = st.text_input(
            "Full Name"
        )

        email = st.text_input(
            "Email"
        )

        password = st.text_input(
            "Password",
            type="password"
        )

        confirm = st.text_input(
            "Confirm Password",
            type="password"
        )

        submit = st.form_submit_button(
            "Create Account",
            use_container_width=True
        )

    if submit:

        if not name or not email or not password:

            st.error(
                "All fields are required."
            )

        elif len(password) < 6:

            st.error(
                "Password must contain at least 6 characters."
            )

        elif password != confirm:

            st.error(
                "Passwords do not match."
            )

        else:

            success, message = register_user(
                name,
                email,
                password
            )

            if success:

                st.success(message)

                st.info(
                    "Now go to Login."
                )

            else:

                st.error(message)


# ============================================================
# DASHBOARD
# ============================================================

elif (
    st.session_state.logged_in
    and
    st.session_state.page == "Dashboard"
):

    st.title(
        "📊 Speaking Performance Dashboard"
    )

    sessions = get_user_sessions(
        st.session_state.user["id"]
    )

    if not sessions:

        st.info(
            "No speaking sessions yet. "
            "Go to New Practice Session."
        )

    else:

        df = pd.DataFrame(
            sessions
        )

        c1, c2, c3, c4, c5 = st.columns(5)

        c1.metric(
            "Sessions",
            len(df)
        )

        c2.metric(
            "Avg Confidence",
            f"{df['confidence'].mean():.2f}/10"
        )

        c3.metric(
            "Avg Clarity",
            f"{df['clarity'].mean():.2f}/10"
        )

        c4.metric(
            "Avg Vocabulary",
            f"{df['vocabulary'].mean():.2f}/10"
        )

        c5.metric(
            "Overall Average",
            f"{df['overall'].mean():.2f}/10"
        )

        st.divider()

        st.subheader(
            "📈 Performance Progress"
        )

        chart_df = df.sort_values(
            "id"
        ).copy()

        chart_df["Session"] = range(
            1,
            len(chart_df) + 1
        )

        chart_data = chart_df[
            [
                "Session",
                "confidence",
                "clarity",
                "vocabulary",
                "overall"
            ]
        ].melt(
            id_vars="Session",
            var_name="Metric",
            value_name="Score"
        )

        fig = px.line(
            chart_data,
            x="Session",
            y="Score",
            color="Metric",
            markers=True,
            range_y=[0, 10]
        )

        st.plotly_chart(
            fig,
            use_container_width=True
        )


# ============================================================
# NEW PRACTICE SESSION
# ============================================================

elif (
    st.session_state.logged_in
    and
    st.session_state.page == "New Practice Session"
):

    st.title(
        "🎙️ New Practice Session"
    )

    result = st.session_state.analysis_result

    # --------------------------------------------------------
    # RECORD SCREEN
    # --------------------------------------------------------

    if result is None:

        st.subheader(
            "📝 Practice Setup"
        )

        col1, col2 = st.columns(2)

        with col1:

            topic = st.text_input(
                "Speech Topic",
                value="Artificial Intelligence in Healthcare"
            )

        with col2:

            audience = st.selectbox(
                "Audience",
                [
                    "Classroom Peers (30-40 students)",
                    "Faculty Jury / Professor Panel",
                    "Conference & Seminar Audience",
                    "Team / Student Club Meeting",
                    "General Audience"
                ]
            )

        st.divider()

        st.subheader(
            "🎙️ Record Your Speech"
        )

        st.write(
            "Select the topic and speak about it. "
            "The application will analyze the actual speech "
            "transcribed from your microphone recording."
        )

        audio = st.audio_input(
            "🎙️ Start Recording"
        )

        duration = 0

        if audio is not None:

            duration = get_audio_duration(
                audio
            )

            if duration > 0:

                st.success(
                    f"Recording duration: "
                    f"{duration:.1f} seconds"
                )

        st.divider()

        st.subheader(
            "📝 Optional Transcript"
        )

        st.caption(
            "Normally leave this empty. "
            "If microphone transcription does not work, "
            "you can paste your exact transcript."
        )

        manual_transcript = st.text_area(
            "Transcript",
            height=150
        )

        st.divider()

        if st.button(
            "⚡ ANALYZE SPEECH",
            type="primary",
            use_container_width=True
        ):

            # ==================================================
            # IMPORTANT CHANGE
            # ==================================================
            # We DO NOT use a fake/default paragraph.
            # We first use the manually entered transcript.
            # If empty, we transcribe the actual recording.
            # ==================================================

            transcript = manual_transcript.strip()

            if not transcript:

                if audio is None:

                    st.error(
                        "Please record your speech first."
                    )

                    st.stop()

                with st.spinner(
                    "🎙️ Converting your actual speech into text..."
                ):

                    transcript, error = transcribe_audio(
                        audio
                    )

                if error:

                    st.error(error)

                    st.stop()

            if not transcript:

                st.error(
                    "No speech was detected."
                )

                st.stop()

            if duration <= 0:

                duration = max(
                    5,
                    len(get_words(transcript)) / 2
                )

            with st.spinner(
                "🔍 Analyzing your speech..."
            ):

                analysis = analyze_speech(
                    transcript,
                    topic,
                    audience,
                    duration
                )

            st.session_state.analysis_result = analysis

            st.rerun()

    # --------------------------------------------------------
    # RESULT SCREEN
    # --------------------------------------------------------

    else:

        st.subheader(
            "📋 Speech Analysis Result"
        )

        st.success(
            "Speech analysis completed."
        )

        st.markdown(
            f"### 🎯 Topic: {result['topic']}"
        )

        st.write(
            f"**Audience:** {result['audience']}"
        )

        st.write(
            f"**Duration:** {result['duration']:.1f} seconds"
        )

        st.divider()

        st.subheader(
            "📝 Actual Speech Detected"
        )

        st.text_area(
            "Transcript",
            value=result["transcript"],
            height=180,
            disabled=True
        )

        st.divider()

        c1, c2, c3, c4 = st.columns(4)

        c1.metric(
            "Confidence",
            f"{result['confidence']:.2f}/10"
        )

        c2.metric(
            "Clarity",
            f"{result['clarity']:.2f}/10"
        )

        c3.metric(
            "Vocabulary",
            f"{result['vocabulary']:.2f}/10"
        )

        c4.metric(
            "Topic Relevance",
            f"{result['topic_relevance']:.2f}/10"
        )

        st.metric(
            "⭐ Overall Score",
            f"{result['overall']:.2f}/10"
        )

        st.divider()

        c1, c2, c3 = st.columns(3)

        c1.metric(
            "Word Count",
            result["word_count"]
        )

        c2.metric(
            "Speaking Rate",
            f"{result['wpm']:.1f} WPM"
        )

        c3.metric(
            "Filler Words",
            result["filler_count"]
        )

        st.divider()

        st.subheader(
            "🤖 Automatic Feedback"
        )

        st.text(
            result["feedback"]
        )

        st.warning(
            "Note: Confidence is calculated from transcript-based "
            "indicators such as speaking rate and filler frequency. "
            "It does not directly measure pitch, volume, pronunciation "
            "or body language."
        )

        st.write(
            f"**Weakest Area:** {result['weak_area']}"
        )

        st.divider()

        col1, col2 = st.columns(2)

        with col1:

            if st.button(
                "💾 SAVE SESSION",
                type="primary",
                use_container_width=True
            ):

                save_session(
                    st.session_state.user["id"],
                    result
                )

                st.session_state.analysis_result = None

                st.success(
                    "Session saved successfully."
                )

                st.rerun()

        with col2:

            if st.button(
                "🔄 RECORD AGAIN",
                use_container_width=True
            ):

                st.session_state.analysis_result = None

                st.rerun()


# ============================================================
# MY SESSIONS
# ============================================================

elif (
    st.session_state.logged_in
    and
    st.session_state.page == "My Sessions"
):

    st.title(
        "📋 My Speaking Sessions"
    )

    sessions = get_user_sessions(
        st.session_state.user["id"]
    )

    if not sessions:

        st.info(
            "No saved sessions."
        )

    else:

        df = pd.DataFrame(
            sessions
        )

        display_df = df[
            [
                "created_at",
                "topic",
                "duration",
                "word_count",
                "wpm",
                "confidence",
                "clarity",
                "vocabulary",
                "topic_relevance",
                "overall"
            ]
        ].copy()

        display_df.columns = [
            "Date",
            "Topic",
            "Duration",
            "Words",
            "WPM",
            "Confidence",
            "Clarity",
            "Vocabulary",
            "Topic Relevance",
            "Overall"
        ]

        st.dataframe(
            display_df,
            use_container_width=True,
            hide_index=True
        )

        st.divider()

        selected_id = st.selectbox(
            "Select Session",
            [
                session["id"]
                for session in sessions
            ]
        )

        selected = next(
            session
            for session in sessions
            if session["id"] == selected_id
        )

        st.subheader(
            f"🎯 {selected['topic']}"
        )

        st.text_area(
            "Transcript",
            value=selected["transcript"],
            height=160,
            disabled=True
        )

        c1, c2, c3, c4 = st.columns(4)

        c1.metric(
            "Confidence",
            f"{selected['confidence']:.2f}"
        )

        c2.metric(
            "Clarity",
            f"{selected['clarity']:.2f}"
        )

        c3.metric(
            "Vocabulary",
            f"{selected['vocabulary']:.2f}"
        )

        c4.metric(
            "Overall",
            f"{selected['overall']:.2f}"
        )

        st.subheader(
            "Feedback"
        )

        st.text(
            selected["feedback"]
        )

        if st.button(
            "🗑️ Delete Session"
        ):

            delete_session(
                selected["id"],
                st.session_state.user["id"]
            )

            st.success(
                "Session deleted."
            )

            st.rerun()


# ============================================================
# COMPARE SESSIONS
# ============================================================

elif (
    st.session_state.logged_in
    and
    st.session_state.page == "Compare Sessions"
):

    st.title(
        "⚖️ Compare Sessions"
    )

    sessions = get_user_sessions(
        st.session_state.user["id"]
    )

    if len(sessions) < 2:

        st.info(
            "You need at least 2 saved sessions."
        )

    else:

        options = {
            f"#{s['id']} - {s['topic']}":
            s
            for s in sessions
        }

        labels = list(
            options.keys()
        )

        col1, col2 = st.columns(2)

        with col1:

            first_label = st.selectbox(
                "Session 1",
                labels,
                index=0
            )

        with col2:

            second_label = st.selectbox(
                "Session 2",
                labels,
                index=1
            )

        first = options[first_label]
        second = options[second_label]

        if first["id"] == second["id"]:

            st.warning(
                "Please select two different sessions."
            )

        else:

            comparison = pd.DataFrame({
                "Metric": [
                    "Confidence",
                    "Clarity",
                    "Vocabulary",
                    "Topic Relevance",
                    "Overall"
                ],
                "Session 1": [
                    first["confidence"],
                    first["clarity"],
                    first["vocabulary"],
                    first["topic_relevance"],
                    first["overall"]
                ],
                "Session 2": [
                    second["confidence"],
                    second["clarity"],
                    second["vocabulary"],
                    second["topic_relevance"],
                    second["overall"]
                ]
            })

            comparison["Difference"] = (
                comparison["Session 2"]
                -
                comparison["Session 1"]
            ).round(2)

            st.dataframe(
                comparison,
                use_container_width=True,
                hide_index=True
            )


# ============================================================
# WEAK AREAS
# ============================================================

elif (
    st.session_state.logged_in
    and
    st.session_state.page == "Identify Weak Areas"
):

    st.title(
        "🎯 Identify Weak Areas"
    )

    sessions = get_user_sessions(
        st.session_state.user["id"]
    )

    if not sessions:

        st.info(
            "No saved sessions."
        )

    else:

        df = pd.DataFrame(
            sessions
        )

        scores = {
            "Confidence": df["confidence"].mean(),
            "Clarity": df["clarity"].mean(),
            "Vocabulary": df["vocabulary"].mean(),
            "Topic Relevance": df["topic_relevance"].mean()
        }

        weakest = min(
            scores,
            key=scores.get
        )

        st.warning(
            f"Current lowest average: "
            f"{weakest} - {scores[weakest]:.2f}/10"
        )

        score_df = pd.DataFrame({
            "Metric": list(scores.keys()),
            "Score": list(scores.values())
        })

        fig = px.bar(
            score_df,
            x="Metric",
            y="Score",
            range_y=[0, 10],
            text_auto=".2f"
        )

        st.plotly_chart(
            fig,
            use_container_width=True
        )


# ============================================================
# PROFILE
# ============================================================

elif (
    st.session_state.logged_in
    and
    st.session_state.page == "Profile"
):

    st.title(
        "👤 Student Profile"
    )

    user = st.session_state.user

    sessions = get_user_sessions(
        user["id"]
    )

    st.write(
        f"**Name:** {user['name']}"
    )

    st.write(
        f"**Email:** {user['email']}"
    )

    st.write(
        f"**Student ID:** #{user['id']}"
    )

    if sessions:

        df = pd.DataFrame(
            sessions
        )

        c1, c2, c3 = st.columns(3)

        c1.metric(
            "Sessions",
            len(df)
        )

        c2.metric(
            "Total Speaking Time",
            f"{df['duration'].sum() / 60:.1f} min"
        )

        c3.metric(
            "Overall Average",
            f"{df['overall'].mean():.2f}/10"
        )

    else:

        st.info(
            "No sessions available yet."
        )


# ============================================================
# FOOTER
# ============================================================

st.divider()

st.caption(
    "Public Speaking Analyzer | Streamlit | "
    "Speech-to-Text + Speech Analytics"
)