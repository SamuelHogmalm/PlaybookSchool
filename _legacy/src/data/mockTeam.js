/** Demo team data — replaces with Supabase later */

export const TEAM = {
  name: "West Valley Eagles",
  joinCode: "JXN-4829",
};

export const ROSTER = [
  { id: "p1", jersey: 23, name: "Marcus Chen", position: "PG", lastActive: "Today", mastered: 12, total: 36, streak: 5 },
  { id: "p2", jersey: 11, name: "Jordan Ellis", position: "SF", lastActive: "Yesterday", mastered: 8, total: 36, streak: 2 },
  { id: "p3", jersey: 44, name: "Tyler Brooks", position: "C", lastActive: "3 days ago", mastered: 4, total: 36, streak: 0 },
  { id: "p4", jersey: 7, name: "Alex Rivera", position: "SG", lastActive: "Today", mastered: 15, total: 36, streak: 8 },
  { id: "p5", jersey: 32, name: "Sam Lindqvist", position: "PF", lastActive: "Today", mastered: 10, total: 36, streak: 3 },
];

/** Current logged-in player demo */
export const CURRENT_PLAYER = ROSTER[4];

export const ASSIGNMENTS = [
  {
    id: "a1",
    title: "Horns sets — before scrimmage",
    plays: ["Horns", "Kickup", "Kentucky"],
    due: "Friday",
    coachNote: "Focus on your weakside cut on beat 3.",
    type: "quiz",
    completed: false,
  },
  {
    id: "a2",
    title: "Alabama review",
    plays: ["Alabama"],
    due: "Today",
    coachNote: "You missed the roll last time — watch beat 2.",
    type: "study",
    completed: false,
  },
];

export const REVIEW_QUEUE = {
  count: 12,
  plays: ["Conn", "Down", "Idaho", "Kansas"],
};

export const PLAYER_MASTERY = [
  { play: "Horns", pct: 92, status: "mastered" },
  { play: "Alabama", pct: 68, status: "learning" },
  { play: "Kentucky", pct: 45, status: "learning" },
  { play: "Kickup", pct: 30, status: "learning" },
  { play: "Conn", pct: 15, status: "learning" },
];

export const COACH_ASSIGNMENTS = [
  { id: "ca1", title: "Horns sets — before scrimmage", target: "Whole team", due: "Fri Mar 7", done: 9, total: 14 },
  { id: "ca2", title: "Alabama — guards only", target: "Guards", due: "Wed Mar 5", done: 3, total: 4 },
];

export const TEAM_READINESS = 72;

export const FORGOTTEN_PLAYS = [
  { name: "Kentucky", missRate: 68 },
  { name: "Conn", missRate: 54 },
  { name: "Kickup", missRate: 41 },
];
