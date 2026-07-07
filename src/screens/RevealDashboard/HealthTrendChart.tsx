import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'

export interface TrendDataPoint {
  roundLabel: string
  [teamName: string]: number | string
}

interface HealthTrendChartProps {
  data: TrendDataPoint[]
  teamNames: string[]
}

const PALETTE = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2']

function getSeriesColor(index: number) {
  if (index < PALETTE.length) return PALETTE[index]

  return `hsl(${(index * 137.508) % 360} 70% 45%)`
}

export function HealthTrendChart({ data, teamNames }: HealthTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="roundLabel" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        {teamNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={getSeriesColor(i)}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
