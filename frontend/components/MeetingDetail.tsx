"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Play,
  Pause,
  Search,
  Download,
  CheckSquare,
  List,
  FileText,
} from "lucide-react";
import {
  ActionItem,
  api,
  displayDate,
  MeetingDetail as Detail,
  time,
} from "@/lib/api";

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    <>
      {text
        .split(new RegExp(`(${escaped})`, "gi"))
        .map((part, index) =>
          part.toLowerCase() === query.trim().toLowerCase() ? (
            <mark key={index}>{part}</mark>
          ) : (
            part
          ),
        )}
    </>
  );
}

function TaskRow({
  task,
  save,
  remove,
  busy,
}: {
  task: ActionItem;
  save: (task: ActionItem) => Promise<void>;
  remove: () => Promise<void>;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(task.text);
  const [assignee, setAssignee] = useState(task.assignee);
  return (
    <div className="task-row">
      <input
        aria-label={`Complete task: ${task.text}`}
        type="checkbox"
        checked={task.completed}
        disabled={busy}
        onChange={() => {
          save({ ...task, completed: !task.completed }).catch(() => {});
        }}
      />
      {editing ? (
        <form
          className="task-edit"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await save({ ...task, text, assignee });
              setEditing(false);
            } catch {}
          }}
        >
          <input
            aria-label="Task text"
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
          <input
            aria-label="Assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            maxLength={80}
          />
          <button disabled={busy} className="primary">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <>
          <div className={task.completed ? "completed task-text" : "task-text"}>
            {task.text}
            <small>{task.assignee || "Unassigned"}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Edit task"
            onClick={() => {
              setText(task.text);
              setAssignee(task.assignee);
              setEditing(true);
            }}
          >
            <Pencil size={15} />
          </button>
          <button
            disabled={busy}
            className="icon-button"
            aria-label="Delete task"
            onClick={() => void remove()}
          >
            <Trash2 size={15} />
          </button>
        </>
      )}
    </div>
  );
}

export default function MeetingDetail({
  meeting,
  onBack,
  onEdit,
  onDeleted,
  onChanged,
  notify,
}: {
  meeting: Detail;
  onBack: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  onChanged: (m: Detail) => void;
  notify: (message: string) => void;
}) {
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState(meeting.summary);
  const [editingSummary, setEditingSummary] = useState(false);
  const [task, setTask] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const activeRef = useRef<HTMLButtonElement>(null);
  let activeId = -1;
  for (const segment of meeting.transcripts)
    if (segment.timestamp <= position) activeId = segment.id;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setPosition((current) => Math.min(current + 1, meeting.duration)),
      1000,
    );
    return () => clearInterval(timer);
  }, [playing, meeting.duration]);
  useEffect(() => {
    if (position >= meeting.duration) setPlaying(false);
  }, [position, meeting.duration]);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);
  async function change(path: string, method: string, payload?: unknown) {
    setBusy(true);
    try {
      onChanged(
        await api<Detail>(`/meetings/${meeting.id}${path}`, method, payload),
      );
      notify("Changes saved");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not save");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function safeChange(path: string, method: string, payload?: unknown) {
    try {
      await change(path, method, payload);
    } catch {
      /* Error is shown in the notification. */
    }
  }
  function exportMeeting() {
    const text = `${meeting.title}\n${meeting.date} | ${meeting.participants.join(", ")}\n\nSUMMARY\n${meeting.summary}\n\nACTION ITEMS\n${meeting.action_items.map((a) => `${a.completed ? "[x]" : "[ ]"} ${a.text} (${a.assignee || "Unassigned"})`).join("\n")}\n\nTRANSCRIPT\n${meeting.transcripts.map((s) => `${time(s.timestamp)} ${s.speaker}: ${s.text}`).join("\n")}`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting-${meeting.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Transcript exported");
  }
  return (
    <>
      <button className="back" onClick={onBack}>
        <ArrowLeft size={17} /> All meetings
      </button>
      <header className="detail-header">
        <div>
          <h1>{meeting.title}</h1>
          <p className="muted">
            {displayDate(meeting.date)} · {Math.ceil(meeting.duration / 60)} min
            · {meeting.participants.join(", ")}
          </p>
        </div>
        <div className="actions">
          <button onClick={exportMeeting}>
            <Download size={16} /> Export
          </button>
          <button onClick={onEdit}>
            <Pencil size={16} /> Edit
          </button>
          <button className="danger" onClick={() => setDeleting(true)}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </header>
      <section className="player" aria-label="Placeholder recording player">
        <button
          className="play"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => {
            if (position >= meeting.duration) setPosition(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <div className="player-main">
          <div className="section-heading">
            <strong>Meeting recording</strong>
            <small>Placeholder player · no audio</small>
          </div>
          <input
            aria-label="Seek recording"
            type="range"
            min={0}
            max={meeting.duration}
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
          />
        </div>
        <span className="timer">
          {time(position)} / {time(meeting.duration)}
        </span>
      </section>
      <div className="detail-grid">
        <div className="notes-panel">
          <div className="panel-title">
            <FileText size={18} />
            <h2>AI Summary</h2>
            <span className="tag">Mock notes</span>
          </div>
          <section className="note-section">
            <div className="section-heading">
              <h3>Overview</h3>
              <button
                className="text-button"
                onClick={() => {
                  setSummary(meeting.summary);
                  setEditingSummary(!editingSummary);
                }}
              >
                {editingSummary ? "Cancel" : "Edit notes"}
              </button>
            </div>
            {editingSummary ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await change("/summary", "PUT", { summary });
                    setEditingSummary(false);
                  } catch {}
                }}
              >
                <textarea
                  aria-label="Summary"
                  rows={7}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  maxLength={50000}
                />
                <button disabled={busy} className="primary">
                  Save notes
                </button>
              </form>
            ) : (
              <p className="summary-text">
                {meeting.summary ||
                  "No summary yet. Use Edit notes to add one."}
              </p>
            )}
          </section>
          <section className="note-section">
            <h3>
              <CheckSquare size={17} /> Action items{" "}
              <span className="count">
                {meeting.action_items.filter((a) => a.completed).length}/
                {meeting.action_items.length}
              </span>
            </h3>
            {meeting.action_items.map((item) => (
              <TaskRow
                key={item.id}
                task={item}
                busy={busy}
                save={(item) => change(`/actions/${item.id}`, "PUT", item)}
                remove={() => safeChange(`/actions/${item.id}`, "DELETE")}
              />
            ))}
            {meeting.action_items.length === 0 && (
              <p className="muted">No tasks yet. Add the next step below.</p>
            )}
            <form
              className="new-task"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await change("/actions", "POST", { text: task, assignee });
                  setTask("");
                  setAssignee("");
                } catch {}
              }}
            >
              <input
                required
                aria-label="New task"
                placeholder="Add an action item…"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                maxLength={2000}
              />
              <input
                aria-label="Task assignee"
                placeholder="Assignee (optional)"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                maxLength={80}
              />
              <button disabled={busy} className="primary">
                Add task
              </button>
            </form>
          </section>
          <section className="note-section">
            <h3>
              <List size={17} /> Topics & chapters
            </h3>
            {meeting.chapters.map((chapter) => (
              <button
                className="chapter"
                key={chapter.id}
                onClick={() => setPosition(chapter.timestamp)}
              >
                <span>{time(chapter.timestamp)}</span>
                {chapter.title}
              </button>
            ))}
          </section>
        </div>
        <section className="transcript-panel">
          <div className="panel-title">
            <h2>Transcript</h2>
            <span className="count">{meeting.transcripts.length} segments</span>
          </div>
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Search transcript"
              placeholder="Search in transcript"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {query.trim() && (
            <small className="match-count">
              {
                meeting.transcripts.filter((s) =>
                  `${s.speaker} ${s.text}`
                    .toLowerCase()
                    .includes(query.trim().toLowerCase()),
                ).length
              }{" "}
              matching segments
            </small>
          )}
          <div className="transcript-scroll">
            {meeting.transcripts.map((s, index) => (
              <button
                ref={s.id === activeId ? activeRef : undefined}
                className={`segment ${s.id === activeId ? "active" : ""}`}
                key={s.id}
                onClick={() => setPosition(s.timestamp)}
                aria-label={`Seek to ${time(s.timestamp)}: ${s.speaker}`}
              >
                <span className={`avatar color-${index % 4}`}>
                  {s.speaker[0]}
                </span>
                <span className="segment-content">
                  <span className="speaker">
                    <strong>
                      <Highlight text={s.speaker} query={query} />
                    </strong>
                    <small>{time(s.timestamp)}</small>
                  </span>
                  <span>
                    <Highlight text={s.text} query={query} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
      {deleting && (
        <div className="overlay">
          <section
            className="modal compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete this meeting?</h2>
            <p>Its transcript, notes, and action items will also be deleted.</p>
            <div className="form-footer">
              <button
                autoFocus
                disabled={busy}
                onClick={() => setDeleting(false)}
              >
                Cancel
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`/meetings/${meeting.id}`, "DELETE");
                    onDeleted();
                  } catch (e) {
                    notify(e instanceof Error ? e.message : "Delete failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete meeting
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
