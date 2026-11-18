// Writes the arena maps (app/game/maps.ts) as JSON for the server, which runs PIXEL_BOT through the same
// platforms and hazards the players see. Run after editing maps.ts:  npm run export-maps
// (MapGeometryTest on the backend fails when backend/src/main/resources/game/maps.json is stale.)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { MAPS } = await import("../app/game/maps.ts");
const out = process.argv[2] ?? fileURLToPath(new URL("../../backend/src/main/resources/game/maps.json", import.meta.url));
writeFileSync(out, JSON.stringify(MAPS, null, 1) + "\n");
console.log(`wrote ${MAPS.length} maps to ${out}`);
