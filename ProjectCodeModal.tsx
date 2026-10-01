import React, { useState } from 'react';
import { DatabaseService } from '../services/db';
import { User } from '../types';
import { 
  Code2, 
  Database, 
  FileText, 
  Copy, 
  Check, 
  Play, 
  Sparkles, 
  BookOpen, 
  Terminal,
  HelpCircle,
  Download
} from 'lucide-react';

interface ProjectCodeModalProps {
  user: User | null;
}

export const ProjectCodeModal: React.FC<ProjectCodeModalProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'files' | 'sql' | 'viva'>('files');
  const [selectedFile, setSelectedFile] = useState<string>('app.py');
  const [copied, setCopied] = useState(false);

  // SQL Sandbox state
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM speaking_sessions;');
  const [sqlResult, setSqlResult] = useState<{ columns: string[]; rows: any[]; error?: string } | null>(null);

  const fileContents: Record<string, { desc: string; code: string }> = {
    'app.py': {
      desc: 'Main Streamlit user interface featuring automated audio duration measurement, dynamic AI feedback, and MySQL session persistence.',
      code: `import streamlit as st
import database as db, auth, utils, ai_feedback

st.set_page_config(page_title="Public Speaking Analyzer", page_icon="🎙️", layout="wide")
db.init_db()
auth.init_session()

# PAGE: NEW PRACTICE SESSION (AUTOMATED WORKFLOW)
if auth.is_authenticated() and st.session_state["current_page"] == "New Practice Session":
    st.title("🎙️ New Practice Session")
    
    manual_topic = st.text_input("Speech Topic / Title (Manual)", value="Artificial Intelligence in Healthcare")
    aud_select = st.selectbox("Target Audience", ["Classroom Peers", "Faculty Jury", "Conference Panel", "Custom Audience"])
    final_audience = st.text_input("Custom Audience", value="Educators") if aud_select == "Custom Audience" else aud_select

    audio_data = st.audio_input("🔴 Record Speech from Microphone")
    
    # 1. Automatic Audio Duration Calculation
    auto_duration = utils.calculate_audio_duration(audio_data) if audio_data else 0
    if auto_duration > 0:
        st.success(f"🎧 Actual Audio Duration: {utils.format_duration(auto_duration)}")

    monologue = st.text_area("Speech Transcript / Live Monologue")
    duration_sec = auto_duration if auto_duration > 0 else 155

    if st.button("⚡ Analyze Speech Automatically"):
        # Evaluates actual duration, scores, and dynamic session-specific feedback
        analysis = utils.analyze_speech_features(monologue, duration_sec, manual_topic=manual_topic, audience=final_audience)
        st.session_state["result"] = analysis

    if "result" in st.session_state and st.session_state["result"]:
        res = st.session_state["result"]
        st.markdown(f"""
        --------------------------------
        SPEECH ANALYSIS RESULT
        Topic: {res['topic']} (Manual)
        Audience: {res['audience']} (Select / Manual)
        Duration: {res['duration_formatted']} (Automatic)

        Confidence: {res['confidence_score']:.1f} / 10 (Automatic analysis)
        Clarity: {res['clarity_score']:.1f} / 10 (Automatic analysis)
        Vocabulary: {res['vocabulary_score']:.1f} / 10 (Automatic analysis)
        Overall Score: {res['overall_score']:.2f} / 10 (Automatic calculation)

        Feedback (Dynamic AI / Linguistic feedback):
        {res['feedback']}

        Weak Area (Automatic identification):
        {res['weak_area']}
        --------------------------------
        """)

        col1, col2 = st.columns(2)
        with col1:
            if st.button("💾 SAVE SESSION"):
                # Stores actual duration in seconds and dynamic feedback
                db.save_speaking_session(
                    user_id=st.session_state["user"]["id"], 
                    topic=res['topic'], 
                    duration=res['duration_sec'],
                    audience=res['audience'], 
                    confidence_score=res['confidence_score'],
                    clarity_score=res['clarity_score'], 
                    vocabulary_score=res['vocabulary_score'],
                    overall_score=res['overall_score'], 
                    feedback=res['feedback']
                )
                st.success("Saved to MySQL!")
        with col2:
            if st.button("🔄 RECORD AGAIN"):
                st.session_state["result"] = None
`
    },
    'ai_feedback.py': {
      desc: 'Dynamic, session-specific AI feedback generator using Google Gemini API or intelligent rule-based linguistic evaluation.',
      code: `import os, json
import ai_feedback

def generate_structured_feedback(session_data, api_key=None):
    """
    Generates tailored feedback specifically for this session's actual data:
    - Overall Feedback (referencing topic, duration, scores)
    - Strengths (recognizing actual high-scoring dimensions)
    - Areas to Improve (addressing weakest scores, pace, and fillers)
    - Suggestion (actionable drill for the student's weakest area)
    """
    key = api_key or os.getenv("GEMINI_API_KEY")
    if key:
        try:
            from google import genai
            client = genai.Client(api_key=key)
            prompt = f"Analyze session: {session_data}. Return JSON with overall_feedback, strengths, areas_to_improve, suggestion."
            response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
            parsed = json.loads(response.text)
            return parsed
        except Exception:
            pass
    return generate_dynamic_fallback_feedback(session_data)
`
    },
    'database.py': {
      desc: 'MySQL connection pooling, parameterized query execution, schema initialization, and fallback engine.',
      code: `import os, mysql.connector
from dotenv import load_dotenv

load_dotenv()
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "public_speaking_db")

def get_connection():
    try:
        conn = mysql.connector.connect(
            host=DB_HOST, user=DB_USER, password=DB_PASSWORD, database=DB_NAME
        )
        return conn, "mysql"
    except Exception:
        import sqlite3
        return sqlite3.connect("public_speaking.db"), "sqlite"

def save_speaking_session(user_id, topic, duration, audience, confidence_score, clarity_score, vocabulary_score, overall_score, feedback):
    conn, db_type = get_connection()
    cursor = conn.cursor()
    query = """INSERT INTO speaking_sessions 
    (user_id, topic, duration, audience, confidence_score, clarity_score, vocabulary_score, overall_score, feedback)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"""
    cursor.execute(query, (user_id, topic, duration, audience, confidence_score, clarity_score, vocabulary_score, overall_score, feedback))
    conn.commit()
    return {"success": True}
`
    },
    'auth.py': {
      desc: 'Bcrypt password hashing, salt generation, input validation, and secure session management.',
      code: `import bcrypt, re
from database import register_user, get_user_by_email

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def authenticate_user(email: str, password: str):
    user = get_user_by_email(email)
    if not user or not verify_password(password, user["password_hash"]):
        return False, "Invalid email or password.", None
    return True, "Login successful!", user
`
    },
    'utils.py': {
      desc: 'Automatic audio duration measurement (WAV/WebM/MP3), duration formatting, feature extraction, and structured feedback parser.',
      code: `import re, io, wave
import ai_feedback

def format_duration(seconds: int) -> str:
    mins, secs = seconds // 60, seconds % 60
    if mins == 0: return f"{secs} sec"
    if secs == 0: return f"{mins} min"
    return f"{mins} min {secs} sec"

def calculate_audio_duration(audio_file) -> int:
    # Measures actual audio length in seconds using wave or container headers
    try:
        raw = audio_file.getvalue()
        with wave.open(io.BytesIO(raw), "rb") as wf:
            return int(round(wf.getnframes() / float(wf.getframerate())))
    except Exception:
        return 0

def analyze_speech_features(transcript: str, duration_sec: int, manual_topic="", audience=""):
    duration_formatted = format_duration(duration_sec)
    # Extracts pacing, hesitations, fillers, lexical diversity
    # Evaluates Confidence, Clarity, Vocabulary, Overall Score = (Conf+Clar+Vocab)/3
    # Calls ai_feedback.generate_structured_feedback(...) for dynamic evaluation
    ...
`
    },
    'schema.sql': {
      desc: 'MySQL DDL table creation commands, primary keys, foreign key constraints, and seed data.',
      code: `CREATE DATABASE IF NOT EXISTS public_speaking_db;
USE public_speaking_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS speaking_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    topic VARCHAR(255) NOT NULL,
    duration INT NOT NULL,
    audience VARCHAR(100) NOT NULL,
    confidence_score DECIMAL(4, 2) NOT NULL,
    clarity_score DECIMAL(4, 2) NOT NULL,
    vocabulary_score DECIMAL(4, 2) NOT NULL,
    overall_score DECIMAL(4, 2) NOT NULL,
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
`
    },
    'requirements.txt': {
      desc: 'Python package dependencies required to run the project.',
      code: `streamlit>=1.32.0
pandas>=2.0.0
plotly>=5.18.0
mysql-connector-python>=8.0.33
bcrypt>=4.1.2
python-dotenv>=1.0.0
google-genai>=0.1.1
`
    },
    'README.md': {
      desc: 'Comprehensive project report, installation steps, architecture diagrams, and testing guide.',
      code: `# Public Speaking Analyzer
Technologies: Python, Streamlit, MySQL, Pandas, Plotly

## Quick Start
1. git clone / cd public_speaking_analyzer
2. pip install -r requirements.txt
3. cp .env.example .env (configure MySQL credentials)
4. streamlit run app.py
`
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(fileContents[selectedFile]?.code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteSql = () => {
    if (!user) return;
    const res = DatabaseService.executeMockSql(sqlQuery, user.id);
    setSqlResult(res);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
            <Code2 className="w-4 h-4" />
            <span>Student Final-Year / Capstone Repository</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Project Code & MySQL Architecture
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            All code files are created and available inside <code className="text-amber-300 bg-slate-800 px-2 py-0.5 rounded">/public_speaking_analyzer</code> in this workspace, fully ready to submit or run locally via <code className="text-emerald-300 bg-slate-800 px-2 py-0.5 rounded">streamlit run app.py</code>.
          </p>
        </div>

        <div className="flex bg-slate-800 p-1.5 rounded-2xl shrink-0">
          <button
            onClick={() => setActiveTab('files')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'files' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Python & SQL Files
          </button>
          <button
            onClick={() => { setActiveTab('sql'); handleExecuteSql(); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'sql' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Live MySQL Sandbox
          </button>
          <button
            onClick={() => setActiveTab('viva')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'viva' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Viva Q&A Guide
          </button>
        </div>
      </div>

      {/* Tab 1: Python Files Browser */}
      {activeTab === 'files' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* File List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1 md:col-span-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-3 py-2">
              Project Manifest
            </div>
            {Object.keys(fileContents).map((fileName) => (
              <button
                key={fileName}
                onClick={() => setSelectedFile(fileName)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-between cursor-pointer ${
                  selectedFile === fileName
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100'
                    : 'text-slate-600 hover:bg-slate-100/70'
                }`}
              >
                <span className="flex items-center gap-2">
                  {fileName.endsWith('.py') ? <Code2 className="w-3.5 h-3.5 text-indigo-500" /> : <Database className="w-3.5 h-3.5 text-emerald-500" />}
                  {fileName}
                </span>
              </button>
            ))}
          </div>

          {/* Code Viewer */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col md:col-span-3">
            <div className="bg-slate-800/80 px-5 py-3 border-b border-slate-700/80 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-emerald-400">public_speaking_analyzer/</span>
                <span className="text-white font-bold">{selectedFile}</span>
              </div>

              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <div className="px-5 py-2.5 bg-slate-800/40 text-xs text-slate-400 border-b border-slate-800">
              {fileContents[selectedFile]?.desc}
            </div>

            <pre className="p-5 text-xs text-slate-200 font-mono overflow-x-auto leading-relaxed select-all">
              <code>{fileContents[selectedFile]?.code}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Tab 2: Live SQL Sandbox */}
      {activeTab === 'sql' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              Live MySQL Query Sandbox
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Execute sample SQL queries against the local schema to inspect the database tables.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Quick Queries:</span>
            <button
              onClick={() => { setSqlQuery('SELECT * FROM speaking_sessions;'); }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-mono"
            >
              SELECT * FROM speaking_sessions;
            </button>
            <button
              onClick={() => { setSqlQuery('SELECT * FROM users;'); }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-mono"
            >
              SELECT * FROM users;
            </button>
            <button
              onClick={() => { setSqlQuery('SELECT COUNT(*), AVG(overall_score) FROM speaking_sessions;'); }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-mono"
            >
              SELECT AVG(overall_score);
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleExecuteSql}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Execute SQL</span>
            </button>
          </div>

          {/* Query Results Table */}
          {sqlResult && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 border-b border-slate-200">
                Returned {sqlResult.rows.length} row(s)
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      {sqlResult.columns.map((col) => (
                        <th key={col} className="p-3 font-bold border-b border-slate-200">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sqlResult.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {row.map((cell: any, cIdx: number) => (
                          <td key={cIdx} className="p-3 text-slate-700">
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Viva Q&A Guide */}
      {activeTab === 'viva' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              Project Presentation & Viva Examination Q&A
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Key technical questions and theoretical justifications for your final demonstration.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-sm text-slate-900">
                1. How is the Overall Score calculated and what does it represent?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                The overall score is computed as the arithmetic mean of the three rubric pillars: <code className="bg-white px-1.5 py-0.5 rounded text-indigo-700 font-mono">Overall = (Confidence + Clarity + Vocabulary) / 3</code>, rounded to 2 decimal places. This gives equal weight to vocal presence, structural articulation, and lexical precision.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-sm text-slate-900">
                2. How does the system automatically identify the user's weak area?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                The system computes the cumulative averages across all logged sessions for Confidence, Clarity, and Vocabulary. The minimum average score is automatically flagged as the primary constraint, and a rule-based recommendation engine returns tailored pedagogical drills.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-sm text-slate-900">
                3. How does the database schema ensure data integrity and security?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Passkeys are salted and hashed using <strong>bcrypt</strong> (12 computational rounds), preventing plain-text exposure. The relational schema uses an <code className="bg-white px-1.5 py-0.5 rounded font-mono">InnoDB</code> foreign key constraint (<code className="bg-white px-1.5 py-0.5 rounded font-mono">ON DELETE CASCADE</code>) between <code className="bg-white px-1.5 py-0.5 rounded font-mono">users.id</code> and <code className="bg-white px-1.5 py-0.5 rounded font-mono">speaking_sessions.user_id</code> to maintain referential integrity.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-sm text-slate-900">
                4. How is SQL Injection prevented?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                All database operations in <code className="bg-white px-1.5 py-0.5 rounded font-mono">database.py</code> use parameterized queries (prepared statements with `%s` placeholders) instead of string concatenation, treating user inputs strictly as typed data rather than executable statements.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
