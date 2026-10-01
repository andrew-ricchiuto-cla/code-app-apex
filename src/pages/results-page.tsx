import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HealthChart } from "@/components/health-chart";
import { fmt1, money, pct, teamColor } from "@/lib/format";
import { useAllResults, useGame } from "@/lib/store";

export function ResultsPage() {
  const { state } = useGame();
  const resultsByTeam = useAllResults();
  const [detailTeamId, setDetailTeamId] = useState(state.teams[0]?.id ?? "");

  const leaderboard = state.teams
    .map((team, index) => {
      const results = resultsByTeam.get(team.id) ?? [];
      const lastSubmitted = team.submitted.lastIndexOf(true);
      const at = lastSubmitted >= 0 ? lastSubmitted : state.currentRound - 1;
      return { team, index, result: results[at], round: at + 1 };
    })
    .sort((a, b) => (b.result?.systemHealth ?? 0) - (a.result?.systemHealth ?? 0));

  const detailTeam = state.teams.find((t) => t.id === detailTeamId) ?? state.teams[0];
  const detailResults = (resultsByTeam.get(detailTeam?.id ?? "") ?? []).slice(0, state.currentRound);

  const metrics: { label: string; value: (r: (typeof detailResults)[number]) => string }[] = [
    { label: "System Health", value: (r) => fmt1(r.systemHealth) },
    { label: "Revenue", value: (r) => money(r.revenue) },
    { label: "Growth", value: (r) => pct(r.growth, 2) },
    { label: "Margin", value: (r) => pct(r.margin, 2) },
    { label: "Advisory + AI mix", value: (r) => pct(r.mix, 1) },
    { label: "Market", value: (r) => fmt1(r.out.m) },
    { label: "Value", value: (r) => fmt1(r.out.v) },
    { label: "Capability (K)", value: (r) => fmt1(r.out.k) },
    { label: "Fluidity (F)", value: (r) => fmt1(r.out.f) },
    { label: "Capability loop", value: (r) => fmt1(r.capabilityLoop) },
    { label: "Control", value: (r) => fmt1(r.out.c) },
    { label: "Cash score", value: (r) => fmt1(r.cashScore) },
    { label: "Employee confidence", value: (r) => fmt1(r.out.ec) },
    { label: "Owner confidence", value: (r) => fmt1(r.out.oc) },
    { label: "Pipeline", value: (r) => r.pipeline },
    { label: "Win rate", value: (r) => pct(r.winRate, 2) },
    { label: "Price realization", value: (r) => pct(r.priceRealization, 1) },
    { label: "Next capital", value: (r) => fmt1(r.nextCapital) },
    { label: "LC reserve", value: (r) => String(r.lcReserve) },
    { label: "Response reserve", value: (r) => String(r.responseReserve) },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>Ranked by System Health at each team's latest submitted round.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">System Health</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Growth</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead>Through</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map(({ team, index, result, round }, rank) => (
                <TableRow key={team.id} className={rank === 0 ? "bg-amber-50/60" : ""}>
                  <TableCell>
                    <span
                      className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-black ${
                        rank === 0
                          ? "bg-amber-400 text-amber-950"
                          : rank === 1
                            ? "bg-slate-300 text-slate-800"
                            : rank === 2
                              ? "bg-orange-300 text-orange-950"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {rank + 1}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: teamColor(index) }} />
                    {team.name}
                  </TableCell>
                  <TableCell className="text-primary text-right font-mono text-base font-black">
                    {result ? fmt1(result.systemHealth) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{result ? money(result.revenue) : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{result ? pct(result.growth, 2) : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{result ? pct(result.margin, 2) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Round {round}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Health by round</CardTitle>
        </CardHeader>
        <CardContent>
          <HealthChart teams={state.teams} resultsByTeam={resultsByTeam} throughRound={state.currentRound} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            Team detail
            <Select value={detailTeam?.id} onValueChange={setDetailTeamId}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardTitle>
          <CardDescription>All engine outputs per round — mirrors the workbook's round outputs.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                {detailResults.map((r) => (
                  <TableHead key={r.round} className="text-right">
                    Round {r.round}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map(({ label, value }) => (
                <TableRow key={label}>
                  <TableCell className="font-medium">{label}</TableCell>
                  {detailResults.map((r) => (
                    <TableCell key={r.round} className="text-right font-mono">
                      {value(r)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Decisions</TableCell>
                {detailResults.map((r, i) => {
                  const d = detailTeam?.decisions[i];
                  const names =
                    d?.initiatives
                      .filter((x) => x.name !== "None" && x.name !== "")
                      .map((x) => `${x.name} (${x.intensity})`) ?? [];
                  if (d?.strategicOption && d.strategicOption !== "None") names.push(d.strategicOption);
                  if (d?.customAction?.name) names.push(`Custom: ${d.customAction.name}`);
                  return (
                    <TableCell key={r.round} className="text-right text-xs">
                      {names.length ? names.join("; ") : "No initiatives"}
                      <div className="text-muted-foreground">
                        {d?.distribution} · {d?.workforceReduction ? "Workforce action" : "No workforce action"}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
