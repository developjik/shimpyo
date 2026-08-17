import { useEffect, useState } from "react";
import { ActionButton } from "seed-design/ui/action-button";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "seed-design/ui/tabs";
import { SnackbarProvider } from "seed-design/ui/snackbar";
import { RULES } from "./lib/engine";
import { useSimState, themeCycle } from "./store";
import SimView from "./views/Sim";
import BTView from "./views/BT";
import BandView from "./views/Band";
import RulesView from "./views/Rules";
import GoldenView from "./views/Golden";
import AboutView from "./views/About";

const TABS = [
  { v: "sim", label: "시뮬레이터" },
  { v: "bt", label: "백테스트" },
  { v: "band", label: "또래 밴드" },
  { v: "rules", label: "근거·출처" },
  { v: "golden", label: "검증" },
  { v: "about", label: "방법론" },
] as const;

function currentTab(): string {
  const h = (typeof location !== "undefined" ? location.hash : "#sim").split("?")[0].slice(1);
  return TABS.some((t) => t.v === h) ? h : "sim";
}

export default function App() {
  const [tab, setTab] = useState(currentTab);
  const [theme, setTheme] = useState("system");
  const { state, set, reset } = useSimState();

  useEffect(() => {
    const onHash = () => setTab(currentTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const staleness = (() => {
    const days = Math.floor((Date.now() - new Date(RULES.verified).getTime()) / 86400000);
    return { days, stale: days > 180 };
  })();

  return (
    <SnackbarProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="logo" onClick={() => (location.hash = "#sim")}>
            쉼표<span className="cursor">_</span>
          </div>
          <div className="tagline">몇억이면 쉴 수 있는가, 근거는 전부 공개합니다</div>
          <span className={`rules-chip${staleness.stale ? " stale" : ""}`}>
            rules {RULES.version} · 상수 검증 {RULES.verified}
            {staleness.stale ? ` — ${staleness.days}일 경과, 재검증 필요` : ""}
          </span>
          <ActionButton variant="neutralWeak" size="small" onClick={() => setTheme(themeCycle())}>
            테마: {theme === "system" ? "시스템" : theme === "light" ? "라이트" : "다크"}
          </ActionButton>
        </header>

        <TabsRoot
          value={tab}
          onValueChange={(v) => {
            location.hash = "#" + v;
            setTab(v as string);
          }}
        >
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.v} value={t.v}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="sim" className="view-body"><SimView state={state} set={set} reset={reset} /></TabsContent>
          <TabsContent value="bt" className="view-body"><BTView /></TabsContent>
          <TabsContent value="band" className="view-body"><BandView state={state} /></TabsContent>
          <TabsContent value="rules" className="view-body"><RulesView /></TabsContent>
          <TabsContent value="golden" className="view-body"><GoldenView /></TabsContent>
          <TabsContent value="about" className="view-body"><AboutView /></TabsContent>
        </TabsRoot>

        <footer className="statusbar">
          <span className="ok">●</span>
          <span>rules {RULES.version} · {RULES.verified}</span>
          <span>미국 98년 · 한국 46년 시계열 임베드</span>
          <span>입력값은 브라우저에만 저장 · 서버 전송 0건</span>
        </footer>
      </div>
    </SnackbarProvider>
  );
}
