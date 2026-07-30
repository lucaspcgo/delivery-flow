import type { NotesAuditEntry } from "./api";
import { getUser } from "./auth";

/**
 * Local (browser-side) audit trail for the admin "Observações" (notes) field.
 *
 * The backend may or may not expose `/admin/users/{id}/notes-history`. When it
 * does not, we still want the panel to answer "who changed the notes and when".
 * Entries recorded here are merged with (and never override) server entries.
 */
const STORAGE_KEY = "admin_notes_audit_v1";
const MAX_ENTRIES_PER_USER = 50;

type Store = Record<string, NotesAuditEntry[]>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full / disabled: the audit trail is best-effort only.
  }
}

/** Local entries for a user, newest first. */
export function getLocalNotesHistory(userId: string): NotesAuditEntry[] {
  const list = readStore()[userId];
  return Array.isArray(list) ? list : [];
}

/** Records a notes change performed by the currently logged-in admin. */
export function recordLocalNotesChange(
  userId: string,
  previousNotes: string | null | undefined,
  newNotes: string | null | undefined,
): NotesAuditEntry | null {
  const prev = (previousNotes ?? "").trim();
  const next = (newNotes ?? "").trim();
  if (prev === next) return null;

  const actor = getUser();
  const entry: NotesAuditEntry = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    previous_notes: prev || null,
    new_notes: next || null,
    changed_by: actor?.id ?? null,
    changed_by_name: actor?.name ?? null,
    changed_by_email: actor?.email ?? null,
    changed_at: new Date().toISOString(),
  };

  const store = readStore();
  const list = Array.isArray(store[userId]) ? store[userId] : [];
  store[userId] = [entry, ...list].slice(0, MAX_ENTRIES_PER_USER);
  writeStore(store);
  return entry;
}

/** Merges server + local entries, de-duplicated and sorted newest first. */
export function mergeNotesHistory(
  server: NotesAuditEntry[],
  local: NotesAuditEntry[],
): NotesAuditEntry[] {
  const seen = new Set<string>();
  const key = (e: NotesAuditEntry) =>
    e.id ?? `${e.changed_at ?? ""}|${e.changed_by ?? ""}|${e.new_notes ?? ""}`;
  const all = [...server, ...local].filter((e) => {
    const k = key(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return all.sort((a, b) => {
    const ta = a.changed_at ? new Date(a.changed_at).getTime() : 0;
    const tb = b.changed_at ? new Date(b.changed_at).getTime() : 0;
    return tb - ta;
  });
}