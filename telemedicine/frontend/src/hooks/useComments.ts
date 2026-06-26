import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import type { Comment } from "../types";

const POLL_INTERVAL_MS = 5000;

interface UseCommentsResult {
  comments: Comment[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  add: (text: string, author?: string) => Promise<boolean>;
}

/**
 * Loads a patient's doctor comments and polls so notes posted from anywhere
 * (another browser/device) show up here too. `add` posts a new comment and
 * refreshes the list.
 */
export function useComments(patientId: string): UseCommentsResult {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getComments(patientId);
      if (activeRef.current) {
        setComments(data);
        setError(null);
      }
    } catch {
      if (activeRef.current) setError("Could not load comments");
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    activeRef.current = true;
    setLoading(true);
    refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      activeRef.current = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const add = useCallback(
    async (text: string, author?: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      setSubmitting(true);
      try {
        const created = await api.addComment(patientId, trimmed, author);
        if (activeRef.current) {
          // Optimistically prepend, then a poll will reconcile if needed.
          setComments((prev) => [created, ...prev]);
          setError(null);
        }
        return true;
      } catch {
        if (activeRef.current) setError("Could not post comment");
        return false;
      } finally {
        if (activeRef.current) setSubmitting(false);
      }
    },
    [patientId],
  );

  return { comments, loading, submitting, error, add };
}
