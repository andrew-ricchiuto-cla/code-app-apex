import type {
  Allocation,
  Category,
  CurrentUser,
  Round,
  Simulation,
  Team,
  TeamMember,
  TeamRoundResult,
} from '@/types'

export const mockSimulation: Simulation = {
  id: 'sim-001',
  name: 'Apex Simulation 2026',
  createdBy: 'user-facilitator',
  status: 'Active',
  currentRoundId: 'round-003',
}

export const mockRound: Round = {
  id: 'round-001',
  simulationId: 'sim-001',
  index: 1,
  eventTitle: 'High Attrition Crisis',
  eventDescription:
    'The firm is experiencing a 25% annual attrition rate driven by burnout ' +
    'and competitive offers. Allocate your budget to stabilize the workforce ' +
    'and protect delivery capacity.',
  budget: 100,
  weightsConfigId: 'default-weights-v1',
  status: 'Revealed',
}

export const mockCategories: Category[] = [
  {
    id: 'cat-ai',
    roundId: 'round-001',
    name: 'AI Investment',
    description: 'Automation and AI tooling',
  },
  {
    id: 'cat-reskill',
    roundId: 'round-001',
    name: 'Reskilling',
    description: 'Workforce development programs',
  },
  {
    id: 'cat-industries',
    roundId: 'round-001',
    name: 'Industries',
    description: 'Industry vertical focus',
  },
  {
    id: 'cat-marketing',
    roundId: 'round-001',
    name: 'Marketing',
    description: 'Brand and demand generation',
  },
  {
    id: 'cat-ops',
    roundId: 'round-001',
    name: 'Operations',
    description: 'Operational efficiency',
  },
]

export const mockTeams: Team[] = [
  {
    id: 'team-alpha',
    simulationId: 'sim-001',
    name: 'Team Alpha',
    systemHealthBaseline: 50,
  },
  {
    id: 'team-beta',
    simulationId: 'sim-001',
    name: 'Team Beta',
    systemHealthBaseline: 50,
  },
  {
    id: 'team-gamma',
    simulationId: 'sim-001',
    name: 'Team Gamma',
    systemHealthBaseline: 50,
  },
]

export const mockTeamMembers: TeamMember[] = [
  {
    id: 'tm-001',
    teamId: 'team-alpha',
    systemUserId: 'user-captain-a',
    displayName: 'Alice Chen',
    isCaptain: true,
  },
  {
    id: 'tm-002',
    teamId: 'team-alpha',
    systemUserId: 'user-member-a1',
    displayName: 'Bob Smith',
    isCaptain: false,
  },
  {
    id: 'tm-003',
    teamId: 'team-beta',
    systemUserId: 'user-captain-b',
    displayName: 'Carlos Rivera',
    isCaptain: true,
  },
  {
    id: 'tm-004',
    teamId: 'team-beta',
    systemUserId: 'user-member-b1',
    displayName: 'Diana Park',
    isCaptain: false,
  },
  {
    id: 'tm-005',
    teamId: 'team-gamma',
    systemUserId: 'user-captain-c',
    displayName: 'Ethan Brooks',
    isCaptain: true,
  },
]

export const mockAllocations: Allocation[] = [
  {
    id: 'alloc-a-1',
    roundId: 'round-001',
    teamId: 'team-alpha',
    categoryId: 'cat-ai',
    amount: 20,
    submittedAt: null,
  },
  {
    id: 'alloc-a-2',
    roundId: 'round-001',
    teamId: 'team-alpha',
    categoryId: 'cat-reskill',
    amount: 40,
    submittedAt: null,
  },
  {
    id: 'alloc-a-3',
    roundId: 'round-001',
    teamId: 'team-alpha',
    categoryId: 'cat-industries',
    amount: 20,
    submittedAt: null,
  },
  {
    id: 'alloc-a-4',
    roundId: 'round-001',
    teamId: 'team-alpha',
    categoryId: 'cat-marketing',
    amount: 10,
    submittedAt: null,
  },
  {
    id: 'alloc-a-5',
    roundId: 'round-001',
    teamId: 'team-alpha',
    categoryId: 'cat-ops',
    amount: 10,
    submittedAt: null,
  },
]

export const mockTeamRoundResults: TeamRoundResult[] = [
  {
    id: 'result-001',
    roundId: 'round-001',
    teamId: 'team-alpha',
    previousHealth: 50,
    newHealth: 62,
    delta: 12,
    contributions: [
      { categoryId: 'cat-reskill', name: 'Reskilling', amount: 40, weightedImpact: 8 },
      { categoryId: 'cat-ai', name: 'AI Investment', amount: 20, weightedImpact: 4 },
      { categoryId: 'cat-industries', name: 'Industries', amount: 20, weightedImpact: 2 },
      { categoryId: 'cat-marketing', name: 'Marketing', amount: 10, weightedImpact: -1 },
      { categoryId: 'cat-ops', name: 'Operations', amount: 10, weightedImpact: -1 },
    ],
    rationale:
      'Heavy investment in Reskilling directly countered attrition, driving System Health ' +
      'from 50 → 62. AI Investment provided further efficiency gains.',
  },
  {
    id: 'result-002',
    roundId: 'round-001',
    teamId: 'team-beta',
    previousHealth: 50,
    newHealth: 55,
    delta: 5,
    contributions: [
      { categoryId: 'cat-ai', name: 'AI Investment', amount: 50, weightedImpact: 10 },
      { categoryId: 'cat-reskill', name: 'Reskilling', amount: 10, weightedImpact: 2 },
      { categoryId: 'cat-industries', name: 'Industries', amount: 10, weightedImpact: 0 },
      { categoryId: 'cat-marketing', name: 'Marketing', amount: 20, weightedImpact: -5 },
      { categoryId: 'cat-ops', name: 'Operations', amount: 10, weightedImpact: -2 },
    ],
    rationale:
      'AI Investment boosted efficiency, but over-spend on Marketing during an attrition ' +
      'event reduced overall effectiveness. System Health moved from 50 → 55.',
  },
  {
    id: 'result-003',
    roundId: 'round-001',
    teamId: 'team-gamma',
    previousHealth: 50,
    newHealth: 58,
    delta: 8,
    contributions: [
      { categoryId: 'cat-reskill', name: 'Reskilling', amount: 30, weightedImpact: 6 },
      { categoryId: 'cat-ai', name: 'AI Investment', amount: 30, weightedImpact: 6 },
      { categoryId: 'cat-industries', name: 'Industries', amount: 20, weightedImpact: 2 },
      { categoryId: 'cat-marketing', name: 'Marketing', amount: 10, weightedImpact: -3 },
      { categoryId: 'cat-ops', name: 'Operations', amount: 10, weightedImpact: -3 },
    ],
    rationale:
      'Balanced investment in Reskilling and AI Investment delivered steady gains. ' +
      'System Health moved from 50 → 58.',
  },
]

export const mockFacilitatorUser: CurrentUser = {
  systemUserId: 'user-facilitator',
  displayName: 'Yassir Benchouk',
  role: 'Facilitator',
  teamId: null,
  isCaptain: false,
}

export const mockCaptainUser: CurrentUser = {
  systemUserId: 'user-captain-a',
  displayName: 'Alice Chen',
  role: 'Captain',
  teamId: 'team-alpha',
  isCaptain: true,
}

export const mockMemberUser: CurrentUser = {
  systemUserId: 'user-member-a1',
  displayName: 'Bob Smith',
  role: 'Member',
  teamId: 'team-alpha',
  isCaptain: false,
}

export const mockObserverUser: CurrentUser = {
  systemUserId: 'user-observer',
  displayName: 'Observer Guest',
  role: 'Observer',
  teamId: null,
  isCaptain: false,
}

// ─── Round 2 ──────────────────────────────────────────────────────────────────

export const mockRound2: Round = {
  id: 'round-002',
  simulationId: 'sim-001',
  index: 2,
  eventTitle: 'Digital Talent Arms Race',
  eventDescription:
    'A fierce competition for AI-fluent talent has erupted across the industry. ' +
    'Competitors are offering aggressive packages and remote-first perks. ' +
    'Decide where to double down to attract and retain the skills your firm needs.',
  budget: 100,
  weightsConfigId: 'default-weights-v1',
  status: 'Revealed',
}

export const mockCategoriesRound2: Category[] = [
  { id: 'cat-ai-r2', roundId: 'round-002', name: 'AI Investment', description: 'Automation and AI tooling' },
  { id: 'cat-reskill-r2', roundId: 'round-002', name: 'Reskilling', description: 'Workforce development programs' },
  { id: 'cat-talent-r2', roundId: 'round-002', name: 'Talent Acquisition', description: 'Recruiting and sourcing' },
  { id: 'cat-innovation-r2', roundId: 'round-002', name: 'Innovation Labs', description: 'R&D and prototyping' },
  { id: 'cat-ops-r2', roundId: 'round-002', name: 'Operations', description: 'Operational efficiency' },
]

export const mockTeamRoundResultsRound2: TeamRoundResult[] = [
  {
    id: 'result-r2-001',
    roundId: 'round-002',
    teamId: 'team-alpha',
    previousHealth: 62,
    newHealth: 58,
    delta: -4,
    contributions: [
      { categoryId: 'cat-ai-r2', name: 'AI Investment', amount: 40, weightedImpact: -2 },
      { categoryId: 'cat-reskill-r2', name: 'Reskilling', amount: 15, weightedImpact: 1 },
      { categoryId: 'cat-talent-r2', name: 'Talent Acquisition', amount: 30, weightedImpact: -1 },
      { categoryId: 'cat-innovation-r2', name: 'Innovation Labs', amount: 5, weightedImpact: -1 },
      { categoryId: 'cat-ops-r2', name: 'Operations', amount: 10, weightedImpact: -1 },
    ],
    rationale:
      'Heavy allocation to AI tooling backfired during a talent-first event. ' +
      'Without adequate reskilling, productivity gains failed to materialize. System Health slipped from 62 → 58.',
  },
  {
    id: 'result-r2-002',
    roundId: 'round-002',
    teamId: 'team-beta',
    previousHealth: 55,
    newHealth: 67,
    delta: 12,
    contributions: [
      { categoryId: 'cat-talent-r2', name: 'Talent Acquisition', amount: 45, weightedImpact: 9 },
      { categoryId: 'cat-reskill-r2', name: 'Reskilling', amount: 20, weightedImpact: 2 },
      { categoryId: 'cat-innovation-r2', name: 'Innovation Labs', amount: 15, weightedImpact: 1 },
      { categoryId: 'cat-ops-r2', name: 'Operations', amount: 10, weightedImpact: 1 },
      { categoryId: 'cat-ai-r2', name: 'AI Investment', amount: 10, weightedImpact: -1 },
    ],
    rationale:
      'Aggressive talent acquisition during the arms race paid off decisively. ' +
      'A surge of skilled hires drove System Health from 55 → 67.',
  },
  {
    id: 'result-r2-003',
    roundId: 'round-002',
    teamId: 'team-gamma',
    previousHealth: 58,
    newHealth: 65,
    delta: 7,
    contributions: [
      { categoryId: 'cat-ai-r2', name: 'AI Investment', amount: 25, weightedImpact: 3 },
      { categoryId: 'cat-reskill-r2', name: 'Reskilling', amount: 20, weightedImpact: 2 },
      { categoryId: 'cat-talent-r2', name: 'Talent Acquisition', amount: 20, weightedImpact: 1 },
      { categoryId: 'cat-innovation-r2', name: 'Innovation Labs', amount: 20, weightedImpact: 1 },
      { categoryId: 'cat-ops-r2', name: 'Operations', amount: 15, weightedImpact: 0 },
    ],
    rationale:
      'Balanced investment across talent, AI, and innovation kept Gamma competitive. ' +
      'System Health rose from 58 → 65.',
  },
]

// ─── Round 3 ──────────────────────────────────────────────────────────────────

export const mockRound3: Round = {
  id: 'round-003',
  simulationId: 'sim-001',
  index: 3,
  eventTitle: 'Market Disruption Response',
  eventDescription:
    'A wave of tech-native competitors is undercutting on price and speed. ' +
    'Your firm must act decisively to differentiate, protect core clients, ' +
    'and position for the next cycle of growth.',
  budget: 100,
  weightsConfigId: 'default-weights-v1',
  status: 'Revealed',
}

export const mockCategoriesRound3: Category[] = [
  { id: 'cat-ai-r3', roundId: 'round-003', name: 'AI Investment', description: 'Automation and AI tooling' },
  { id: 'cat-reskill-r3', roundId: 'round-003', name: 'Reskilling', description: 'Workforce development programs' },
  { id: 'cat-compliance-r3', roundId: 'round-003', name: 'Compliance Programs', description: 'Regulatory adaptation' },
  { id: 'cat-change-r3', roundId: 'round-003', name: 'Change Management', description: 'Transformation leadership' },
  { id: 'cat-ops-r3', roundId: 'round-003', name: 'Operations', description: 'Operational efficiency' },
]

export const mockAllocationsRound3: Allocation[] = [
  { id: 'alloc-a3-1', roundId: 'round-003', teamId: 'team-alpha', categoryId: 'cat-ai-r3', amount: 35, submittedAt: null },
  { id: 'alloc-a3-2', roundId: 'round-003', teamId: 'team-alpha', categoryId: 'cat-reskill-r3', amount: 25, submittedAt: null },
  { id: 'alloc-a3-3', roundId: 'round-003', teamId: 'team-alpha', categoryId: 'cat-compliance-r3', amount: 15, submittedAt: null },
  { id: 'alloc-a3-4', roundId: 'round-003', teamId: 'team-alpha', categoryId: 'cat-change-r3', amount: 15, submittedAt: null },
  { id: 'alloc-a3-5', roundId: 'round-003', teamId: 'team-alpha', categoryId: 'cat-ops-r3', amount: 10, submittedAt: null },
]

export const mockTeamRoundResultsRound3: TeamRoundResult[] = [
  {
    id: 'result-r3-001',
    roundId: 'round-003',
    teamId: 'team-alpha',
    previousHealth: 58,
    newHealth: 72,
    delta: 14,
    contributions: [
      { categoryId: 'cat-ai-r3', name: 'AI Investment', amount: 35, weightedImpact: 7 },
      { categoryId: 'cat-reskill-r3', name: 'Reskilling', amount: 25, weightedImpact: 5 },
      { categoryId: 'cat-compliance-r3', name: 'Compliance Programs', amount: 15, weightedImpact: 1 },
      { categoryId: 'cat-change-r3', name: 'Change Management', amount: 15, weightedImpact: 1 },
      { categoryId: 'cat-ops-r3', name: 'Operations', amount: 10, weightedImpact: 0 },
    ],
    rationale:
      'Pivoting to AI-led differentiation and targeted reskilling proved decisive. ' +
      'System Health surged from 58 → 72, the round\'s largest single gain.',
  },
  {
    id: 'result-r3-002',
    roundId: 'round-003',
    teamId: 'team-beta',
    previousHealth: 67,
    newHealth: 74,
    delta: 7,
    contributions: [
      { categoryId: 'cat-ai-r3', name: 'AI Investment', amount: 20, weightedImpact: 4 },
      { categoryId: 'cat-reskill-r3', name: 'Reskilling', amount: 20, weightedImpact: 3 },
      { categoryId: 'cat-compliance-r3', name: 'Compliance Programs', amount: 25, weightedImpact: 2 },
      { categoryId: 'cat-change-r3', name: 'Change Management', amount: 20, weightedImpact: 1 },
      { categoryId: 'cat-ops-r3', name: 'Operations', amount: 15, weightedImpact: -3 },
    ],
    rationale:
      'Consistent AI and reskilling investment maintained momentum through disruption. ' +
      'System Health advanced from 67 → 74.',
  },
  {
    id: 'result-r3-003',
    roundId: 'round-003',
    teamId: 'team-gamma',
    previousHealth: 65,
    newHealth: 68,
    delta: 3,
    contributions: [
      { categoryId: 'cat-reskill-r3', name: 'Reskilling', amount: 30, weightedImpact: 4 },
      { categoryId: 'cat-ai-r3', name: 'AI Investment', amount: 20, weightedImpact: 4 },
      { categoryId: 'cat-compliance-r3', name: 'Compliance Programs', amount: 20, weightedImpact: -2 },
      { categoryId: 'cat-change-r3', name: 'Change Management', amount: 15, weightedImpact: -2 },
      { categoryId: 'cat-ops-r3', name: 'Operations', amount: 15, weightedImpact: -1 },
    ],
    rationale:
      'Defensive allocation toward compliance and change management protected margins ' +
      'but limited upside. System Health edged from 65 → 68.',
  },
]

// ─── Aggregates ───────────────────────────────────────────────────────────────

export const mockAllRounds: Round[] = [mockRound, mockRound2, mockRound3]

export const mockAllTeamRoundResults: TeamRoundResult[] = [
  ...mockTeamRoundResults,
  ...mockTeamRoundResultsRound2,
  ...mockTeamRoundResultsRound3,
]
