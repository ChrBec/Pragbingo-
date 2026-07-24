interface Session {
  eventCode: string;
  playerId: string;
}

const KEY = "pragbingo:session";

export function saveSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.eventCode && parsed.playerId) return parsed;
  } catch {
    // ignore
  }
  return null;
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function hangoverVoteKey(eventCode: string) {
  return `pragbingo:hangover:${eventCode}`;
}
