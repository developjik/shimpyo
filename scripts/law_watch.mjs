#!/usr/bin/env node
/**
 * law_watch.mjs — 국가법령정보센터 Open API 일일 해시 diff 감시 (2026-08-18, 토론 D8)
 *
 * 설계 원칙 (지속가능성 회의론자 승인 조건):
 *  - LAW_API_KEY 미등록 → 즉시 종료(exit 0, "침묵이 안전" — 잘못된 "변경 없음"을 만들지 않음)
 *  - API 실패 → 연속 실패 카운트만 증가, 해시를 건드리지 않음. 14회(2주) 연속 실패 → 자동 비활성화(exit 0)
 *  - 해시 변경 감지 → GitHub 이슈 자동 생성 (반영은 사람이: 판정 → rules.json 수정 → 골든 회귀)
 *
 * 상태 저장: data/law_watch/state.json (이 스크립트는 파일만 쓰고 커밋하지 않음 —
 *           CI에서 변경 감지 시 워크플로가 커밋하거나 이슈로만 알림)
 *
 * 사용 (GitHub Actions): env LAW_API_KEY, GH_TOKEN, GITHUB_REPOSITORY 필요
 *   node scripts/law_watch.mjs            → 감시 실행
 *   node scripts/law_watch.mjs --init     → 현재 해시로 초기화(변경 알림 없음)
 *
 * 감시 대상 (1차 — 개정 이력 많은 순):
 *   국민건강보험법, 국민건강보험법 시행령, 소득세법, 조세특례제한법, 국민연금법
 *
 * 참고: 국가법령정보센터 OCPC Open API — https://www.law.go.kr/openApi/main.page
 *   엔드포인트 파라미터는 가입 후 제공되는 가이드에 맞춰 조정 필요할 수 있음.
 *   실패 시 이 스크립트는 거짓 "변경 없음"을 내지 않는다(안전 실패).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_DIR = join(ROOT, "data/law_watch");
const STATE_FILE = join(STATE_DIR, "state.json");

const TARGETS = [
  { key: "hi_law", name: "국민건강보험법" },
  { key: "hi_decree", name: "국민건강보험법 시행령" },
  { key: "itl_law", name: "소득세법" },
  { key: "setax_law", name: "조세특례제한법" },
  { key: "np_law", name: "국민연금법" },
];

const KEY = process.env.LAW_API_KEY;
const GH_TOKEN = process.env.GH_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const INIT = process.argv.includes("--init");

if (!KEY) {
  console.log("LAW_API_KEY 미등록 — 법령 감시 생략 (등록 시 자동 활성화). 국가법령정보센터 Open API 가입: https://www.law.go.kr/openApi/main.page");
  process.exit(0);
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { consecutiveFailures: 0, lastCheck: null, hashes: {} };
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return { consecutiveFailures: 0, lastCheck: null, hashes: {} }; }
}

async function fetchLaw(name) {
  const url = `https://www.law.go.kr/DRF/lawService.do?OC=${encodeURIComponent(KEY)}&target=law&LM=${encodeURIComponent(name)}&TYPE=HTML`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  if (body.length < 200) throw new Error(`응답 과단 (body ${body.length}자 — OCPC 오류 또는 파라미터 확인 필요)`);
  return createHash("sha256").update(body).digest("hex");
}

async function createIssue(title, body) {
  if (!GH_TOKEN || !REPO) { console.log(`[이슈 생성 생략] ${title}`); return; }
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "law-watch" },
    body: JSON.stringify({ title, body, labels: ["law-watch"] }),
  });
  if (!res.ok) console.log(`이슈 생성 실패: HTTP ${res.status}`);
  else console.log(`이슈 생성됨: ${title}`);
}

const state = loadState();

if (state.consecutiveFailures >= 14) {
  console.log(`법령 감시 자동 비활성화 상태 (연속 실패 ${state.consecutiveFailures}회). 재활성화: data/law_watch/state.json 의 consecutiveFailures 를 0으로.`);
  process.exit(0);
}

const changes = [];
let failures = 0;

for (const t of TARGETS) {
  try {
    const h = await fetchLaw(t.name);
    const prev = state.hashes[t.key];
    if (prev && prev !== h && !INIT) changes.push({ name: t.name, key: t.key });
    state.hashes[t.key] = h;
    console.log(`OK  ${t.name} → ${h.slice(0, 10)}${prev && prev !== h ? "  [변경 감지]" : ""}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${t.name}: ${e.message} — 해시 미갱신(거짓 "변경 없음" 방지)`);
  }
}

state.consecutiveFailures = failures > 0 ? (state.consecutiveFailures || 0) + 1 : 0;
state.lastCheck = new Date().toISOString();

mkdirSync(STATE_DIR, { recursive: true });
writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");

if (state.consecutiveFailures >= 14) {
  console.log("연속 실패 14회 도달 — 다음 실행부터 자동 비활성화.");
}

if (changes.length) {
  await createIssue(
    `[law-watch] 법령 변경 감지: ${changes.map((c) => c.name).join(", ")}`,
    `감시 대상 법령의 콘텐츠 해시가 변경되었습니다.\n\n${changes.map((c) => `- ${c.name}`).join("\n")}\n\n확인 절차 (반영 SLA: 원문 확인 후 2주):\n1. 국가법령정보센터에서 원문 확인 (https://www.law.go.kr)\n2. rules 상수 영향 판정 (시행일 기준)\n3. rules.json 수정 + 골든 기대치 갱신 → npm run golden PASS 확인\n4. 통과 시 머지(배포는 골든 게이트가 지킴)\n\n감지: ${new Date().toISOString()} · 워크플로: law-watch.yml`,
  );
} else if (failures === 0) {
  console.log("변경 없음 (전 대상 해시 일치).");
}
process.exit(0);
