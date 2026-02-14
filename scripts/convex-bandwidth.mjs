#!/usr/bin/env node
/**
 * Aggregate Convex `convex logs --success --jsonl` output by hour and function.
 *
 * Usage examples:
 *   cd packages/backend
 *   bunx convex logs --prod --success --jsonl --history 50000 > /tmp/convex.jsonl
 *   node ../../scripts/convex-bandwidth.mjs < /tmp/convex.jsonl
 *
 * Notes:
 * - On the free plan there is no built-in "per hour / per function bandwidth" dashboard.
 *   This script lets you approximate it from logs (going forward / within retention).
 * - Bytes here are Convex-reported usageStats (DB + storage + vector) and returnBytes.
 */

import readline from "node:readline";

function parseArgs(argv) {
  const out = { utc: false, top: 10 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--utc") out.utc = true;
    else if (a === "--top") {
      const v = Number(argv[i + 1]);
      if (Number.isFinite(v) && v > 0) out.top = v;
      i++;
    }
  }
  return out;
}

function hourKeyFromSeconds(sec, utc) {
  const ms = Math.floor(sec * 1000);
  const d = new Date(ms);
  const y = utc ? d.getUTCFullYear() : d.getFullYear();
  const m = (utc ? d.getUTCMonth() : d.getMonth()) + 1;
  const day = utc ? d.getUTCDate() : d.getDate();
  const h = utc ? d.getUTCHours() : d.getHours();
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${y}-${pad2(m)}-${pad2(day)} ${pad2(h)}:00`;
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let u = 0;
  let v = n;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[u]}`;
}

const { utc, top } = parseArgs(process.argv);

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

// hourKey -> functionIdentifier -> stats
const buckets = new Map();

let stopRequested = false;
process.on("SIGINT", () => {
  stopRequested = true;
  rl.close();
});

try {
  for await (const line of rl) {
    if (stopRequested) break;

    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;

    let evt;
    try {
      evt = JSON.parse(trimmed);
    } catch {
      continue;
    }

    // We care about function executions. "Completion" covers queries/mutations/actions.
    if (evt.kind !== "Completion") continue;
    const id = evt.identifier;
    const ts = evt.executionTimestamp ?? evt.timestamp;
    const usage = evt.usageStats;
    if (!id || typeof ts !== "number" || !usage) continue;

    const hourKey = hourKeyFromSeconds(ts, utc);

    let byFn = buckets.get(hourKey);
    if (!byFn) {
      byFn = new Map();
      buckets.set(hourKey, byFn);
    }

    let s = byFn.get(id);
    if (!s) {
      s = {
        calls: 0,
        dbRead: 0,
        dbWrite: 0,
        storageRead: 0,
        storageWrite: 0,
        vectorRead: 0,
        vectorWrite: 0,
        returned: 0,
      };
      byFn.set(id, s);
    }

    s.calls++;
    s.dbRead += usage.databaseReadBytes ?? 0;
    s.dbWrite += usage.databaseWriteBytes ?? 0;
    s.storageRead += usage.storageReadBytes ?? 0;
    s.storageWrite += usage.storageWriteBytes ?? 0;
    s.vectorRead += usage.vectorIndexReadBytes ?? 0;
    s.vectorWrite += usage.vectorIndexWriteBytes ?? 0;
    s.returned += evt.returnBytes ?? 0;
  }
} catch {
  // Swallow errors from closing stdin during streaming.
}

const hours = [...buckets.keys()].sort();
for (const hour of hours) {
  const byFn = buckets.get(hour);
  const rows = [...byFn.entries()].map(([fn, s]) => {
    const db = s.dbRead + s.dbWrite;
    const storage = s.storageRead + s.storageWrite;
    const vector = s.vectorRead + s.vectorWrite;
    const total = db + storage + vector;
    return { hour, fn, ...s, db, storage, vector, total };
  });

  rows.sort((a, b) => b.total - a.total);
  const hourTotal = rows.reduce((acc, r) => acc + r.total, 0);

  process.stdout.write(`\n${hour}  total=${formatBytes(hourTotal)}\n`);
  for (const r of rows.slice(0, top)) {
    process.stdout.write(
      [
        `  ${r.fn}`,
        `calls=${r.calls}`,
        `db=${formatBytes(r.db)}`,
        `storage=${formatBytes(r.storage)}`,
        `vector=${formatBytes(r.vector)}`,
        `returned=${formatBytes(r.returned)}`,
      ].join("  ") + "\n"
    );
  }
}
