"""Seed on the first run only. Deleting meetings will not bring them back."""
from database import connection
from transcript import parse_transcript, make_notes

SAMPLES = [
    ("Product team weekly sync", "2026-10-08", "Aarav, Priya, Rohan", [
        ("Aarav", "Let's review the meeting dashboard before our Friday demo."),
        ("Priya", "The library now includes search, participant filters, and the date filter."),
        ("Rohan", "I tested the API. Meeting details and action items persist after a restart."),
        ("Aarav", "Our goal is a clear workflow from opening a meeting to finding the next steps."),
        ("Priya", "I will finish the mobile layout and check the transcript search today."),
        ("Rohan", "We need to test deleting a meeting along with all its related records."),
        ("Aarav", "For the demo we can use a placeholder player rather than real audio."),
        ("Priya", "Clicking a line should move the timer and highlight the current speaker."),
        ("Rohan", "I will update the setup instructions and include an example transcript."),
        ("Aarav", "Let's keep dependencies small so the evaluator can run the project easily."),
        ("Priya", "The summary panel can show topics, notes, and editable action items together."),
        ("Aarav", "We agreed to review the complete flow tomorrow morning.")]),
    ("Customer onboarding discussion", "2026-10-07", "Priya, Neha, Kabir", [
        ("Neha", "New customers are struggling to find the first setup step."),
        ("Priya", "Let's simplify onboarding into three clear steps with helpful examples."),
        ("Kabir", "The welcome email should link directly to the dashboard."),
        ("Neha", "Users also requested an easy way to search their meeting notes."),
        ("Priya", "I will prepare a revised welcome screen by Thursday."),
        ("Kabir", "We need to measure how many users complete the first step."),
        ("Neha", "The help page should explain supported transcript formats."),
        ("Priya", "Plain text upload is enough for our first version."),
        ("Kabir", "I will share the onboarding checklist with the team."),
        ("Neha", "Let's review customer feedback again next week.")]),
    ("Sprint planning — meeting workspace", "2026-10-06", "Aarav, Rohan, Kabir", [
        ("Aarav", "This sprint focuses on completing the meeting workspace."),
        ("Rohan", "The backend will use FastAPI and SQLite with five related tables."),
        ("Kabir", "We should implement the library first and then the detail screen."),
        ("Aarav", "The scope includes meeting creation, editing, deletion, and saved notes."),
        ("Rohan", "I will add API validation and cascade deletes."),
        ("Kabir", "I will build the transcript panel with timestamps and search."),
        ("Aarav", "Real authentication and calendar integrations are outside this sprint."),
        ("Rohan", "We need to include tests for persistence and missing meeting IDs."),
        ("Kabir", "Let's include an empty state and clear error messages."),
        ("Aarav", "We will demonstrate the working project with seeded meetings.")]),
    ("Design review and feedback", "2026-10-04", "Priya, Aarav", [
        ("Priya", "The sidebar uses a purple accent with a light workspace background."),
        ("Aarav", "Keep the meeting list simple with title, date, duration, and participants."),
        ("Priya", "The detail page places notes on the left and transcript on the right."),
        ("Aarav", "The main buttons should be easy to find and work with the keyboard."),
        ("Priya", "I will improve contrast and make the form labels clear."),
        ("Aarav", "We need to check the page on a phone-sized screen."),
        ("Priya", "Settings and integrations can display a coming soon message."),
        ("Aarav", "This design is ready for the next implementation review.")]),
    ("Research planning session", "2026-10-03", "Neha, Kabir, Rohan", [
        ("Neha", "The research plan should focus on reliable meeting notes."),
        ("Kabir", "We need to compare the search results with the transcript content."),
        ("Rohan", "I will document the test cases for the main meeting workflows."),
        ("Neha", "The summary should make the most important decisions easy to find."),
        ("Kabir", "Let's review the findings with the team on Monday.")]),
    ("Release readiness check", "2026-10-02", "Aarav, Neha, Priya", [
        ("Aarav", "The release checklist covers the backend, frontend, and sample data."),
        ("Neha", "I will verify the setup instructions on a clean environment."),
        ("Priya", "We need to run the API tests before the final walkthrough."),
        ("Aarav", "The placeholder player is clearly labelled and does not claim to process audio."),
        ("Priya", "The project is ready for the assignment review.")])
]

def seed_database():
    with connection() as db:
        db.execute("CREATE TABLE IF NOT EXISTS seed_state (id INTEGER PRIMARY KEY)")
        if db.execute("SELECT 1 FROM seed_state").fetchone():
            return
        for title, date, people, lines in SAMPLES:
            raw = "\n".join(f"{i:02d}:00 {speaker}: {text}" for i, (speaker, text) in enumerate(lines))
            segments = parse_transcript(raw)
            summary, actions, chapters = make_notes(segments)
            mid = db.execute("INSERT INTO meetings(title,date,duration,summary) VALUES(?,?,?,?)", (title,date,segments[-1]["timestamp"]+60,summary)).lastrowid
            db.executemany("INSERT INTO participants(meeting_id,name) VALUES(?,?)", [(mid,name.strip()) for name in people.split(",")])
            db.executemany("INSERT INTO transcripts(meeting_id,speaker,timestamp,text) VALUES(?,?,?,?)", [(mid,s["speaker"],s["timestamp"],s["text"]) for s in segments])
            db.executemany("INSERT INTO action_items(meeting_id,text,assignee) VALUES(?,?,?)", [(mid,s["text"],s["speaker"]) for s in actions])
            db.executemany("INSERT INTO chapters(meeting_id,title,timestamp) VALUES(?,?,?)", [(mid,s["title"],s["timestamp"]) for s in chapters])
        db.execute("INSERT INTO seed_state(id) VALUES(1)")
