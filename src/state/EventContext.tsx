import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  increment,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, ensureAnonymousAuth, isFirebaseConfigured, storage } from "../firebase";
import { randomId, shuffledIndices, normalizePlayerId } from "../lib/ids";
import { newlyCompletedLines } from "../lib/bingoLines";
import { hashPassword } from "../lib/hash";
import {
  DEFAULT_BINGO_TASKS,
  DEFAULT_CHAOS_POOL,
  DEFAULT_MISSION_POOL,
  DEFAULT_MOMENT_TAGS,
  DEFAULT_VOTING_CATEGORIES,
  JOKER_LIMIT,
  MISSIONS_PER_PLAYER,
  POINTS,
} from "../data/defaults";
import { pickOne, pickRandom } from "../lib/ids";
import { loadSession, saveSession } from "../lib/session";
import type {
  Ballot,
  ChaosEntry,
  EventDoc,
  FeedPost,
  LogEntry,
  LogType,
  MembershipDoc,
  PlayerDoc,
  PlayerMission,
} from "../types";

interface CreateEventInput {
  name: string;
  groomName: string;
  hostName: string;
  eventPassword: string;
  bingoTasks?: string[];
  missionPool?: string[];
  chaosPool?: string[];
  momentTags?: string[];
  votingCategories?: string[];
}

interface EventContextValue {
  ready: boolean;
  configured: boolean;
  event: EventDoc | null;
  players: PlayerDoc[];
  feed: FeedPost[];
  chaos: ChaosEntry[];
  log: LogEntry[];
  ballots: Ballot[];
  currentPlayerId: string | null;
  currentPlayer: PlayerDoc | null;
  loading: boolean;
  error: string | null;
  createEvent: (input: CreateEventInput) => Promise<string>;
  joinEvent: (
    code: string,
    playerName: string,
    isGroom: boolean,
    password: string,
  ) => Promise<void>;
  rejoin: () => Promise<boolean>;
  openMembership: (eventCode: string, playerId: string) => Promise<void>;
  leaveEvent: () => void;
  completeMission: (
    missionId: string,
    file: File,
    caption: string,
  ) => Promise<void>;
  skipMission: (missionId: string) => Promise<void>;
  toggleBingoCell: (cellIndex: number) => Promise<void>;
  spinChaos: () => Promise<ChaosEntry | null>;
  markChaosDone: (chaosId: string) => Promise<void>;
  tagMoment: (tagText: string, aboutPlayerId?: string) => Promise<void>;
  awardPoints: (
    playerId: string,
    delta: number,
    note: string,
    type: LogType,
  ) => Promise<void>;
  uploadFeedPost: (file: File, caption: string) => Promise<void>;
  castVote: (category: string, postId: string) => Promise<void>;
  setHangoverRating: (rating: number) => Promise<void>;
  approvePlayer: (playerId: string) => Promise<void>;
  removePlayer: (playerId: string) => Promise<void>;
}

const EventContext = createContext<EventContextValue | null>(null);

function uid(): string {
  return auth?.currentUser?.uid ?? "local";
}

async function uploadMedia(
  eventCode: string,
  file: File,
): Promise<{ url: string; type: "photo" | "video" }> {
  const type: "photo" | "video" = file.type.startsWith("video") ? "video" : "photo";
  if (storage) {
    const path = `events/${eventCode}/uploads/${randomId()}-${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { url, type };
  }
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { url, type };
}

export function EventProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [players, setPlayers] = useState<PlayerDoc[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [chaos, setChaos] = useState<ChaosEntry[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const error: string | null = null;

  useEffect(() => {
    ensureAnonymousAuth().finally(() => setReady(true));
  }, []);

  // Collection-level ("list") listeners require the requester to already be
  // an approved participant (see Firestore rules). We only attach them once
  // our own player doc confirms approval, so a pending join never receives
  // the feed, the other players, or anything else about the event.
  const subscribeToEvent = useCallback((code: string, myPlayerId: string) => {
    if (!db) return () => {};
    setLoading(true);

    let listUnsubs: Array<() => void> = [];
    let listsStarted = false;

    const startLists = () => {
      if (listsStarted || !db) return;
      listsStarted = true;
      listUnsubs.push(
        onSnapshot(collection(db, "events", code, "players"), (snap) => {
          setPlayers(snap.docs.map((d) => d.data() as PlayerDoc));
        }),
      );
      listUnsubs.push(
        onSnapshot(
          query(collection(db, "events", code, "feed"), orderBy("createdAt", "desc")),
          (snap) => setFeed(snap.docs.map((d) => d.data() as FeedPost)),
        ),
      );
      listUnsubs.push(
        onSnapshot(
          query(collection(db, "events", code, "chaos"), orderBy("createdAt", "desc")),
          (snap) => setChaos(snap.docs.map((d) => d.data() as ChaosEntry)),
        ),
      );
      listUnsubs.push(
        onSnapshot(
          query(collection(db, "events", code, "log"), orderBy("createdAt", "desc")),
          (snap) => setLog(snap.docs.map((d) => d.data() as LogEntry)),
        ),
      );
      listUnsubs.push(
        onSnapshot(collection(db, "events", code, "ballots"), (snap) => {
          setBallots(snap.docs.map((d) => d.data() as Ballot));
        }),
      );
    };

    const unsubEvent = onSnapshot(doc(db, "events", code), (snap) => {
      setEvent(snap.exists() ? (snap.data() as EventDoc) : null);
      setLoading(false);
    });

    const unsubMe = onSnapshot(doc(db, "events", code, "players", myPlayerId), (snap) => {
      const me = snap.exists() ? (snap.data() as PlayerDoc) : null;
      setPlayers((prev) => {
        const others = prev.filter((p) => p.id !== myPlayerId);
        return me ? [...others, me] : others;
      });
      if (me?.approved) startLists();
    });

    return () => {
      unsubEvent();
      unsubMe();
      listUnsubs.forEach((u) => u());
    };
  }, []);

  const unsubRef = useRef<() => void>(() => {});

  const startSubscription = useCallback(
    (code: string, playerId: string) => {
      unsubRef.current();
      unsubRef.current = subscribeToEvent(code, playerId);
    },
    [subscribeToEvent],
  );

  useEffect(() => {
    if (!ready) return;
    const session = loadSession();
    if (!session) return;
    setCurrentPlayerId(session.playerId);
    startSubscription(session.eventCode, session.playerId);
    return () => unsubRef.current();
  }, [ready, startSubscription]);

  const rejoin = useCallback(async (): Promise<boolean> => {
    const session = loadSession();
    if (!session || !db) return false;
    const eventSnap = await getDoc(doc(db, "events", session.eventCode));
    const playerSnap = await getDoc(
      doc(db, "events", session.eventCode, "players", session.playerId),
    );
    if (!eventSnap.exists() || !playerSnap.exists()) return false;
    setCurrentPlayerId(session.playerId);
    startSubscription(session.eventCode, session.playerId);
    return true;
  }, [startSubscription]);

  const createEvent = useCallback(
    async (input: CreateEventInput): Promise<string> => {
      if (!db) throw new Error("Firebase ist nicht konfiguriert.");
      if (!auth?.currentUser || auth.currentUser.isAnonymous) {
        throw new Error(
          "Zum Erstellen eines Events musst du mit Google, Apple oder E-Mail angemeldet sein.",
        );
      }
      const code = randomId().slice(0, 5).toUpperCase();
      const hostAuthUid = uid();
      const hostPlayerId = normalizePlayerId(input.hostName);
      const eventPasswordHash = await hashPassword(input.eventPassword, code);
      const eventDoc: EventDoc = {
        code,
        name: input.name,
        groomName: input.groomName,
        hostPlayerId,
        hostAuthUid,
        eventPasswordHash,
        createdAt: Date.now(),
        bingoTasks: (input.bingoTasks ?? DEFAULT_BINGO_TASKS).slice(0, 25),
        missionPool: input.missionPool ?? DEFAULT_MISSION_POOL,
        chaosPool: input.chaosPool ?? DEFAULT_CHAOS_POOL,
        momentTags: input.momentTags ?? DEFAULT_MOMENT_TAGS,
        votingCategories: input.votingCategories ?? DEFAULT_VOTING_CATEGORIES,
        jokerLimit: JOKER_LIMIT,
      };
      await setDoc(doc(db, "events", code), eventDoc);

      const missions: PlayerMission[] = pickRandom(
        eventDoc.missionPool,
        Math.min(MISSIONS_PER_PLAYER, eventDoc.missionPool.length),
      ).map((text) => ({ id: randomId(), text, status: "open" as const }));

      const playerDoc: PlayerDoc = {
        id: hostPlayerId,
        name: input.hostName,
        authUid: hostAuthUid,
        isGroom: false,
        approved: true,
        joinedAt: Date.now(),
        points: 0,
        jokersLeft: JOKER_LIMIT,
        missions,
        bingoOrder: shuffledIndices(25),
        bingoMarked: [],
        bingoBonusAwarded: [],
        hangoverRating: null,
      };
      await setDoc(doc(db, "events", code, "players", hostPlayerId), playerDoc);
      await setDoc(doc(db, "events", code, "approvedUids", hostAuthUid), {
        approved: true,
        playerId: hostPlayerId,
      });
      const membership: MembershipDoc = {
        eventCode: code,
        eventName: input.name,
        groomName: input.groomName,
        playerId: hostPlayerId,
        playerName: input.hostName,
        role: "host",
        joinedAt: Date.now(),
      };
      await setDoc(doc(db, "users", hostAuthUid, "events", code), membership);

      saveSession({ eventCode: code, playerId: hostPlayerId });
      setCurrentPlayerId(hostPlayerId);
      startSubscription(code, hostPlayerId);
      return code;
    },
    [startSubscription],
  );

  const joinEvent = useCallback(
    async (code: string, playerName: string, isGroom: boolean, eventPassword: string) => {
      if (!db) throw new Error("Firebase ist nicht konfiguriert.");
      await ensureAnonymousAuth();
      const upperCode = code.trim().toUpperCase();
      const trimmedName = playerName.trim();
      const eventSnap = await getDoc(doc(db, "events", upperCode));
      if (!eventSnap.exists()) {
        throw new Error("Kein Event mit diesem Code gefunden.");
      }
      const eventData = eventSnap.data() as EventDoc;
      const enteredHash = await hashPassword(eventPassword, upperCode);
      if (enteredHash !== eventData.eventPasswordHash) {
        throw new Error("Falsches Event-Passwort.");
      }

      const playerId = normalizePlayerId(trimmedName);
      const myUid = uid();
      const existingSnap = await getDoc(doc(db, "events", upperCode, "players", playerId));

      if (existingSnap.exists()) {
        const existing = existingSnap.data() as PlayerDoc;
        if (existing.authUid !== myUid) {
          throw new Error(
            `Der Name „${trimmedName}" ist in diesem Event schon vergeben. Bitte einen anderen Namen wählen.`,
          );
        }
        saveSession({ eventCode: upperCode, playerId: existing.id });
        setCurrentPlayerId(existing.id);
        startSubscription(upperCode, existing.id);
        return;
      }

      const missions: PlayerMission[] = pickRandom(
        eventData.missionPool,
        Math.min(MISSIONS_PER_PLAYER, eventData.missionPool.length),
      ).map((text) => ({ id: randomId(), text, status: "open" as const }));

      const playerDoc: PlayerDoc = {
        id: playerId,
        name: trimmedName,
        authUid: myUid,
        isGroom,
        approved: false,
        joinedAt: Date.now(),
        points: 0,
        jokersLeft: JOKER_LIMIT,
        missions,
        bingoOrder: shuffledIndices(25),
        bingoMarked: [],
        bingoBonusAwarded: [],
        hangoverRating: null,
      };
      await setDoc(doc(db, "events", upperCode, "players", playerId), playerDoc);
      if (auth?.currentUser && !auth.currentUser.isAnonymous) {
        const membership: MembershipDoc = {
          eventCode: upperCode,
          eventName: eventData.name,
          groomName: eventData.groomName,
          playerId,
          playerName: trimmedName,
          role: "guest",
          joinedAt: Date.now(),
        };
        await setDoc(doc(db, "users", myUid, "events", upperCode), membership);
      }
      saveSession({ eventCode: upperCode, playerId });
      setCurrentPlayerId(playerId);
      startSubscription(upperCode, playerId);
    },
    [startSubscription],
  );

  const openMembership = useCallback(
    async (eventCode: string, playerId: string) => {
      saveSession({ eventCode, playerId });
      setCurrentPlayerId(playerId);
      startSubscription(eventCode, playerId);
    },
    [startSubscription],
  );

  const leaveEvent = useCallback(() => {
    unsubRef.current();
    localStorage.removeItem("pragbingo:session");
    setCurrentPlayerId(null);
    setEvent(null);
    setPlayers([]);
    setFeed([]);
    setChaos([]);
    setLog([]);
    setBallots([]);
  }, []);

  const addLog = useCallback(
    async (
      eventCode: string,
      entry: Omit<LogEntry, "id" | "createdAt">,
    ) => {
      if (!db) return;
      const id = randomId();
      const full: LogEntry = { ...entry, id, createdAt: Date.now() };
      await setDoc(doc(db, "events", eventCode, "log", id), full);
    },
    [],
  );

  const currentPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerId) ?? null,
    [players, currentPlayerId],
  );

  const completeMission = useCallback(
    async (missionId: string, file: File, caption: string) => {
      if (!db || !event || !currentPlayer) return;
      const mission = currentPlayer.missions.find((m) => m.id === missionId);
      if (!mission) return;
      const { url, type } = await uploadMedia(event.code, file);
      const postId = randomId();
      const post: FeedPost = {
        id: postId,
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        type,
        url,
        caption,
        missionText: mission.text,
        points: POINTS.missionDone,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "events", event.code, "feed", postId), post);

      const updatedMissions = currentPlayer.missions.map((m) =>
        m.id === missionId
          ? { ...m, status: "done" as const, proofPostId: postId }
          : m,
      );
      await updateDoc(doc(db, "events", event.code, "players", currentPlayer.id), {
        missions: updatedMissions,
        points: increment(POINTS.missionDone),
      });
      await addLog(event.code, {
        type: "mission_done",
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        points: POINTS.missionDone,
        note: mission.text,
      });
    },
    [event, currentPlayer, addLog],
  );

  const skipMission = useCallback(
    async (missionId: string) => {
      if (!db || !event || !currentPlayer) return;
      if (currentPlayer.jokersLeft <= 0) return;
      const mission = currentPlayer.missions.find((m) => m.id === missionId);
      if (!mission || mission.status !== "open") return;
      const updatedMissions = currentPlayer.missions.map((m) =>
        m.id === missionId ? { ...m, status: "skipped" as const } : m,
      );
      await updateDoc(doc(db, "events", event.code, "players", currentPlayer.id), {
        missions: updatedMissions,
        jokersLeft: increment(-1),
      });
      await addLog(event.code, {
        type: "mission_skipped",
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        points: 0,
        note: `Joker eingesetzt: ${mission.text}`,
      });
    },
    [event, currentPlayer, addLog],
  );

  const toggleBingoCell = useCallback(
    async (cellIndex: number) => {
      if (!db || !event || !currentPlayer) return;
      const marked = new Set(currentPlayer.bingoMarked);
      const isMarking = !marked.has(cellIndex);
      if (isMarking) marked.add(cellIndex);
      else marked.delete(cellIndex);

      const awarded = new Set(currentPlayer.bingoBonusAwarded);
      let pointsDelta = 0;
      const newLogEntries: Array<Omit<LogEntry, "id" | "createdAt">> = [];

      if (isMarking) {
        const newLines = newlyCompletedLines(marked, awarded);
        for (const line of newLines) {
          awarded.add(line.key);
          pointsDelta += POINTS.bingoLine;
          newLogEntries.push({
            type: "bingo_line",
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            points: POINTS.bingoLine,
            note: "Bingo-Reihe geschafft!",
          });
        }
        if (marked.size === 25 && !awarded.has("full")) {
          awarded.add("full");
          pointsDelta += POINTS.bingoFull;
          newLogEntries.push({
            type: "bingo_full",
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            points: POINTS.bingoFull,
            note: "Volles Bingo-Board!",
          });
        }
      }

      await updateDoc(doc(db, "events", event.code, "players", currentPlayer.id), {
        bingoMarked: Array.from(marked),
        bingoBonusAwarded: Array.from(awarded),
        points: increment(pointsDelta),
      });
      for (const entry of newLogEntries) {
        await addLog(event.code, entry);
      }
    },
    [event, currentPlayer, addLog],
  );

  const spinChaos = useCallback(async (): Promise<ChaosEntry | null> => {
    const approvedPlayers = players.filter((p) => p.approved);
    if (!db || !event || approvedPlayers.length === 0) return null;
    const target = pickOne(approvedPlayers);
    const task = pickOne(event.chaosPool);
    const id = randomId();
    const entry: ChaosEntry = {
      id,
      targetPlayerId: target.id,
      targetName: target.name,
      task,
      createdAt: Date.now(),
      done: false,
    };
    await setDoc(doc(db, "events", event.code, "chaos", id), entry);
    await addLog(event.code, {
      type: "chaos_assigned",
      playerId: target.id,
      playerName: target.name,
      points: 0,
      note: task,
    });
    return entry;
  }, [event, players, addLog]);

  const markChaosDone = useCallback(
    async (chaosId: string) => {
      if (!db || !event) return;
      const entry = chaos.find((c) => c.id === chaosId);
      if (!entry || entry.done) return;
      await updateDoc(doc(db, "events", event.code, "chaos", chaosId), {
        done: true,
      });
      await updateDoc(doc(db, "events", event.code, "players", entry.targetPlayerId), {
        points: increment(POINTS.chaosDone),
      });
      await addLog(event.code, {
        type: "chaos_done",
        playerId: entry.targetPlayerId,
        playerName: entry.targetName,
        points: POINTS.chaosDone,
        note: entry.task,
      });
    },
    [event, chaos, addLog],
  );

  const tagMoment = useCallback(
    async (tagText: string, aboutPlayerId?: string) => {
      if (!db || !event || !currentPlayer) return;
      const about = players.find((p) => p.id === aboutPlayerId);
      await addLog(event.code, {
        type: "moment_tag",
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        aboutPlayerId: about?.id,
        aboutPlayerName: about?.name,
        points: 0,
        note: tagText,
      });
    },
    [event, currentPlayer, players, addLog],
  );

  const awardPoints = useCallback(
    async (playerId: string, delta: number, note: string, type: LogType) => {
      if (!db || !event) return;
      const target = players.find((p) => p.id === playerId);
      if (!target) return;
      await updateDoc(doc(db, "events", event.code, "players", playerId), {
        points: increment(delta),
      });
      await addLog(event.code, {
        type,
        playerId: target.id,
        playerName: target.name,
        points: delta,
        note,
      });
    },
    [event, players, addLog],
  );

  const uploadFeedPost = useCallback(
    async (file: File, caption: string) => {
      if (!db || !event || !currentPlayer) return;
      const { url, type } = await uploadMedia(event.code, file);
      const postId = randomId();
      const post: FeedPost = {
        id: postId,
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        type,
        url,
        caption,
        points: 0,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "events", event.code, "feed", postId), post);
    },
    [event, currentPlayer],
  );

  const castVote = useCallback(
    async (category: string, postId: string) => {
      if (!db || !event || !currentPlayer) return;
      const ballotId = `${category}::${currentPlayer.id}`;
      const ballot: Ballot = { playerId: currentPlayer.id, postId, category };
      await setDoc(doc(db, "events", event.code, "ballots", ballotId), ballot);
    },
    [event, currentPlayer],
  );

  const setHangoverRating = useCallback(
    async (rating: number) => {
      if (!db || !event || !currentPlayer) return;
      await updateDoc(doc(db, "events", event.code, "players", currentPlayer.id), {
        hangoverRating: rating,
      });
    },
    [event, currentPlayer],
  );

  const approvePlayer = useCallback(
    async (playerId: string) => {
      if (!db || !event || currentPlayer?.id !== event.hostPlayerId) return;
      const target = players.find((p) => p.id === playerId);
      if (!target) return;
      await updateDoc(doc(db, "events", event.code, "players", playerId), {
        approved: true,
      });
      await setDoc(doc(db, "events", event.code, "approvedUids", target.authUid), {
        approved: true,
        playerId,
      });
    },
    [event, currentPlayer, players],
  );

  const removePlayer = useCallback(
    async (playerId: string) => {
      if (!db || !event || currentPlayer?.id !== event.hostPlayerId) return;
      if (playerId === event.hostPlayerId) return;
      const target = players.find((p) => p.id === playerId);
      await deleteDoc(doc(db, "events", event.code, "players", playerId));
      if (target?.authUid) {
        await deleteDoc(doc(db, "events", event.code, "approvedUids", target.authUid)).catch(
          () => {},
        );
      }
    },
    [event, currentPlayer, players],
  );

  const value: EventContextValue = {
    ready,
    configured: isFirebaseConfigured,
    event,
    players,
    feed,
    chaos,
    log,
    ballots,
    currentPlayerId,
    currentPlayer,
    loading,
    error,
    createEvent,
    joinEvent,
    rejoin,
    openMembership,
    leaveEvent,
    completeMission,
    skipMission,
    toggleBingoCell,
    spinChaos,
    markChaosDone,
    tagMoment,
    awardPoints,
    uploadFeedPost,
    castVote,
    setHangoverRating,
    approvePlayer,
    removePlayer,
  };

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEvent must be used within EventProvider");
  return ctx;
}
