export const LANDING = {
  ctaPrimary: 'Start free',
  ctaSecondary: 'Sign in',
  joinPrimary: 'Start free',
  hero: {
    heading: 'Let agents write your records without losing control.',
    lede: 'One shared workspace for people and agents, with field-level grants and review before anything lands.',
  },
  trust:
    'Built by Ciel. Same data plane for people and agents: grants, proposals, and history in one console.',
  problem: {
    heading: 'Agents need to write. Your database was not built for that.',
    body: 'Most stacks assume writes come from reviewed application code. Give an agent production access and you risk silent corruption. Keep it read-only and you leave most of the value on the table.',
  },
  place: {
    heading: 'One workspace. Equal principals. Review before it sticks.',
    body: 'KitsuneOS puts authorization and review in the data plane. Humans and agents share grants, history, and the same collections. Agents propose by default; operators approve in Changes beside the tables they already use.',
  },
  how: {
    heading: 'Grant, propose, review',
    steps: [
      {
        title: 'Grant',
        body: 'Scope an agent to the collections and fields it may touch, down to the row when you need it.',
      },
      {
        title: 'Propose',
        body: 'Agent writes arrive as reviewable change sets, not silent updates to production rows.',
      },
      {
        title: 'Review',
        body: 'Approve or reject in Changes before anything sticks. Humans keep control.',
      },
    ],
  },
  forWhom: {
    heading: 'For teams wiring agents to real records',
    body: 'Founders, operators, and developers who need agents on production data without a second system of record.',
  },
  join: {
    heading: 'Start free',
    body: 'Free plan for getting a workspace running. Upgrade to Pro when you need more agents, people, and capacity.',
  },
} as const;

export function visibleLandingStrings(): string[] {
  const out: string[] = [
    LANDING.ctaPrimary,
    LANDING.ctaSecondary,
    LANDING.joinPrimary,
    LANDING.hero.heading,
    LANDING.hero.lede,
    LANDING.trust,
    LANDING.problem.heading,
    LANDING.problem.body,
    LANDING.place.heading,
    LANDING.place.body,
    LANDING.how.heading,
    LANDING.forWhom.heading,
    LANDING.forWhom.body,
    LANDING.join.heading,
    LANDING.join.body,
  ];
  for (const step of LANDING.how.steps) {
    out.push(step.title, step.body);
  }
  return out;
}
