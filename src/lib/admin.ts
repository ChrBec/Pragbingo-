import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getMetadata, ref } from "firebase/storage";
import { db, storage } from "../firebase";
import type { ChallengeDoc, EventDoc, FeedPost, PlayerDoc } from "../types";

function requireDb() {
  if (!db) throw new Error("Firebase ist nicht konfiguriert.");
  return db;
}

export interface AdminEventSummary {
  code: string;
  name: string;
  groomName: string;
  createdAt: number;
  hostAuthUid: string;
  hostPlayerId: string;
  playerCount: number;
}

export async function listAdminEvents(): Promise<AdminEventSummary[]> {
  const database = requireDb();
  const snap = await getDocs(collection(database, "events"));
  const events = await Promise.all(
    snap.docs.map(async (eventDoc) => {
      const data = eventDoc.data() as EventDoc;
      const playersSnap = await getDocs(
        collection(database, "events", data.code, "players"),
      );
      return {
        code: data.code,
        name: data.name,
        groomName: data.groomName,
        createdAt: data.createdAt,
        hostAuthUid: data.hostAuthUid,
        hostPlayerId: data.hostPlayerId,
        playerCount: playersSnap.size,
      };
    }),
  );
  return events.sort((a, b) => b.createdAt - a.createdAt);
}

export interface AdminPlayerUsage {
  playerId: string;
  name: string;
  authUid: string;
  approved: boolean;
  isHost: boolean;
  points: number;
  joinedAt: number;
  fileCount: number;
  bytes: number;
}

export interface AdminEventUsage {
  players: AdminPlayerUsage[];
  totalBytes: number;
  totalFiles: number;
}

export async function loadEventUsage(event: AdminEventSummary): Promise<AdminEventUsage> {
  const database = requireDb();
  const [playersSnap, feedSnap] = await Promise.all([
    getDocs(collection(database, "events", event.code, "players")),
    getDocs(collection(database, "events", event.code, "feed")),
  ]);
  const players = playersSnap.docs.map((d) => d.data() as PlayerDoc);
  const feedPosts = feedSnap.docs.map((d) => d.data() as FeedPost);

  const usageByPlayer = new Map<string, { bytes: number; files: number }>();
  await Promise.all(
    feedPosts.map(async (post) => {
      if (!storage) return;
      try {
        const meta = await getMetadata(ref(storage, post.url));
        const entry = usageByPlayer.get(post.playerId) ?? { bytes: 0, files: 0 };
        entry.bytes += meta.size;
        entry.files += 1;
        usageByPlayer.set(post.playerId, entry);
      } catch {
        // file missing / unreadable - just skip it, not fatal for the overview
      }
    }),
  );

  const playerUsages: AdminPlayerUsage[] = players
    .map((p) => {
      const usage = usageByPlayer.get(p.id) ?? { bytes: 0, files: 0 };
      return {
        playerId: p.id,
        name: p.name,
        authUid: p.authUid,
        approved: p.approved,
        isHost: p.id === event.hostPlayerId,
        points: p.points,
        joinedAt: p.joinedAt,
        fileCount: usage.files,
        bytes: usage.bytes,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalBytes = playerUsages.reduce((sum, p) => sum + p.bytes, 0);
  const totalFiles = playerUsages.reduce((sum, p) => sum + p.fileCount, 0);
  return { players: playerUsages, totalBytes, totalFiles };
}

export interface DeleteUserResult {
  deletedFiles: number;
  deletedDocs: number;
}

// Removes every trace of one participant from one event: their photos/videos
// (Storage + feed docs), log/chaos mentions, votes cast, challenge bids and
// challenge-winner entries, the approval marker, the player profile itself,
// and their "Meine Events" membership entry. Does NOT touch their Firebase
// Auth identity (email/password credential) - a pure client app has no way
// to delete another user's Auth account without a Cloud Function + Admin SDK.
export async function deleteUserFromEvent(
  eventCode: string,
  playerId: string,
  authUid: string,
): Promise<DeleteUserResult> {
  const database = requireDb();
  let deletedFiles = 0;
  let deletedDocs = 0;

  const feedSnap = await getDocs(
    query(collection(database, "events", eventCode, "feed"), where("playerId", "==", playerId)),
  );
  for (const feedDoc of feedSnap.docs) {
    const post = feedDoc.data() as FeedPost;
    if (storage) {
      try {
        await deleteObject(ref(storage, post.url));
        deletedFiles += 1;
      } catch {
        // already gone
      }
    }
    await deleteDoc(feedDoc.ref);
    deletedDocs += 1;
  }

  const logSnap = await getDocs(collection(database, "events", eventCode, "log"));
  for (const logDoc of logSnap.docs) {
    const entry = logDoc.data() as { playerId?: string; aboutPlayerId?: string };
    if (entry.playerId === playerId || entry.aboutPlayerId === playerId) {
      await deleteDoc(logDoc.ref);
      deletedDocs += 1;
    }
  }

  const chaosSnap = await getDocs(collection(database, "events", eventCode, "chaos"));
  for (const chaosDoc of chaosSnap.docs) {
    const entry = chaosDoc.data() as { targetPlayerId?: string };
    if (entry.targetPlayerId === playerId) {
      await deleteDoc(chaosDoc.ref);
      deletedDocs += 1;
    }
  }

  const ballotSnap = await getDocs(
    query(
      collection(database, "events", eventCode, "ballots"),
      where("playerId", "==", playerId),
    ),
  );
  for (const ballotDoc of ballotSnap.docs) {
    await deleteDoc(ballotDoc.ref);
    deletedDocs += 1;
  }

  const challengesSnap = await getDocs(collection(database, "events", eventCode, "challenges"));
  for (const challengeDoc of challengesSnap.docs) {
    const bidRef = doc(
      database,
      "events",
      eventCode,
      "challenges",
      challengeDoc.id,
      "bids",
      playerId,
    );
    const bidSnap = await getDoc(bidRef);
    if (bidSnap.exists()) {
      await deleteDoc(bidRef);
      deletedDocs += 1;
    }
    const challenge = challengeDoc.data() as ChallengeDoc;
    if (challenge.winners?.some((w) => w.playerId === playerId)) {
      await updateDoc(challengeDoc.ref, {
        winners: challenge.winners.filter((w) => w.playerId !== playerId),
        votedPlayerIds: (challenge.votedPlayerIds ?? []).filter((id) => id !== playerId),
      });
    }
  }

  await deleteDoc(doc(database, "events", eventCode, "approvedUids", authUid)).catch(() => {});
  await deleteDoc(doc(database, "users", authUid, "events", eventCode)).catch(() => {});
  await deleteDoc(doc(database, "events", eventCode, "players", playerId));
  deletedDocs += 1;

  return { deletedFiles, deletedDocs };
}

// Full cascade delete of an event - used when the person being erased is the
// host (without them the event has no owner) or when an admin wants to wipe
// a whole event outright.
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

export async function deleteEntireEvent(eventCode: string): Promise<void> {
  const database = requireDb();
  const playersSnap = await getDocs(collection(database, "events", eventCode, "players"));
  const players = playersSnap.docs.map((d) => d.data() as PlayerDoc);

  for (const player of players) {
    await deleteUserFromEvent(eventCode, player.id, player.authUid).catch(() => {});
  }

  for (const name of ["chaos", "log", "challenges"] as const) {
    const snap = await getDocs(collection(database, "events", eventCode, name));
    for (const d of snap.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }
  }

  await deleteDoc(doc(database, "events", eventCode));
}
