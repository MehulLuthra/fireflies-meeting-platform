import os
import tempfile
import unittest
from fastapi.testclient import TestClient
import database
from main import app
from transcript import parse_transcript

class MeetingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_path = database.DB_PATH
        database.DB_PATH = os.path.join(self.temp.name, "test.db")
        self.client_context = TestClient(app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        database.DB_PATH = self.old_path
        self.temp.cleanup()

    def create(self):
        response = self.client.post("/api/meetings", json={"title":"Test review", "date":"2026-10-09", "participants":["A", "B"], "transcript":"00:00 A: Welcome.\n00:35 B: I will finish the API.\n01:15 A: Review tomorrow."})
        self.assertEqual(response.status_code, 201)
        return response.json()

    def test_create_search_edit_and_restart(self):
        meeting = self.create()
        self.assertEqual(meeting["duration"], 105)
        self.assertEqual(len(meeting["transcripts"]), 3)
        self.assertEqual(len(meeting["action_items"]), 1)
        self.assertIn(meeting["id"], [m["id"] for m in self.client.get("/api/meetings?q=finish").json()])
        mid = meeting["id"]
        result = self.client.put(f"/api/meetings/{mid}", json={"title":"Renamed", "date":"2026-10-10", "participants":["C"]})
        self.assertEqual(result.json()["participants"], ["C"])
        self.client.put(f"/api/meetings/{mid}/summary", json={"summary":"Edited notes"})
        with TestClient(app) as second_client:
            saved = second_client.get(f"/api/meetings/{mid}").json()
            self.assertEqual(saved["title"], "Renamed")
            self.assertEqual(saved["summary"], "Edited notes")

    def test_task_crud_and_cascade_delete(self):
        meeting = self.create()
        mid = meeting["id"]
        result = self.client.post(f"/api/meetings/{mid}/actions", json={"text":"Write README", "assignee":"A"}).json()
        aid = result["action_items"][-1]["id"]
        result = self.client.put(f"/api/meetings/{mid}/actions/{aid}", json={"text":"Updated task", "assignee":"B", "completed":True}).json()
        self.assertTrue(result["action_items"][-1]["completed"])
        self.assertEqual(self.client.put(f"/api/meetings/1/actions/{aid}", json={"text":"Wrong meeting"}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/meetings/{mid}/actions/{aid}").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/meetings/{mid}").status_code, 204)
        self.assertEqual(self.client.get(f"/api/meetings/{mid}").status_code, 404)
        with database.connection() as db:
            for table in ("participants", "transcripts", "chapters", "action_items"):
                self.assertEqual(db.execute(f"SELECT COUNT(*) FROM {table} WHERE meeting_id=?", (mid,)).fetchone()[0], 0)

    def test_filters_validation_and_seed_once(self):
        self.assertEqual(len(self.client.get("/api/meetings").json()), 6)
        result = self.client.get("/api/meetings?participant=Neha&on_date=2026-10-07").json()
        self.assertEqual(len(result), 1)
        self.assertEqual(self.client.get("/api/meetings?sort=invalid").status_code, 422)
        self.assertEqual(self.client.post("/api/meetings", json={"title":" ", "date":"invalid", "participants":[], "transcript":" "}).status_code, 422)
        self.assertEqual(self.client.get("/api/meetings?q=%25").json(), [])
        for meeting in self.client.get("/api/meetings").json():
            self.client.delete(f'/api/meetings/{meeting["id"]}')
        with TestClient(app) as second_client:
            self.assertEqual(second_client.get("/api/meetings").json(), [])

    def test_parser(self):
        self.assertEqual(parse_transcript("[01:02:03] A: Hello")[0]["timestamp"], 3723)
        self.assertEqual(parse_transcript("Hello\nA: Next")[1]["timestamp"], 30)
        with self.assertRaises(ValueError):
            parse_transcript("00:99 A: Invalid")

if __name__ == "__main__":
    unittest.main()
