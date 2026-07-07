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
  currentRoundId: 'round-001',
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
  status: 'Open',
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
