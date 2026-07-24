import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, ensureAnonymousAuth, isFirebaseConfigured, storage } from "../firebase";
import { randomId, shuffledIndices } from "../lib/ids";
import { newlyCompletedLines } from "../lib/bingoLines";
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
  PlayerDoc,
  PlayerMission,
} from "../types";

interface CreateEventInput {
  name: string;
  groomName: string;
  hostName: string;
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
  ) => Promise<void>;
  rejoin: () => Promise<boolean>;
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

  const subscribeToEvent = useCallback((code: string) => {
    if (!db) return () => {};
    setLoading(true);
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(doc(db, "events", code), (snap) => {
        setEvent(snap.exists() ? (snap.data() as EventDoc) : null);
        setLoading(false);
      }),
    );
    unsubs.push(
      onSnapshot(collection(db, "events", code, "players"), (snap) => {
        setPlayers(snap.docs.map((d) => d.data() as PlayerDoc));
      }),
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, "events", code, "feed"), orderBy("createdAt", "desc")),
        (snap) => setFeed(snap.docs.map((d) => d.data() as FeedPost)),
      ),
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, "events", code, "chaos"), orderBy("createdAt", "desc")),
        (snap) => setChaos(snap.docs.map((d) => d.data() as ChaosEntry)),
      ),
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, "events", code, "log"), orderBy("createdAt", "desc")),
        (snap) => setLog(snap.docs.map((d) => d.data() as LogEntry)),
      ),
    );
    unsubs.push(
      onSnapshot(collection(db, "events", code, "ballots"), (snap) => {
        setBallots(snap.docs.map((d) => d.data() as Ballot));
      }),
    );

    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!ready) return;
    const session = loadSession();
    if (!session) return;
    setCurrentPlayerId(session.playerId);
    const unsub = subscribeToEvent(session.eventCode);
    return unsub;
  }, [ready, subscribeToEvent]);

  const rejoin = useCallback(async (): Promise<boolean> => {
    const session = loadSession();
    if (!session || !db) return false;
    const eventSnap = await getDoc(doc(db, "events", session.eventCode));
    const playerSnap = await getDoc(
      doc(db, "events", session.eventCode, "players", session.playerId),
    );
    if (!eventSnap.exists() || !playerSnap.exists()) return false;
    setCurrentPlayerId(session.playerId);
    subscribeToEvent(session.eventCode);
    return true;
  }, [subscribeToEvent]);

  const createEvent = useCallback(
    async (input: CreateEventInput): Promise<string> => {
      if (!db) throw new Error("Firebase ist nicht konfiguriert.");
      await ensureAnonymousAuth();
      const code = randomId().slice(0, 5).toUpperCase();
      const hostPlayerId = uid() + "_" + randomId().slice(0, 4);
      const eventDoc: EventDoc = {
        code,
        name: input.name,
        groomName: input.groomName,
        hostPlayerId,
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
        isGroom: false,
        joinedAt: Date.now(),
        points: 0,
        jokersLeft: JOKER_LIMIT,
        missions,
        bingoOrder: shuffledIndices(25),
        bingoMarked: [],
        bingoBonusAwarded: [],
        hangoverRating: null,
      };
      await setDoc(
        doc(db, "events", code, "players", hostPlayerId),
        playerDoc,
      );

      saveSession({ eventCode: code, playerId: hostPlayerId });
      setCurrentPlayerId(hostPlayerId);
      subscribeToEvent(code);
      return code;
    },
    [subscribeToEvent],
  );

  const joinEvent = useCallback(
    async (code: string, playerName: string, isGroom: boolean) => {
      if (!db) throw new Error("Firebase ist nicht konfiguriert.");
      await ensureAnonymousAuth();
      const upperCode = code.trim().toUpperCase();
      const eventSnap = await getDoc(doc(db, "events", upperCode));
      if (!eventSnap.exists()) {
        throw new Error("Kein Event mit diesem Code gefunden.");
      }
      const eventData = eventSnap.data() as EventDoc;
      const playerId = uid() + "_" + randomId().slice(0, 4);

      const missions: PlayerMission[] = pickRandom(
        eventData.missionPool,
        Math.min(MISSIONS_PER_PLAYER, eventData.missionPool.length),
      ).map((text) => ({ id: randomId(), text, status: "open" as const }));

      const playerDoc: PlayerDoc = {
        id: playerId,
        name: playerName,
        isGroom,
        joinedAt: Date.now(),
        points: 0,
        jokersLeft: JOKER_LIMIT,
        missions,
        bingoOrder: shuffledIndices(25),
        bingoMarked: [],
        bingoBonusAwarded: [],
        hangoverRating: null,
      };
      await setDoc(
        doc(db, "events", upperCode, "players", playerId),
        playerDoc,
      );
      saveSession({ eventCode: upperCode, playerId });
      setCurrentPlayerId(playerId);
      subscribeToEvent(upperCode);
    },
    [subscribeToEvent],
  );

  const leaveEvent = useCallback(() => {
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
    if (!db || !event || players.length === 0) return null;
    const target = pickOne(players);
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
  };

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEvent must be used within EventProvider");
  return ctx;
}
