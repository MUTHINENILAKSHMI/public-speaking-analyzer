# Public Speaking Analyzer

An end-to-end Python & Streamlit web application designed for students and public speakers to evaluate their speaking practice sessions, monitor skill progression over time, diagnose weak areas, compare presentations side-by-side, and receive actionable feedback.

---

## Table of Contents
1. [Project Overview & Architecture](#project-overview--architecture)
2. [Technology Stack](#technology-stack)
3. [Database Design & SQL Commands](#database-design--sql-commands)
4. [Project Structure](#project-structure)
5. [Installation & Setup Guide](#installation--setup-guide)
6. [Running the Application](#running-the-application)
7. [Sample Test Cases & Credentials](#sample-test-cases--credentials)
8. [File-by-File Implementation Breakdown](#file-by-file-implementation-breakdown)
9. [Troubleshooting Common Issues](#troubleshooting-common-issues)
10. [Student Project Presentation / Viva Q&A Guide](#student-project-presentation--viva-qa-guide)

---

## 1. Project Overview & Architecture

### Problem Statement
Public speaking is a critical collegiate and professional skill, yet students rarely receive structured, quantitative feedback on their practice rehearsals. This application provides:
- **Session Tracking**: Log duration, audience, topic, and granular rubric scores (Confidence, Clarity, Vocabulary).
- **Automated Score Calculations**: Computes Overall Score as $\frac{\text{Confidence} + \text{Clarity} + \text{Vocabulary}}{3}$, rounded to 2 decimal places.
- **Analytics Dashboard**: Dynamic Plotly charts showing score trajectory over time and pillar benchmarks.
- **Weak Area Diagnosis**: Automatically identifies the speaker's lowest score dimension and generates targeted drills.
- **Session Comparison**: Side-by-side delta analysis comparing baseline vs subsequent sessions with percentage improvement calculations.
- **AI Speech Feedback**: Optional generative speech analysis for filler words ("um", "like"), vocabulary richness, and syntax.

### System Architecture Diagram
```
+-------------------------------------------------------------+
|                     Streamlit Frontend UI                   |
|  (Dashboard, Forms, Charts, Comparisons, Diagnostic Panels) |
+-------------------------------------------------------------+
                              |
       +----------------------+----------------------+
       |                                             |
       v                                             v
+------------------+                          +--------------+
|  auth.py Module  |                          |   utils.py   |
| (Bcrypt Hashing, |                          | (Plotly,     |
| Session State)   |                          |  Math/Stats) |
+------------------+                          +--------------+
       |                                             |
       +----------------------+----------------------+
                              |
                              v
                   +---------------------+
                   |     database.py     |
                   | (MySQL / Connector) |
                   +---------------------+
                              |
                              v
                   +---------------------+
                   |   MySQL Database    |
                   | (users & sessions)  |
                   +---------------------+
```

---

## 2. Technology Stack

- **Language:** Python 3.10+
- **Frontend Framework:** Streamlit
- **Database Engine:** MySQL 8.0+ (with SQLite fallback for instant offline execution)
- **Data Manipulation:** Pandas
- **Data Visualization:** Plotly Express & Plotly Graph Objects
- **Security:** Bcrypt password hashing
- **Environment Management:** Python-Dotenv
- **AI Engine (Optional):** Google Gemini API (`@google/genai` / `google-genai`)

---

## 3. Database Design & SQL Commands

### Entity Relationship
- `users (1) <----> (N) speaking_sessions`
- Foreign Key: `speaking_sessions.user_id` references `users.id` with `ON DELETE CASCADE`.

### SQL Schema (`schema.sql`)
Run the following SQL commands in your MySQL Workbench, phpMyAdmin, or MySQL CLI:

```sql
CREATE DATABASE IF NOT EXISTS `public_speaking_db`
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `public_speaking_db`;

-- Users Table
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Speaking Sessions Table
CREATE TABLE IF NOT EXISTS `speaking_sessions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `topic` VARCHAR(255) NOT NULL,
    `duration` INT NOT NULL COMMENT 'Duration in minutes',
    `audience` VARCHAR(100) NOT NULL,
    `confidence_score` DECIMAL(4, 2) NOT NULL,
    `clarity_score` DECIMAL(4, 2) NOT NULL,
    `vocabulary_score` DECIMAL(4, 2) NOT NULL,
    `overall_score` DECIMAL(4, 2) NOT NULL,
    `feedback` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_created` (`user_id`, `created_at`),
    CONSTRAINT `fk_speaking_sessions_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 4. Project Structure

```
public_speaking_analyzer/
│
├── app.py                  # Main Streamlit web application & multi-page navigation
├── database.py             # Database connections, queries, and CRUD operations
├── auth.py                 # Bcrypt password hashing, validation & session state
├── utils.py                # Mathematical scoring, weak area diagnosis & Plotly charts
├── ai_feedback.py          # Optional AI speech transcript evaluation engine
├── schema.sql              # MySQL DDL table creation and seed data
├── requirements.txt        # Python dependency manifest
├── .env.example            # Environment template for MySQL credentials
└── README.md               # Student project documentation
```

---

## 5. Installation & Setup Guide

### Step 1: Clone or Navigate to the Directory
```bash
cd public_speaking_analyzer
```

### Step 2: Create a Python Virtual Environment
```bash
# On Windows
python -m venv venv
venv\Scripts\activate

# On macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Required Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Configure Database Credentials
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and set your MySQL username and password:
   ```ini
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=public_speaking_db
   ```
*(Note: If MySQL is not running on your computer, the application automatically uses a local SQLite database so you can test immediately without setup errors!)*

---

## 6. Running the Application

Execute the following command in your terminal:
```bash
streamlit run app.py
```
Streamlit will launch and open the application in your default browser at `http://localhost:8501`.

---

## 7. Sample Test Cases & Credentials

### Pre-configured Demo Account
- **Email:** `demo@student.edu`
- **Password:** `password123`

### Test Case 1: New Session Input Validation
- **Input:** Blank topic, duration = -5.
- **Expected Result:** Validation alert prevents submission and highlights error fields.

### Test Case 2: Overall Score Formula Verification
- **Input:** Confidence = 8.0, Clarity = 7.0, Vocabulary = 9.0.
- **Calculation:** $(8.0 + 7.0 + 9.0) / 3 = 24.0 / 3 = 8.00$.
- **Expected Result:** Displayed overall score = `8.00`.

### Test Case 3: Weak Area Diagnosis
- **Input:** Confidence = 9.0, Clarity = 5.5, Vocabulary = 8.0.
- **Expected Result:** System flags: *"Your weak area is Clarity."* and displays pacing and articulation exercises.

### Test Case 4: Session Comparison & Delta
- **Select:** Session A (Overall 6.83) vs Session B (Overall 8.33).
- **Expected Result:** Difference = `+1.50 (+22.0%)` with **Improved** badge.

---

## 8. File-by-File Implementation Breakdown

1. **`app.py`**: The UI presentation layer containing all page views (Login, Registration, Dashboard, New Practice Session, My Sessions, Compare Sessions, Identify Weak Areas, AI Speech Feedback, Profile).
2. **`database.py`**: Manages MySQL connection pools, prepared statements, and CRUD execution (`save_speaking_session`, `get_user_sessions`, `register_user`, etc.).
3. **`auth.py`**: Handles user authentication, password salt generation, bcrypt hash verification, and Streamlit session states.
4. **`utils.py`**: Implements business logic including score averaging, weak-area detection algorithms, and interactive Plotly figures.
5. **`ai_feedback.py`**: Provides speech transcript processing via Gemini or offline local NLP parsing (filler words, word repetition, lexical diversity).

---

## 9. Troubleshooting Common Issues

| Error | Root Cause | Solution |
|---|---|---|
| `Access denied for user 'root'@'localhost'` | Incorrect MySQL password | Update `DB_PASSWORD` in `.env` to match your MySQL server password. |
| `Can't connect to MySQL server` | MySQL server is stopped | Start MySQL via XAMPP, MySQL Workbench, or `brew services start mysql`. The app will also fallback to SQLite automatically. |
| `ModuleNotFoundError: No module named 'streamlit'` | Virtual environment not activated | Activate virtual environment (`venv\Scripts\activate`) and run `pip install -r requirements.txt`. |
| `Duplicate entry '...' for key 'email'` | Account already registered | Sign in with that email or use a different email address. |

---

## 10. Student Project Presentation / Viva Q&A Guide

**Q1: Why did you choose bcrypt for password storage?**
> Plain-text passwords risk catastrophic exposure if a database leak occurs. Bcrypt incorporates a unique random salt and deliberate computational cost (rounds), protecting against rainbow table and brute-force attacks.

**Q2: How does the application prevent SQL Injection?**
> All queries in `database.py` use parameterized queries (prepared statements with `%s` or `?` placeholders) instead of string concatenation. User input is treated strictly as data, never as executable SQL.

**Q3: How is the Overall Score calculated?**
> The overall score is calculated as the arithmetic mean of Confidence, Clarity, and Vocabulary: $\frac{\text{Confidence} + \text{Clarity} + \text{Vocabulary}}{3}$, rounded to 2 decimal places to ensure precision.

**Q4: How does the session comparison work?**
> The system takes two session objects (baseline and subsequent), computes the arithmetic delta and relative percentage change $\frac{B - A}{A} \times 100\%$, and dynamically tags each dimension as Improved, Decreased, or Remained the Same.
