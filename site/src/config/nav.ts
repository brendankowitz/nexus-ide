export interface NavItem { title: string; href: string; }
export interface NavGroup { group: string; items: NavItem[]; }

export const NAV: NavGroup[] = [
  { group: 'Getting Started', items: [
    { title: 'Introduction', href: '/nexus-ide/docs/getting-started/introduction' },
    { title: 'Installation', href: '/nexus-ide/docs/getting-started/installation' },
    { title: 'Your first run', href: '/nexus-ide/docs/getting-started/first-project' },
  ]},
  { group: 'Core Concepts', items: [
    { title: 'The mission-control model', href: '/nexus-ide/docs/concepts/mission-control' },
    { title: 'Projects & groups', href: '/nexus-ide/docs/concepts/projects' },
    { title: 'Worktrees & branches', href: '/nexus-ide/docs/concepts/worktrees' },
    { title: 'Runs & sessions', href: '/nexus-ide/docs/concepts/sessions' },
  ]},
  { group: 'Workbench', items: [
    { title: 'Starting a run', href: '/nexus-ide/docs/workbench/start-a-run' },
    { title: 'The Project Rail', href: '/nexus-ide/docs/workbench/project-rail' },
    { title: 'Sessions & agents', href: '/nexus-ide/docs/workbench/terminals' },
    { title: 'Run status & telemetry', href: '/nexus-ide/docs/workbench/telemetry' },
    { title: 'Branches & worktrees', href: '/nexus-ide/docs/workbench/branches' },
  ]},
  { group: 'Review', items: [
    { title: 'Reviewing changes', href: '/nexus-ide/docs/review/diff-viewer' },
    { title: 'Hunks & diffs', href: '/nexus-ide/docs/review/hunks' },
    { title: 'The review queue', href: '/nexus-ide/docs/review/staging' },
    { title: 'History', href: '/nexus-ide/docs/review/commit-log' },
  ]},
  { group: 'Reference', items: [
    { title: 'Providers', href: '/nexus-ide/docs/reference/providers' },
    { title: 'Keyboard shortcuts', href: '/nexus-ide/docs/reference/shortcuts' },
    { title: 'Configuration', href: '/nexus-ide/docs/reference/configuration' },
    { title: 'Architecture', href: '/nexus-ide/docs/reference/architecture' },
  ]},
];

export const FLAT = NAV.flatMap(g => g.items);
