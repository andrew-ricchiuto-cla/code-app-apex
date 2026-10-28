import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { StartScreen } from "@/components/start-screen";
import { FacilitatorConsole } from "@/facilitator/console";
import { GameProvider } from "@/lib/store";
import { loadSession, saveSession, type Session } from "@/lib/session";
import { PlayerApp } from "@/player/player-app";

function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const start = (next: Session) => {
    saveSession(next);
    setSession(next);
  };
  const leave = () => {
    saveSession(null);
    setSession(null);
  };

  const key = session ? `${session.mode === "shared" ? session.gameId : "local"}|${session.role}|${session.teamKey ?? ""}` : "none";

  return (
    <>
      {session === null ? (
        <StartScreen onStart={start} />
      ) : (
        <GameProvider key={key} session={session} onLeave={leave}>
          {session.role === "facilitator" ? <FacilitatorConsole /> : <PlayerApp />}
        </GameProvider>
      )}
      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
