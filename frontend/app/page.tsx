"use client";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Search,
  Plus,
  Settings,
  Users,
  Plug,
  Video,
  Sparkles,
  ChevronRight,
  Calendar,
  Clock,
  X,
} from "lucide-react";
import { api, displayDate, Meeting, MeetingDetail as Detail } from "@/lib/api";
import MeetingForm from "@/components/MeetingForm";
import MeetingDetail from "@/components/MeetingDetail";

export default function Home() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [allPeople, setAllPeople] = useState<string[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [view, setView] = useState("Meetings");
  const [query, setQuery] = useState("");
  const [participant, setParticipant] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState("newest");
  const [form, setForm] = useState<"new" | "edit" | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ q: query, participant, sort });
      if (date) params.set("on_date", date);
      try {
        setMeetings(
          await api<Meeting[]>(
            `/meetings?${params}`,
            "GET",
            undefined,
            controller.signal,
          ),
        );
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error && e.message !== "Failed to fetch"
              ? e.message
              : "Cannot connect to the backend. Start the Python server on port 8000, then retry.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, participant, date, sort, reload]);
  useEffect(() => {
    api<Meeting[]>("/meetings")
      .then((list) =>
        setAllPeople([...new Set(list.flatMap((m) => m.participants))].sort()),
      )
      .catch(() => {});
  }, [reload]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function openMeeting(id: number) {
    setOpening(true);
    try {
      setSelected(await api<Detail>(`/meetings/${id}`));
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not open meeting");
    } finally {
      setOpening(false);
    }
  }
  const nav = [
    { name: "Meetings", icon: BookOpen },
    { name: "Live meetings", icon: Video },
    { name: "Integrations", icon: Plug },
    { name: "Team", icon: Users },
    { name: "Settings", icon: Settings },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Fireflies home">
          <span className="brand-icon">
            <Sparkles size={24} />
          </span>
          fireflies<span className="brand-ai">.ai</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">S</span>
          <div>
            <strong>Student workspace</strong>
            <small>Personal workspace</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={view === name ? "nav-item selected" : "nav-item"}
              onClick={() => {
                setView(name);
                setSelected(null);
              }}
            >
              <Icon size={19} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="profile-avatar">S</span>
          <div>
            <strong>Student</strong>
            <small>Default account</small>
          </div>
          <button
            className="icon-button"
            aria-label="Profile settings"
            onClick={() => {
              setView("Settings");
              setSelected(null);
            }}
          >
            <Settings size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <div className="topbar">
          <span>
            My workspace <ChevronRight size={14} />{" "}
            {selected ? "Meeting notes" : view}
          </span>
          <span className="account">
            Personal <span className="profile-avatar">S</span>
          </span>
        </div>
        <main>
          {selected ? (
            <MeetingDetail
              key={selected.id}
              meeting={selected}
              onBack={() => setSelected(null)}
              onEdit={() => setForm("edit")}
              onDeleted={() => {
                setSelected(null);
                setReload((r) => r + 1);
                setToast("Meeting deleted");
              }}
              onChanged={(m) => {
                setSelected(m);
                setReload((r) => r + 1);
              }}
              notify={setToast}
            />
          ) : view !== "Meetings" ? (
            <section className="empty placeholder">
              <Sparkles size={35} />
              <h1>{view}</h1>
              <h2>Coming soon</h2>
              <p>
                {view === "Settings"
                  ? "You are using the default student account. Account preferences will be available in a future version."
                  : "This section is a placeholder for this assignment."}
              </p>
              <button onClick={() => setView("Meetings")}>
                Back to meetings
              </button>
            </section>
          ) : (
            <>
              <header className="library-header">
                <div>
                  <h1>Meetings</h1>
                  <p className="muted">
                    Your conversations, notes, and next steps — all in one
                    place.
                  </p>
                </div>
                <button className="primary" onClick={() => setForm("new")}>
                  <Plus size={18} /> Add meeting
                </button>
              </header>
              <div className="library-tabs">
                <span>
                  All meetings <b>{meetings.length}</b>
                </span>
              </div>
              <div className="filters">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    aria-label="Search all meetings"
                    placeholder="Search titles, people, or transcript…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <select
                  aria-label="Filter by participant"
                  value={participant}
                  onChange={(e) => setParticipant(e.target.value)}
                >
                  <option value="">All participants</option>
                  {allPeople.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <input
                  aria-label="Filter by date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <select
                  aria-label="Sort meetings"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
                {(query || date || participant) && (
                  <button
                    onClick={() => {
                      setQuery("");
                      setDate("");
                      setParticipant("");
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
              {error ? (
                <section className="empty">
                  <h2>Connection issue</h2>
                  <p className="error" role="alert">
                    {error}
                  </p>
                  <button onClick={() => setReload((r) => r + 1)}>Retry</button>
                </section>
              ) : loading ? (
                <p className="loading" role="status">
                  Loading your meetings…
                </p>
              ) : meetings.length === 0 ? (
                <section className="empty">
                  <BookOpen size={36} />
                  <h2>No meetings found</h2>
                  <p>Try changing the filters or add your first transcript.</p>
                  <button className="primary" onClick={() => setForm("new")}>
                    Add meeting
                  </button>
                </section>
              ) : (
                <div className="meeting-list">
                  <div className="list-heading">
                    <span>Meeting name</span>
                    <span>Date & duration</span>
                    <span>Participants</span>
                  </div>
                  {meetings.map((m) => (
                    <button
                      disabled={opening}
                      className="meeting-row"
                      key={m.id}
                      onClick={() => void openMeeting(m.id)}
                    >
                      <span className="meeting-title">
                        <span className="meeting-symbol">
                          <Video size={20} />
                        </span>
                        <span>
                          <strong>{m.title}</strong>
                          <small>Transcript & summary ready</small>
                        </span>
                      </span>
                      <span className="meeting-date">
                        <span>
                          <Calendar size={14} />
                          {displayDate(m.date)}
                        </span>
                        <small>
                          <Clock size={13} />
                          {Math.ceil(m.duration / 60)} min
                        </small>
                      </span>
                      <span className="people">
                        <span className="avatars">
                          {m.participants.slice(0, 3).map((p, i) => (
                            <span
                              title={p}
                              className={`avatar color-${i}`}
                              key={p}
                            >
                              {p[0]}
                            </span>
                          ))}
                        </span>
                        <small>{m.participants.join(", ")}</small>
                        <ChevronRight size={18} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="library-footer">
                {opening
                  ? "Opening meeting…"
                  : "Select a meeting to explore its transcript and notes."}
              </p>
            </>
          )}
        </main>
      </div>
      {form && (
        <MeetingForm
          meeting={form === "edit" && selected ? selected : undefined}
          onClose={() => setForm(null)}
          onSaved={(m) => {
            setForm(null);
            setSelected(m);
            setView("Meetings");
            setReload((r) => r + 1);
            setToast("Meeting saved");
          }}
        />
      )}{" "}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
