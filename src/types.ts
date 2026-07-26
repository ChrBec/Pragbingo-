export type PlayerId = string;

export interface EventDoc {
  code: string;
  name: string;
  groomName: string;
  hostPlayerId: PlayerId;
  hostAuthUid: string;
  eventPasswordHash: string;
  createdAt: number;
  bingoTasks: string[]; // exactly 25
  missionPool: string[];
  chaosPool: string[];
  momentTags: string[];
  votingCategories: string[];
  jokerLimit: number;
}

export type MissionStatus = "open" | "done" | "skipped";

export interface PlayerMission {
  id: string;
  text: string;
  status: MissionStatus;
  proofPostId?: string;
}

export interface PlayerDoc {
  id: PlayerId;
  name: string;
  authUid: string;
  isGroom: boolean;
  approved: boolean;
  joinedAt: number;
  points: number;
  jokersLeft: number;
  missions: PlayerMission[];
  bingoOrder: number[]; // permutation of 0..24 mapping cell -> task index
  bingoMarked: number[]; // marked cell positions (0..24)
  bingoBonusAwarded: string[]; // which lines already scored, e.g. "row0"
  hangoverRating?: number | null;
}

export type LogType =
  | "mission_done"
  | "mission_skipped"
  | "bonus"
  | "penalty"
  | "bingo_line"
  | "bingo_full"
  | "chaos_assigned"
  | "chaos_done"
  | "moment_tag";

export interface LogEntry {
  id: string;
  type: LogType;
  playerId?: PlayerId;
  playerName?: string;
  aboutPlayerId?: PlayerId;
  aboutPlayerName?: string;
  points: number;
  note: string;
  createdAt: number;
}

export type FeedType = "photo" | "video";

export interface FeedPost {
  id: string;
  playerId: PlayerId;
  playerName: string;
  type: FeedType;
  url: string;
  caption: string;
  missionText?: string;
  points: number;
  createdAt: number;
}

export interface ChaosEntry {
  id: string;
  targetPlayerId: PlayerId;
  targetName: string;
  task: string;
  createdAt: number;
  done: boolean;
}

export interface Ballot {
  playerId: PlayerId;
  postId: string;
  category: string;
}

export interface MembershipDoc {
  eventCode: string;
  eventName: string;
  groomName: string;
  playerId: PlayerId;
  playerName: string;
  role: "host" | "guest";
  joinedAt: number;
}
