import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../src/data/plays-breakdowns.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

for (const name of Object.keys(data)) {
  const bd = data[name];
  data[name] = {
    intent: bd.intent?.trim() || "",
    motions: Array.isArray(bd.motions) ? bd.motions : [],
  };
}

fs.writeFileSync(file, JSON.stringify(data, null, 1));
console.log(`Stripped ${Object.keys(data).length} breakdowns to intent + motions only.`);
