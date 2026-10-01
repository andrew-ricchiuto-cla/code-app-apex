import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthChart } from "@/components/health-chart";
import { fmt1, teamColor } from "@/lib/format";
import { useAllResults, useGame } from "@/lib/store";

export function DashboardPage() {
  const { state, dispatch } = useGame();
  const resultsByTeam = useAllResults();
  const theme = state.config.roundThemes.find((t) => t.round === state.currentRound);
  const unsubmitted = state.teams.filter((t) => !t.submitted[state.currentRound - 1]);
  const isLastRound = state.currentRound >= state.config.totalRounds;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-r from-indigo-50 via-violet-50/70 to-transparent">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            <span className="bg-primary text-primary-foreground inline-flex size-9 items-center justify-center rounded-full text-base font-black">
              {state.currentRound}
            </span>
            <span className="text-xl">{theme?.theme}</span>
            <Badge variant="outline" className="border-primary/40 text-primary">
              Round {state.currentRound} of {state.config.totalRounds}
            </Badge>
          </CardTitle>
          <CardDescription className="text-sm">{theme?.primaryEvent}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground grow text-sm">
            {unsubmitted.length === 0 ? (
              <span className="text-cash font-medium">All teams have submitted this round.</span>
            ) : (
              <>Waiting on: {unsubmitted.map((t) => t.name).join(", ")}</>
            )}
          </p>
          <Button
            variant="outline"
            disabled={state.currentRound <= 1}
            onClick={() => dispatch({ type: "setCurrentRound", round: state.currentRound - 1 })}
          >
            Back a round
          </Button>
          <Button
            disabled={isLastRound}
            onClick={() => {
              dispatch({ type: "setCurrentRound", round: state.currentRound + 1 });
              toast.success(`Advanced to round ${state.currentRound + 1}`);
            }}
          >
            {unsubmitted.length > 0 ? "Advance anyway" : "Advance round"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.teams.map((team, index) => {
          const results = resultsByTeam.get(team.id) ?? [];
          const latestSubmitted = team.submitted.lastIndexOf(true);
          const current = results[state.currentRound - 1];
          const shown = latestSubmitted >= 0 ? results[latestSubmitted] : null;
          return (
            <Card key={team.id} className="border-l-4" style={{ borderLeftColor: teamColor(index) }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="inline-block size-2.5 rounded-full" style={{ background: teamColor(index) }} />
                  {team.name}
                </CardTitle>
                <CardDescription>
                  {team.submitted.map((s, i) => (
                    <Badge key={i} variant={s ? "default" : "outline"} className="mr-1">
                      R{i + 1}
                    </Badge>
                  ))}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div>
                  <div className="text-muted-foreground text-xs">
                    System Health {shown ? `(round ${latestSubmitted + 1})` : "(none submitted)"}
                  </div>
                  <div className="font-mono text-3xl font-black tracking-tight" style={{ color: teamColor(index) }}>
                    {shown ? fmt1(shown.systemHealth) : "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-xs">Round {state.currentRound} status</div>
                  <Badge
                    className={current?.status === "OK" ? "bg-cash text-white" : ""}
                    variant={current?.status === "OK" ? "default" : "destructive"}
                  >
                    {current?.status ?? "—"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Health by round</CardTitle>
          <CardDescription>Live scores through round {state.currentRound} — recomputed from decisions on every change.</CardDescription>
        </CardHeader>
        <CardContent>
          <HealthChart teams={state.teams} resultsByTeam={resultsByTeam} throughRound={state.currentRound} />
        </CardContent>
      </Card>
    </div>
  );
}
