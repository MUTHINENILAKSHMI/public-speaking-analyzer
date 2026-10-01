"""
Authentication Module for Public Speaking Analyzer
Handles password hashing with bcrypt, input validation, and session state management.
"""

import re
import bcrypt
import streamlit as st
from typing import Tuple, Dict, Any, Optional
from database import register_user, get_user_by_email

def hash_password(password: str) -> str:
    """
    Hashes a plain-text password using bcrypt with a generated salt.
    Never stores plain-text passwords.
    """
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against the stored bcrypt hash.
    """
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def validate_registration_inputs(name: str, email: str, password: str, confirm_password: str) -> Tuple[bool, str]:
    """
    Validates registration form inputs.
    """
    if not name or not name.strip():
        return False, "Please enter your full name."
    
    if len(name.strip()) < 2:
        return False, "Full name must be at least 2 characters long."

    email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if not email or not re.match(email_regex, email.strip()):
        return False, "Please provide a valid email address (e.g., student@university.edu)."

    if not password:
        return False, "Password cannot be empty."

    if len(password) < 6:
        return False, "Password must be at least 6 characters long."

    if password != confirm_password:
        return False, "Passwords do not match. Please re-enter."

    return True, "Valid"

def authenticate_user(email: str, password: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Validates user credentials against database records.
    """
    if not email or not email.strip():
        return False, "Please enter your email.", None
    if not password:
        return False, "Please enter your password.", None

    user = get_user_by_email(email.strip())
    if not user:
        return False, "Invalid email or password.", None

    if not verify_password(password, user["password_hash"]):
        return False, "Invalid email or password.", None

    user_info = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"]
    }
    return True, "Login successful!", user_info

def init_session():
    """
    Initializes Streamlit session state keys if not already present.
    """
    if "authenticated" not in st.session_state:
        st.session_state["authenticated"] = False
    if "user" not in st.session_state:
        st.session_state["user"] = None
    if "current_page" not in st.session_state:
        st.session_state["current_page"] = "Dashboard"

def login_user(user_info: Dict[str, Any]):
    """
    Sets session state on successful authentication.
    """
    st.session_state["authenticated"] = True
    st.session_state["user"] = user_info
    st.session_state["current_page"] = "Dashboard"

def logout_user():
    """
    Clears session state on logout and redirects to Login.
    """
    st.session_state["authenticated"] = False
    st.session_state["user"] = None
    st.session_state["current_page"] = "Login"

def is_authenticated() -> bool:
    """
    Checks if a user is currently logged in.
    """
    return st.session_state.get("authenticated", False) and st.session_state.get("user") is not None

def get_current_user() -> Optional[Dict[str, Any]]:
    """
    Returns current logged in user details.
    """
    return st.session_state.get("user")
