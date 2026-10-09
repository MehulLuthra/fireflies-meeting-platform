"""Small SQLite helpers. Each request opens and closes its own connection."""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.getenv("DATABASE_PATH", str(Path(__file__).with_name("meetings.db")))

@contextmanager
def connection():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def init_database():
    with connection() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS meetings (
          id INTEGER PRIMARY KEY, title TEXT NOT NULL, date TEXT NOT NULL,
          duration INTEGER NOT NULL, summary TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS participants (
          id INTEGER PRIMARY KEY, meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transcripts (
          id INTEGER PRIMARY KEY, meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          speaker TEXT NOT NULL, timestamp INTEGER NOT NULL, text TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS action_items (
          id INTEGER PRIMARY KEY, meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          text TEXT NOT NULL, assignee TEXT NOT NULL DEFAULT '', completed INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS chapters (
          id INTEGER PRIMARY KEY, meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          title TEXT NOT NULL, timestamp INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS transcript_meeting ON transcripts(meeting_id, timestamp);
        CREATE INDEX IF NOT EXISTS meeting_date ON meetings(date);
        """)
