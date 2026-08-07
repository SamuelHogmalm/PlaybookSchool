import { writeFile } from "fs/promises";
import path from "path";

/** Dev-only: write import session to canonical playbook JSON files. */
export async function POST(request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "Save to disk is disabled in production. Download JSON and commit manually." },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { plays, breakdowns } = body;
  if (!Array.isArray(plays) || !plays.length) {
    return Response.json({ error: "plays array required" }, { status: 400 });
  }

  const root = process.cwd();
  const interpretedPath = path.join(root, "src", "data", "plays-interpreted.json");
  const breakdownPath = path.join(root, "src", "data", "plays-breakdowns.json");

  await writeFile(interpretedPath, `${JSON.stringify(plays, null, 1)}\n`, "utf8");

  if (breakdowns && typeof breakdowns === "object") {
    await writeFile(breakdownPath, `${JSON.stringify(breakdowns, null, 1)}\n`, "utf8");
  }

  return Response.json({
    ok: true,
    playCount: plays.length,
    paths: {
      interpreted: "src/data/plays-interpreted.json",
      breakdowns: breakdowns ? "src/data/plays-breakdowns.json" : null,
    },
  });
}
