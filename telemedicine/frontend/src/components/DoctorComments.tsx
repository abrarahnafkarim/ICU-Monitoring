import { useState } from "react";
import { Send, Stethoscope } from "lucide-react";

import { useComments } from "../hooks/useComments";
import type { Comment } from "../types";
import { Card } from "./ui/Card";

/** Format an ISO timestamp as an absolute date/time, e.g. "26 Jun 2026, 14:32". */
function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Short relative time, e.g. "just now", "5 min ago", "2 h ago". */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <li className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-primary">
          {comment.author}
        </span>
        <span
          className="shrink-0 text-xs text-muted"
          title={formatAbsolute(comment.timestamp)}
        >
          {formatRelative(comment.timestamp)}
        </span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-text">
        {comment.text}
      </p>
      <p className="mt-1 text-[11px] text-muted/70">
        {formatAbsolute(comment.timestamp)}
      </p>
    </li>
  );
}

export function DoctorComments({ patientId }: { patientId: string }) {
  const { comments, loading, submitting, error, add } = useComments(patientId);
  const [text, setText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    const ok = await add(text);
    if (ok) setText("");
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Stethoscope size={18} strokeWidth={2.2} />
          </span>
          <h2 className="text-base font-semibold text-text">Doctor's Notes</h2>
        </div>
        {comments.length > 0 && (
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {comments.length}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="no-print flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a clinical note…"
          rows={2}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="inline-flex items-center justify-center gap-2 self-end rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={15} strokeWidth={2.2} />
          {submitting ? "Posting…" : "Post note"}
        </button>
      </form>

      {error && <p className="text-xs text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading notes…</p>
      ) : comments.length === 0 ? (
        <p className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-muted">
          No notes yet. Add the first observation above.
        </p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} />
          ))}
        </ul>
      )}
    </Card>
  );
}
