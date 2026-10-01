"""
Database Module for Public Speaking Analyzer
Handles database connections, parameterized queries, and CRUD operations.
Supports MySQL with automatic graceful fallback to local SQLite for seamless testing.
"""

import os
import sqlite3
from typing import Dict, Any, List, Optional
try:
    import mysql.connector
    from mysql.connector import Error as MySQLError
except ImportError:
    mysql = None
    MySQLError = Exception

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Database configuration parameters
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "public_speaking_db")

SQLITE_FALLBACK_FILE = "public_speaking_fallback.db"

def get_connection():
    """
    Attempts to establish a connection to MySQL.
    If MySQL is unavailable, falls back to SQLite so the app can run smoothly.
    Returns (connection, db_type) tuple.
    """
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            charset="utf8mb4"
        )
        if conn.is_connected():
            return conn, "mysql"
    except MySQLError as err:
        # Fallback to local SQLite if MySQL is not reachable or not yet configured
        pass

    # SQLite fallback
    conn = sqlite3.connect(SQLITE_FALLBACK_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn, "sqlite"

def init_db():
    """
    Initializes required database tables (users and speaking_sessions)
    if they do not already exist.
    """
    conn, db_type = get_connection()
    cursor = conn.cursor()

    try:
        if db_type == "mysql":
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(191) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            cursor.execute("""
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
                INDEX (user_id, created_at),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
        else:
            # SQLite syntax
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS speaking_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                topic TEXT NOT NULL,
                duration INTEGER NOT NULL,
                audience TEXT NOT NULL,
                confidence_score REAL NOT NULL,
                clarity_score REAL NOT NULL,
                vocabulary_score REAL NOT NULL,
                overall_score REAL NOT NULL,
                feedback TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
        conn.commit()
    except Exception as e:
        print(f"Error initializing database: {e}")
    finally:
        cursor.close()
        conn.close()

def register_user(name: str, email: str, password_hash: str) -> Dict[str, Any]:
    """
    Registers a new user in the database using parameterized queries.
    """
    conn, db_type = get_connection()
    cursor = conn.cursor(dictionary=True) if db_type == "mysql" else conn.cursor()

    try:
        placeholder = "%s" if db_type == "mysql" else "?"
        query = f"INSERT INTO users (name, email, password_hash) VALUES ({placeholder}, {placeholder}, {placeholder})"
        cursor.execute(query, (name.strip(), email.strip().lower(), password_hash))
        conn.commit()
        user_id = cursor.lastrowid
        return {"success": True, "user_id": user_id, "message": "User registered successfully."}
    except Exception as e:
        error_msg = str(e)
        if "Duplicate entry" in error_msg or "UNIQUE constraint failed" in error_msg:
            return {"success": False, "message": "An account with this email already exists."}
        return {"success": False, "message": f"Database error: {error_msg}"}
    finally:
        cursor.close()
        conn.close()

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a user record by email address.
    """
    conn, db_type = get_connection()
    cursor = conn.cursor(dictionary=True) if db_type == "mysql" else conn.cursor()

    try:
        placeholder = "%s" if db_type == "mysql" else "?"
        query = f"SELECT id, name, email, password_hash, created_at FROM users WHERE email = {placeholder}"
        cursor.execute(query, (email.strip().lower(),))
        row = cursor.fetchone()
        if row is None:
            return None
        if db_type == "sqlite":
            return dict(row)
        return row
    finally:
        cursor.close()
        conn.close()

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Retrieves a user record by ID.
    """
    conn, db_type = get_connection()
    cursor = conn.cursor(dictionary=True) if db_type == "mysql" else conn.cursor()

    try:
        placeholder = "%s" if db_type == "mysql" else "?"
        query = f"SELECT id, name, email, created_at FROM users WHERE id = {placeholder}"
        cursor.execute(query, (user_id,))
        row = cursor.fetchone()
        if row is None:
            return None
        if db_type == "sqlite":
            return dict(row)
        return row
    finally:
        cursor.close()
        conn.close()

def save_speaking_session(
    user_id: int,
    topic: str,
    duration: int,
    audience: str,
    confidence_score: float,
    clarity_score: float,
    vocabulary_score: float,
    overall_score: float,
    feedback: str
) -> Dict[str, Any]:
    """
    Saves a new speaking practice session into the database.
    """
    conn, db_type = get_connection()
    cursor = conn.cursor(dictionary=True) if db_type == "mysql" else conn.cursor()

    try:
        placeholder = "%s" if db_type == "mysql" else "?"
        query = f"""
        INSERT INTO speaking_sessions 
        (user_id, topic, duration, audience, confidence_score, clarity_score, vocabulary_score, overall_score, feedback)
        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
        """
        params = (
            user_id,
            topic.strip(),
            duration,
            audience.strip(),
            round(confidence_score, 2),
            round(clarity_score, 2),
            round(vocabulary_score, 2),
            round(overall_score, 2),
            feedback.strip()
        )
        cursor.execute(query, params)
        conn.commit()
        session_id = cursor.lastrowid
        return {"success": True, "session_id": session_id, "message": "Practice session saved successfully!"}
    except Exception as e:
        return {"success": False, "message": f"Failed to save session: {str(e)}"}
    finally:
        cursor.close()
        conn.close()

def get_user_sessions(user_id: int) -> List[Dict[str, Any]]:
    """
    Retrieves all speaking practice sessions for a specific user, ordered chronologically.
    """
    conn, db_type = get_connection()
    cursor = conn.cursor(dictionary=True) if db_type == "mysql" else conn.cursor()

    try:
        placeholder = "%s" if db_type == "mysql" else "?"
        query = f"""
        SELECT id, user_id, topic, duration, audience, 
               confidence_score, clarity_score, vocabulary_score, overall_score, 
               feedback, created_at
        FROM speaking_sessions 
        WHERE user_id = {placeholder}
        ORDER BY created_at ASC, id ASC
        """
        cursor.execute(query, (user_id,))
        rows = cursor.fetchall()
        if db_type == "sqlite":
            return [dict(r) for r in rows]
        return rows
    finally:
        cursor.close()
        conn.close()

def get_session_by_id(session_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single session ensuring it belongs to the authenticated user.
    """
    conn, db_type = get_connection()
    cursor = conn.cursor(dictionary=True) if db_type == "mysql" else conn.cursor()

    try:
        placeholder = "%s" if db_type == "mysql" else "?"
        query = f"""
        SELECT id, user_id, topic, duration, audience, 
               confidence_score, clarity_score, vocabulary_score, overall_score, 
               feedback, created_at
        FROM speaking_sessions 
        WHERE id = {placeholder} AND user_id = {placeholder}
        """
        cursor.execute(query, (session_id, user_id))
        row = cursor.fetchone()
        if row is None:
            return None
        if db_type == "sqlite":
            return dict(row)
        return row
    finally:
        cursor.close()
        conn.close()

def delete_session(session_id: int, user_id: int) -> bool:
    """
    Deletes a session belonging to user_id.
    """
    conn, db_type = get_connection()
    cursor = conn.cursor()
    try:
        placeholder = "%s" if db_type == "mysql" else "?"
        query = f"DELETE FROM speaking_sessions WHERE id = {placeholder} AND user_id = {placeholder}"
        cursor.execute(query, (session_id, user_id))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        cursor.close()
        conn.close()
