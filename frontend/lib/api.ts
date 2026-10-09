export type Segment = {
  id: number;
  speaker: string;
  timestamp: number;
  text: string;
};
export type ActionItem = {
  id: number;
  text: string;
  assignee: string;
  completed: boolean;
};
export type Meeting = {
  id: number;
  title: string;
  date: string;
  duration: number;
  participants: string[];
  summary: string;
};
export type MeetingDetail = Meeting & {
  transcripts: Segment[];
  action_items: ActionItem[];
  chapters: { id: number; title: string; timestamp: number }[];
};
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    signal,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = Array.isArray(error.detail)
      ? error.detail.map((e: { msg: string }) => e.msg).join(". ")
      : error.detail;
    throw new Error(message || "Request failed. Please try again.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function time(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
export function displayDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
