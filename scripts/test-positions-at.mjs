/**
 * Animation + derivation smoke tests — run: npm run test:animator
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  describeBeatActions,
  formatAllBeatLines,
  formatBeatLine,
  PLAYER_IDS,
} from "../src/lib/animation/deriveActions.js";
import {
  buildSequentialTimeline,
  getSequentialPlaybackState,
  sequentialTimelineDuration,
} from "../src/lib/sequentialPlayback.js";
import { getPlayAnimatorState } from "../src/lib/playAnimatorEngine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function normalizePlay(raw) {
  const beats = raw.beats ?? raw.frames ?? [];
  return { name: raw.name, frames: beats };
}

function loadPlay(name) {
  const raw = JSON.parse(readFileSync(join(root, "src/data/plays-interpreted.json"), "utf8"));
  const found = raw.find((p) => p.name === name);
  if (!found) throw new Error(`Play not found: ${name}`);
  return normalizePlay(found);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testTimelineBuilds() {
  const play = loadPlay("Conn");
  const timeline = buildSequentialTimeline(play.frames);
  assert(timeline.groups.length > 0, "Conn timeline has groups");
  assert(timeline.setupBall, "Conn setup ball set");
  console.log("✓ timeline builds for Conn");
}

function testPlaybackEndState() {
  const play = loadPlay("Conn");
  const timeline = buildSequentialTimeline(play.frames);
  const duration = sequentialTimelineDuration(timeline, 1);
  const end = getSequentialPlaybackState(timeline, duration);
  assert(end.done, "playback completes");
  assert(end.pos["1"], "players present at end");
  console.log("✓ playback reaches done state");
}

function testSpeedScaling() {
  const play = loadPlay("Conn");
  const timeline = buildSequentialTimeline(play.frames);
  const full = sequentialTimelineDuration(timeline, 1);
  const half = sequentialTimelineDuration(timeline, 2);
  assert(Math.abs(half - full / 2) < 2, "2x speed halves wall duration");

  const atHalfWall = getPlayAnimatorState(play.frames, 0, play.frames.length - 1, half, 2);
  assert(atHalfWall.done, "2x speed completes at half wall time");
  console.log("✓ speed scaling (wall clock vs timeline)");
}

function testHoldUsesAccumulator() {
  const frames = [
    { pos: { 1: { x: 0, y: 0 }, 2: { x: 100, y: 0 } }, ball: "1", actions: [] },
    {
      pos: { 1: { x: 0, y: 0 }, 2: { x: 180, y: 0 } },
      ball: "1",
      actions: [{ id: "a1", type: "cut", by: "2", path: [{ x: 100, y: 0 }, { x: 200, y: 0 }] }],
      note: "Hold here",
    },
  ];
  const timeline = buildSequentialTimeline(frames);
  const duration = sequentialTimelineDuration(timeline, 1);
  let holdState = null;
  for (let t = 0; t < duration; t += 8) {
    const s = getSequentialPlaybackState(timeline, t);
    if (s.phase === "hold" && s.beatIdx === 1) holdState = s;
  }
  assert(holdState, "hold phase reached");
  assert(holdState.pos["2"].x >= 195, "hold keeps route endpoint, not frame.pos shortcut");
  console.log("✓ hold phase preserves interpolated positions");
}

function testDerivationShape() {
  for (const name of ["Conn", "Alabama", "Horns"]) {
    const play = loadPlay(name);
    for (let i = 0; i < play.frames.length; i++) {
      const d = describeBeatActions(play, i);
      for (const id of PLAYER_IDS) {
        assert(d[id], `${name} beat ${i + 1} player ${id} has action label`);
      }
    }
    console.log(`✓ ${name} derivation shape (${play.frames.length} beats)`);
  }
}

function printConn() {
  const conn = loadPlay("Conn");
  console.log("\n=== Conn beat labels ===\n");
  console.log(formatAllBeatLines(conn).join("\n"));
  console.log("\n=== Conn beat 1 ===");
  console.log(formatBeatLine(conn, 0));
}

let failed = 0;
for (const fn of [
  testTimelineBuilds,
  testPlaybackEndState,
  testSpeedScaling,
  testHoldUsesAccumulator,
  testDerivationShape,
]) {
  try {
    fn();
  } catch (e) {
    console.error("✗", e.message);
    failed++;
  }
}

try {
  printConn();
} catch (e) {
  console.error("✗ Conn print", e.message);
  failed++;
}

process.exit(failed ? 1 : 0);
