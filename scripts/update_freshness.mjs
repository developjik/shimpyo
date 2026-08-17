#!/usr/bin/env node
/**
 * update_freshness.mjs — 데이터 신선도 기록.
 * data/freshness.json { last_run, rules_version, rules_verified, stale_after_days }
 * 앱은 rules 검증일로부터 180일 경과 시 헤더에 경고 배지를 띄운다 (죽음 테스트 표시부).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");

const mVer = html.match(/version:\s*"v[\d.]+"/);
const mDate = html.match(/verified:\s*"([\d-]+)"/);

const out = {
  last_run: new Date().toISOString(),
  rules_version: mVer ? mVer[0].replace(/.*"(.*)"/, "$1") : "unknown",
  rules_verified: mDate ? mDate[1] : "unknown",
  stale_after_days: 180,
};
mkdirSync(join(root, "data"), { recursive: true });
writeFileSync(join(root, "data", "freshness.json"), JSON.stringify(out, null, 1));
console.log(`freshness: ${JSON.stringify(out)}`);
