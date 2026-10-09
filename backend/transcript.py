"""Parse readable transcript text; no audio transcription or paid AI service."""
import re

def parse_transcript(raw: str):
    segments = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        match = re.match(r"^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)$", line)
        timestamp = segments[-1]["timestamp"] + 30 if segments else 0
        if match:
            parts = [int(part) for part in match[1].split(":")]
            if any(part >= 60 for part in parts[1:]):
                raise ValueError("Timestamp seconds and minutes must be below 60.")
            timestamp = sum(value * 60 ** index for index, value in enumerate(reversed(parts)))
            line = match[2]
        speaker, separator, text = line.partition(":")
        if not separator or len(speaker) > 80:
            speaker, text = "Speaker", line
        if text.strip():
            segments.append({"speaker": speaker.strip() or "Speaker", "timestamp": timestamp, "text": text.strip()})
    if not segments:
        raise ValueError("Please provide at least one transcript line.")
    return sorted(segments, key=lambda segment: segment["timestamp"])

def make_notes(segments):
    # Deterministic mock notes: easy to explain, and works without an API key.
    summary = " ".join(segment["text"] for segment in segments[:4])
    actions = [segment for segment in segments if re.search(r"\b(will|todo|action|need to|follow up)\b", segment["text"], re.I)]
    step = max(1, len(segments) // 3)
    chapters = [{"title": s["text"][:65], "timestamp": s["timestamp"]} for s in segments[::step][:4]]
    return summary, actions[:8], chapters
