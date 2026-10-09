"use client";
import { useState } from "react";
import { X, Upload } from "lucide-react";
import { api, Meeting, MeetingDetail } from "@/lib/api";

export default function MeetingForm({
  meeting,
  onClose,
  onSaved,
}: {
  meeting?: Meeting;
  onClose: () => void;
  onSaved: (meeting: MeetingDetail) => void;
}) {
  const [title, setTitle] = useState(meeting?.title || "");
  const [date, setDate] = useState(
    meeting?.date || new Date().toLocaleDateString("en-CA"),
  );
  const [people, setPeople] = useState(meeting?.participants.join(", ") || "");
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        title,
        date,
        participants: people
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        ...(meeting ? {} : { transcript }),
      };
      const result = await api<MeetingDetail>(
        meeting ? `/meetings/${meeting.id}` : "/meetings",
        meeting ? "PUT" : "POST",
        payload,
      );
      onSaved(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save meeting");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Tab") {
            const elements = e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input, textarea",
            );
            const first = elements[0],
              last = elements[elements.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
            if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="section-heading">
          <h2 id="form-title">{meeting ? "Edit meeting" : "Add a meeting"}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <p className="muted">
          {meeting
            ? "Update the meeting details."
            : "Paste a transcript or upload a text file to create your notes."}
        </p>
        <form onSubmit={save}>
          <label>
            Meeting title
            <input
              autoFocus
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Product team weekly sync"
            />
          </label>
          <label>
            Date
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Participants
            <input
              required
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              placeholder="Aarav, Priya, Rohan"
            />
            <small>Separate names with commas.</small>
          </label>
          {!meeting && (
            <>
              <label className="upload">
                <Upload size={17} /> Upload a .txt transcript
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 200000) {
                      setError("Please use a text file smaller than 200 KB.");
                      return;
                    }
                    try {
                      setTranscript(await file.text());
                      setError("");
                    } catch {
                      setError("Could not read this file.");
                    }
                  }}
                />
              </label>
              <label>
                Transcript
                <textarea
                  required
                  maxLength={200000}
                  rows={7}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={
                    "00:00 Aarav: Let's discuss our project.\n00:30 Priya: I will finish the dashboard."
                  }
                />
                <small>
                  Use MM:SS Speaker: text. Plain lines are also supported.
                </small>
              </label>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="form-footer">
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : meeting ? "Save changes" : "Create meeting"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
