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
const NOTES_STORAGE_KEY = "admin_notes_values_v1";
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

/**
 * Local persistence of the notes VALUE itself.
 *
 * Some backends silently drop unknown fields on `PUT /admin/users/{id}`, so the
 * note typed by the admin disappears on the next reload. We keep a browser-side
 * copy as a fallback: the server value always wins when it is present.
 */
type NotesValueStore = Record<string, string>;

function readNotesStore(): NotesValueStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as NotesValueStore;
  } catch {
    return {};
  }
}

/** Stores (or clears) the local fallback copy of a user's notes. */
export function setLocalNotes(userId: string, notes: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const store = readNotesStore();
  const value = (notes ?? "").trim();
  if (value) store[userId] = value;
  else delete store[userId];
  try {
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best-effort only.
  }
}

/** Reads the local fallback copy of a user's notes (empty string when absent). */
export function getLocalNotes(userId: string): string {
  const v = readNotesStore()[userId];
  return typeof v === "string" ? v : "";
}

/** Applies local fallback notes to a list of users that came back without them. */
export function withLocalNotes<T extends { id: string; notes?: string | null }>(
  users: T[],
): T[] {
  const store = readNotesStore();
  return users.map((u) => {
    const serverNotes = (u.notes ?? "").trim();
    if (serverNotes) return u;
    const local = store[u.id];
    return local ? { ...u, notes: local } : u;
  });
}