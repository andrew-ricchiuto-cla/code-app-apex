import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { CategoryContribution } from '@/types'

interface ContributionChartProps {
  contributions: CategoryContribution[]
}

export function ContributionChart({ contributions }: ContributionChartProps) {
  const data = [...contributions]
    .sort((a, b) => b.weightedImpact - a.weightedImpact)
    .map(c => ({
      name: c.name.length > 11 ? `${c.name.slice(0, 10)}…` : c.name,
      impact: parseFloat(c.weightedImpact.toFixed(1)),
    }))

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={value => {
            const numericValue =
              typeof value === 'number'
                ? value
                : typeof value === 'string'
                  ? Number.parseFloat(value)
                  : 0

            return [`${numericValue > 0 ? '+' : ''}${numericValue}`, 'Impact']
          }}
        />
        <ReferenceLine y={0} stroke="#e2e8f0" />
        <Bar dataKey="impact" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.impact >= 0 ? '#16a34a' : '#dc2626'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
