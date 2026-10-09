from contextlib import asynccontextmanager
from datetime import date
import os
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from database import connection, init_database
from seed import seed_database
from transcript import parse_transcript, make_notes

@asynccontextmanager
async def lifespan(app):
    init_database()
    seed_database()
    yield

app = FastAPI(title="Fireflies College Project API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","), allow_methods=["*"], allow_headers=["*"])

class Metadata(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: date
    participants: list[str] = Field(min_length=1, max_length=50)

    @field_validator("title")
    @classmethod
    def trim_title(cls, value):
        if not value.strip():
            raise ValueError("Title cannot be blank")
        return value.strip()

    @field_validator("participants")
    @classmethod
    def trim_people(cls, values):
        people = list(dict.fromkeys(name.strip() for name in values if name.strip()))
        if not people or any(len(name) > 80 for name in people):
            raise ValueError("Provide participant names of 1–80 characters")
        return people

class MeetingCreate(Metadata):
    transcript: str = Field(min_length=1, max_length=200000)

class Notes(BaseModel):
    summary: str = Field(max_length=50000)

class Action(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    assignee: str = Field(default="", max_length=80)
    completed: bool = False

    @field_validator("text")
    @classmethod
    def trim_text(cls, value):
        if not value.strip():
            raise ValueError("Task cannot be blank")
        return value.strip()

def require_meeting(db, mid):
    row = db.execute("SELECT * FROM meetings WHERE id=?", (mid,)).fetchone()
    if row is None:
        raise HTTPException(404, "Meeting not found")
    return dict(row)

def meeting_detail(db, mid):
    result = require_meeting(db, mid)
    result["participants"] = [r["name"] for r in db.execute("SELECT name FROM participants WHERE meeting_id=? ORDER BY id", (mid,))]
    for table, order in [("transcripts", "timestamp,id"), ("action_items", "id"), ("chapters", "timestamp,id")]:
        result[table] = [dict(r) for r in db.execute(f"SELECT * FROM {table} WHERE meeting_id=? ORDER BY {order}", (mid,))]
    for item in result["action_items"]:
        item["completed"] = bool(item["completed"])
    return result

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/meetings")
def list_meetings(q: str = Query(default="", max_length=200), participant: str = "", on_date: date | None = None, sort: str = Query(default="newest", pattern="^(newest|oldest)$")):
    with connection() as db:
        # Escape LIKE wildcards so a search for '%' means the literal character.
        pattern = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        rows = db.execute("""SELECT DISTINCT m.* FROM meetings m WHERE
          (m.title LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM participants p WHERE p.meeting_id=m.id AND p.name LIKE ? ESCAPE '\\')
          OR EXISTS(SELECT 1 FROM transcripts t WHERE t.meeting_id=m.id AND t.text LIKE ? ESCAPE '\\'))
          AND (?='' OR EXISTS(SELECT 1 FROM participants p WHERE p.meeting_id=m.id AND p.name=? COLLATE NOCASE))
          AND (? IS NULL OR m.date=?)""", (pattern,pattern,pattern,participant,participant,on_date.isoformat() if on_date else None,on_date.isoformat() if on_date else None)).fetchall()
        meetings = []
        for row in rows:
            meeting = dict(row)
            meeting["participants"] = [r["name"] for r in db.execute("SELECT name FROM participants WHERE meeting_id=? ORDER BY id", (row["id"],))]
            meetings.append(meeting)
        return sorted(meetings, key=lambda m: (m["date"],m["id"]), reverse=sort=="newest")

@app.get("/api/meetings/{mid}")
def get_meeting(mid: int):
    with connection() as db:
        return meeting_detail(db, mid)

@app.post("/api/meetings", status_code=201)
def create_meeting(payload: MeetingCreate):
    try:
        segments = parse_transcript(payload.transcript)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    summary, actions, chapters = make_notes(segments)
    with connection() as db:
        mid = db.execute("INSERT INTO meetings(title,date,duration,summary) VALUES(?,?,?,?)", (payload.title,payload.date.isoformat(),segments[-1]["timestamp"]+30,summary)).lastrowid
        db.executemany("INSERT INTO participants(meeting_id,name) VALUES(?,?)", [(mid,p) for p in payload.participants])
        db.executemany("INSERT INTO transcripts(meeting_id,speaker,timestamp,text) VALUES(?,?,?,?)", [(mid,s["speaker"],s["timestamp"],s["text"]) for s in segments])
        db.executemany("INSERT INTO action_items(meeting_id,text,assignee) VALUES(?,?,?)", [(mid,s["text"],s["speaker"]) for s in actions])
        db.executemany("INSERT INTO chapters(meeting_id,title,timestamp) VALUES(?,?,?)", [(mid,s["title"],s["timestamp"]) for s in chapters])
        return meeting_detail(db, mid)

@app.put("/api/meetings/{mid}")
def update_meeting(mid: int, payload: Metadata):
    with connection() as db:
        require_meeting(db, mid)
        db.execute("UPDATE meetings SET title=?,date=? WHERE id=?", (payload.title,payload.date.isoformat(),mid))
        db.execute("DELETE FROM participants WHERE meeting_id=?", (mid,))
        db.executemany("INSERT INTO participants(meeting_id,name) VALUES(?,?)", [(mid,p) for p in payload.participants])
        return meeting_detail(db, mid)

@app.delete("/api/meetings/{mid}", status_code=204)
def delete_meeting(mid: int):
    with connection() as db:
        require_meeting(db, mid)
        db.execute("DELETE FROM meetings WHERE id=?", (mid,))
    return Response(status_code=204)

@app.put("/api/meetings/{mid}/summary")
def update_summary(mid: int, payload: Notes):
    with connection() as db:
        require_meeting(db, mid)
        db.execute("UPDATE meetings SET summary=? WHERE id=?", (payload.summary,mid))
        return meeting_detail(db, mid)

@app.post("/api/meetings/{mid}/actions", status_code=201)
def add_action(mid: int, payload: Action):
    with connection() as db:
        require_meeting(db, mid)
        db.execute("INSERT INTO action_items(meeting_id,text,assignee,completed) VALUES(?,?,?,?)", (mid,payload.text,payload.assignee,payload.completed))
        return meeting_detail(db, mid)

@app.put("/api/meetings/{mid}/actions/{aid}")
def edit_action(mid: int, aid: int, payload: Action):
    with connection() as db:
        require_meeting(db, mid)
        result = db.execute("UPDATE action_items SET text=?,assignee=?,completed=? WHERE id=? AND meeting_id=?", (payload.text,payload.assignee,payload.completed,aid,mid))
        if result.rowcount == 0:
            raise HTTPException(404, "Action item not found")
        return meeting_detail(db, mid)

@app.delete("/api/meetings/{mid}/actions/{aid}")
def delete_action(mid: int, aid: int):
    with connection() as db:
        require_meeting(db, mid)
        if db.execute("DELETE FROM action_items WHERE id=? AND meeting_id=?", (aid,mid)).rowcount == 0:
            raise HTTPException(404, "Action item not found")
        return meeting_detail(db, mid)
