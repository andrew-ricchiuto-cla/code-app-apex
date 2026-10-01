// System Health trend — one line per team, fixed team colors, hover tooltip,
// legend always present (>1 series).

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { RoundResult } from "@/engine";
import { teamColor } from "@/lib/format";
import type { TeamState } from "@/lib/store";

interface Props {
  teams: TeamState[];
  resultsByTeam: Map<string, RoundResult[]>;
  throughRound: number;
}

export function HealthChart({ teams, resultsByTeam, throughRound }: Props) {
  const data = Array.from({ length: throughRound }, (_, i) => {
    const row: Record<string, number | string> = { round: `Round ${i + 1}` };
    for (const team of teams) {
      const results = resultsByTeam.get(team.id) ?? [];
      if (results[i]) row[team.id] = Number(results[i].systemHealth.toFixed(2));
    }
    return row;
  });

  const chartConfig: ChartConfig = Object.fromEntries(
    teams.map((team, i) => [team.id, { label: team.name, color: teamColor(i) }]),
  );

  return (
    <ChartContainer config={chartConfig} className="h-72 w-full">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.4} />
        <XAxis dataKey="round" tickLine={false} axisLine={false} />
        <YAxis domain={[30, 70]} width={32} tickLine={false} axisLine={false} allowDataOverflow />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {teams.map((team, i) => (
          <Line
            key={team.id}
            type="monotone"
            dataKey={team.id}
            stroke={teamColor(i)}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: teamColor(i) }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
