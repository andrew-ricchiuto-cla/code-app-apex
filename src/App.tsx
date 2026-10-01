import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { DashboardPage } from "@/pages/dashboard-page";
import { FacilitatorPage } from "@/pages/facilitator-page";
import { PlayPage } from "@/pages/play-page";
import { ResultsPage } from "@/pages/results-page";
import { GameProvider, useGame } from "@/lib/store";
import { LOOP_META } from "@/lib/loops";

const TAB_TRIGGER_CLASS =
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-4";

function Shell() {
  const { state } = useGame();
  const theme = state.config.roundThemes.find((t) => t.round === state.currentRound);
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-violet-700 px-6 py-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-violet-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-black tracking-tight">
                APEX<span className="text-amber-400">.</span>
              </h1>
              <span className="text-xs font-semibold tracking-[0.25em] text-indigo-200 uppercase">
                The Five Loop Investment Game
              </span>
            </div>
            <p className="mt-1 text-sm text-indigo-100/90">
              Run the enterprise. Balance the loops. One weak loop pulls everything down.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium tracking-wide text-indigo-200 uppercase">{state.gameName}</div>
            <div className="text-lg font-bold text-amber-300">
              Round {state.currentRound} · {theme?.theme}
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          {LOOP_META.map((loop) => (
            <span
              key={loop.key}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15"
            >
              <span className={`size-2 rounded-full ${loop.dotClass}`} />
              {loop.label}
            </span>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400/70 to-transparent" />
      </header>

      <Tabs defaultValue="dashboard">
        <TabsList className="bg-card h-11 gap-1 border p-1 shadow-sm">
          <TabsTrigger value="dashboard" className={TAB_TRIGGER_CLASS}>
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="play" className={TAB_TRIGGER_CLASS}>
            Team play
          </TabsTrigger>
          <TabsTrigger value="results" className={TAB_TRIGGER_CLASS}>
            Results
          </TabsTrigger>
          <TabsTrigger value="facilitator" className={TAB_TRIGGER_CLASS}>
            Facilitator
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <DashboardPage />
        </TabsContent>
        <TabsContent value="play" className="mt-4">
          <PlayPage />
        </TabsContent>
        <TabsContent value="results" className="mt-4">
          <ResultsPage />
        </TabsContent>
        <TabsContent value="facilitator" className="mt-4">
          <FacilitatorPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function App() {
  return (
    <GameProvider>
      <Shell />
      <Toaster position="bottom-right" />
    </GameProvider>
  );
}

export default App;
