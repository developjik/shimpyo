/**
 * snapshot_check.ts — 데이터 리니지 매니페스트 (2026-08-18, 토론 D7 3일 스킴)
 * engine.ts에 임베드된 시계열(US_CSV/KR_CSV/KR_DIV)과 data/ecos_snapshot.json의
 * sha256 + 커버리지를 data/snapshots/manifest.json 에 기록/검증.
 *
 *   node --experimental-strip-types scripts/snapshot_check.ts --write  → 갱신
 *   node --experimental-strip-types scripts/snapshot_check.ts          → 검증(불일치 시 exit 1)
 *
 * CI에서 검증 실패 = 데이터가 매니페스트 없이 바뀜 = 배포 차단.
 * 앱 푸터는 public/snapshot.json (버전·생성일만) 을 읽어 "데이터 기준" 표시.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const engineSrc = readFileSync(join(root, "src/lib/engine.ts"), "utf8");

function extractTemplate(name: string): string {
  const tplRe = new RegExp("export const " + name + " =`([\\s\\S]*?)`;");
  const objRe = new RegExp("export const " + name + " ={([\\s\\S]*?)};");
  const m = engineSrc.match(tplRe) || engineSrc.match(objRe);
  if (!m) throw new Error(name + " 추출 실패");
  return m[1];
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function coverage(csv: string): { first: number; last: number; rows: number } {
  const years = [...csv.matchAll(/^(\d{4}),/gm)].map((m) => Number(m[1]));
  return { first: years[0], last: years[years.length - 1], rows: years.length };
}

const now = new Date();
const version = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

const us = extractTemplate("US_CSV");
const kr = extractTemplate("KR_CSV");
const div = extractTemplate("KR_DIV");
const ecosPath = join(root, "data/ecos_snapshot.json");
const ecos = existsSync(ecosPath) ? readFileSync(ecosPath, "utf8") : "";

const manifest = {
  version,
  generated: now.toISOString().slice(0, 10),
  hashes: {
    us_csv: sha256(us),
    kr_csv: sha256(kr),
    kr_div: sha256(div),
    ecos_snapshot: ecos ? sha256(ecos) : null,
  },
  coverage: {
    us: coverage(us),
    kr: coverage(kr),
    kr_div: "2001-2025 (KR_DIV keys)",
  },
  sources: {
    us: "Damodaran/NYU 1928-2025 · FRED 교차검증",
    kr: "KOSPI PR(위키 연말종가·재배포 금지로 수익률 변환값만 임베드) · 국고채3Y YTM ECOS · CPI ECOS",
    kr_div: "ECOS 1.5.1.2 (전기 현금배당 기준)",
    ecos: "BOK ECOS 월간 자동갱신 (매월 5일 06:00 KST Actions)",
  },
  license_notes: "KOSPI 지수 원본 수치 재배포 금지 — 임베드는 수익률(변환값)만. ECOS 출처 표기 조건 준수.",
};

const manifestPath = join(root, "data/snapshots/manifest.json");
const WRITE = process.argv.includes("--write");

if (WRITE) {
  mkdirSync(join(root, "data/snapshots"), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(
    join(root, "public/snapshot.json"),
    JSON.stringify({ version: manifest.version, generated: manifest.generated, coverage: manifest.coverage }, null, 2) + "\n",
  );
  console.log(`snapshot manifest 갱신: v${version} (sha us=${manifest.hashes.us_csv.slice(0, 8)} kr=${manifest.hashes.kr_csv.slice(0, 8)})`);
  process.exit(0);
}

// 검증 모드
if (!existsSync(manifestPath)) {
  console.error("FAIL — data/snapshots/manifest.json 없음. `npm run snapshot` 으로 생성하세요.");
  process.exit(1);
}
const saved = JSON.parse(readFileSync(manifestPath, "utf8"));
const diffs: string[] = [];
for (const k of Object.keys(manifest.hashes)) {
  const a = manifest.hashes[k], b = saved.hashes?.[k];
  if (a !== b) diffs.push(`${k}: ${String(b)?.slice(0, 8) ?? "없음"} → ${String(a)?.slice(0, 8)}`);
}
if (diffs.length) {
  console.error(`FAIL — 데이터가 매니페스트와 불일치 (데이터를 바꿨으면 npm run snapshot 으로 리니지를 갱신하고 골든 기대치를 재검증하세요):\n  ${diffs.join("\n  ")}`);
  process.exit(1);
}
console.log(`snapshot manifest 검증 PASS — v${saved.version} (generated ${saved.generated}) · US ${saved.coverage.us.first}-${saved.coverage.us.last} · KR ${saved.coverage.kr.first}-${saved.coverage.kr.last}`);
