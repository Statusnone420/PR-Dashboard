import { isClosedIssue } from './boardModel.js';

const BEGINNER_LABELS = ['good first issue', 'help wanted', 'beginner', 'starter'];
const STALE_LABELS = ['stale', 'blocked', 'duplicate', 'wontfix', "won't fix", 'invalid'];
const SMALL_SCOPE_TERMS = ['docs', 'readme', 'typo', 'config', 'cleanup', 'spelling', 'copy', 'documentation'];
const CLEAR_BEHAVIOR_TERMS = ['expected', 'actual', 'should', 'steps to reproduce', 'acceptance criteria', 'repro'];
const COMPLEX_SCOPE_TERMS = ['rewrite', 'entire', 'architecture', 'large refactor', 'across everything', 'migration', 'redesign'];
const META_GROWTH_TERMS = [
  'grow to 1000 stars',
  'add good first issues',
  'starter issues board',
  'contributors wanted',
  'roadmap',
  'community onboarding',
  'project is bigger than me',
  'growth'
];

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function labelNames(issue) {
  return (issue?.labels || [])
    .map(label => String(typeof label === 'object' ? label.name : label || '').toLowerCase())
    .filter(Boolean);
}

function textBlob(issue) {
  return `${issue?.title || ''}\n${issue?.body || ''}`.toLowerCase();
}

function daysSince(value, now) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return (now - date.getTime()) / (24 * 60 * 60 * 1000);
}

function hasAny(value, terms) {
  return terms.some(term => value.includes(term));
}

function hasTaskList(issueText) {
  return /(^|\n)\s*(- \[[ x]\]|\d+\.|- )\s+\S/i.test(issueText);
}

export function getMatchScoreRating(score) {
  if (score >= 85) return 'Strong candidate';
  if (score >= 70) return 'Good candidate';
  if (score >= 50) return 'Maybe / inspect first';
  return 'Risky / likely pass';
}

export function calculateMatchScore(issue, options = {}) {
  const now = options.now ?? Date.now();
  const labels = labelNames(issue);
  const issueText = textBlob(issue);
  const rows = [];
  const passReasons = new Set();

  const add = (points, label, passReason = null) => {
    rows.push({ points, label });
    if (passReason) passReasons.add(passReason);
  };

  const isAssigned = Boolean(issue?.assignee || (Array.isArray(issue?.assignees) && issue.assignees.length > 0));
  const hasBeginnerLabel = labels.some(label => BEGINNER_LABELS.some(beginner => label.includes(beginner)));
  const hasStaleLabel = labels.some(label => STALE_LABELS.some(stale => label.includes(stale)));

  if (isClosedIssue(issue)) {
    add(-100, 'Closed issue', 'Closed issue');
    return {
      score: 0,
      rating: getMatchScoreRating(0),
      rows,
      passReasons: [...passReasons],
      flags: { isAssigned, hasBeginnerLabel, hasStaleLabel },
      isContributionCandidate: false
    };
  }

  add(40, 'Baseline open issue');

  if (hasBeginnerLabel) {
    add(14, 'Beginner-friendly label');
  }

  if (hasAny(issueText, SMALL_SCOPE_TERMS)) {
    add(8, 'Small docs/config cleanup scope');
  }

  if (hasAny(issueText, CLEAR_BEHAVIOR_TERMS)) {
    add(8, 'Clear expected behavior');
  }

  if (hasTaskList(`${issue?.body || ''}`)) {
    add(6, 'Clear task list');
  }

  const commentCount = Number(issue?.comments || 0);
  if (commentCount <= 5) {
    add(10, 'Low comment count');
  } else if (commentCount > 15) {
    add(-16, 'Too many comments', 'Too many comments');
  }

  if (isAssigned) {
    add(-18, 'Already assigned', 'Assigned');
  } else {
    add(8, 'Unassigned');
  }

  const updatedDays = daysSince(issue?.updated_at, now);
  if (updatedDays <= 30) {
    add(7, 'Updated recently');
  } else if (updatedDays > 365) {
    add(-12, 'Issue is old', 'Too old');
  } else if (updatedDays > 180) {
    add(-6, 'Issue is getting stale', 'Too old');
  }

  const repo = issue?.repository || {};
  if (repo.archived || repo.disabled) {
    add(-35, 'Repository archived or disabled', 'Repo setup risk');
  } else if (repo.metadataUnavailable || issue?.repository_metadata_unavailable) {
    add(-8, 'Repository metadata unavailable', 'Repo setup risk');
  } else {
    const pushedDays = daysSince(repo.pushed_at, now);
    if (pushedDays <= 90) {
      add(6, 'Repository pushed recently');
    } else if (pushedDays > 365) {
      add(-14, 'Repository appears stale', 'Repo setup risk');
    }

    if (Number(repo.stargazers_count || 0) >= 50 && Number(repo.open_issues_count || 0) >= 0) {
      add(8, 'Healthy hydrated repo metadata');
    }
  }

  if (hasStaleLabel) {
    add(-18, 'Stale/blocked/duplicate/wontfix label', labels.includes('duplicate') ? 'Too vague' : 'Too old');
  }

  const bodyText = String(issue?.body || '').trim();
  if (bodyText.length < 80 || /details are unclear|unclear|not sure|somehow/i.test(bodyText)) {
    add(-20, 'Vague issue body', 'Too vague');
  }

  if (hasAny(issueText, COMPLEX_SCOPE_TERMS)) {
    add(-22, 'Large or ambiguous scope', 'Too complex');
  }

  if (hasAny(issueText, META_GROWTH_TERMS) || labels.some(label => /marketing|community|growth/.test(label))) {
    add(-30, 'Meta/growth issue', 'Meta/growth issue');
  }

  const score = clampScore(rows.reduce((total, row) => total + row.points, 0));

  return {
    score,
    rating: getMatchScoreRating(score),
    rows,
    passReasons: [...passReasons],
    flags: { isAssigned, hasBeginnerLabel, hasStaleLabel },
    isContributionCandidate: score >= 50
  };
}

export function isContributionCandidate(issue, options = {}) {
  return calculateMatchScore(issue, options).isContributionCandidate;
}
