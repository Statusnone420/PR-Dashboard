import { isClosedIssue } from './boardModel.js';

const BEGINNER_LABELS = ['good first issue', 'help wanted', 'beginner', 'starter'];
const STRONG_FIT_LABELS = [
  'good first issue',
  'help wanted',
  'documentation',
  'docs',
  'test',
  'tests',
  'starter',
  'beginner',
  'easy',
  'low-hanging-fruit',
  'low hanging fruit'
];
const STALE_LABELS = ['stale', 'blocked', 'duplicate', 'wontfix', "won't fix", 'invalid'];
const SMALL_SCOPE_TERMS = ['docs', 'readme', 'typo', 'config', 'cleanup', 'spelling', 'documentation'];
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
const TASK_SECTION_HEADINGS = [
  'tasks',
  'task list',
  'todo',
  'to do',
  'acceptance criteria',
  'implementation',
  'proposed fix',
  'checklist'
];
const NON_TASK_SECTION_HEADINGS = [
  'steps to reproduce',
  'reproduction',
  'repro steps',
  'how to reproduce',
  'actual behavior',
  'expected behavior',
  'environment',
  'additional information',
  'additional notes'
];
const TEMPLATE_CHECKLIST_TERMS = [
  'searched existing issues',
  'search existing issues',
  'read the contributing guide',
  'read contributing',
  'code of conduct',
  'using the latest version',
  'latest version',
  'agree to follow',
  'i agree',
  'i have read',
  'i searched',
  'i am using'
];
const ACTION_ITEM_TERMS = [
  'add',
  'adjust',
  'change',
  'check',
  'clarify',
  'confirm',
  'create',
  'document',
  'fix',
  'implement',
  'improve',
  'migrate',
  'parse',
  'remove',
  'rename',
  'replace',
  'reproduce',
  'support',
  'test',
  'update',
  'verify',
  'write'
];
const SCOPED_COPY_PATTERNS = [
  /\bcopywriting\b/i,
  /\b(?:ui|error message|message|landing page|onboarding page|docs?|documentation|button label|aria label)\s+copy\b/i,
  /\bcopy\s+(?:for|in)\s+(?:the\s+)?(?:ui|error message|message|landing page|onboarding page|docs?|documentation)\b/i,
  /\b(?:revise|update|improve|change|clarify)\s+(?:the\s+)?(?:ui\s+)?copy\b/i,
  /\b(?:revise|update|improve|change|clarify)\s+(?:the\s+)?(?:error message|label|microcopy|wording)\b/i
];
const BOUNDED_FIX_PATTERNS = [
  /\bfix(?:es|ing)?\s+(?:the\s+)?[\w\s-]{0,80}\b(?:button|label|message|command|parser|validation|readme|docs?|setting|settings|checkbox|input|link|tooltip|test)\b/i,
  /\b(?:update|change|improve|clarify|document|add|remove|rename|replace)\s+(?:the\s+)?[\w\s-]{0,80}\b(?:label|message|copy|docs?|readme|test|command|option|setting|settings|tooltip|validation)\b/i,
  /\bsmall\s+(?:fix|change|cleanup)\b/i,
  /\b(?:typo|spelling|readme|config)\b/i
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

function normalizedHeading(line) {
  return String(line || '')
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/:$/, '')
    .trim()
    .toLowerCase();
}

function listItemText(line) {
  const match = String(line || '').match(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s*)?|\d+[.)]\s+)(.+)$/);
  return match ? match[1].trim() : null;
}

function isMarkdownChecklistItem(line) {
  return /^\s*[-*+]\s+\[[ xX]\]\s+\S/.test(String(line || ''));
}

function isTemplateChecklistItem(text) {
  const normalized = String(text || '').toLowerCase();
  return TEMPLATE_CHECKLIST_TERMS.some(term => normalized.includes(term));
}

function isActionOrientedItem(text) {
  const normalized = String(text || '').toLowerCase();
  if (!normalized || isTemplateChecklistItem(normalized)) return false;
  return ACTION_ITEM_TERMS.some(term => new RegExp(`\\b${term}\\b`, 'i').test(normalized));
}

function hasTaskList(issueText) {
  const lines = String(issueText || '').split(/\r?\n/);
  let inTaskSection = false;

  for (const line of lines) {
    const heading = normalizedHeading(line);
    if (TASK_SECTION_HEADINGS.includes(heading)) {
      inTaskSection = true;
      continue;
    }
    if (NON_TASK_SECTION_HEADINGS.includes(heading)) {
      inTaskSection = false;
      continue;
    }

    const item = listItemText(line);
    if (!item) continue;

    if (isMarkdownChecklistItem(line) && (inTaskSection || isActionOrientedItem(item))) {
      return true;
    }

    if (inTaskSection && isActionOrientedItem(item)) {
      return true;
    }
  }

  return false;
}

function hasScopedCopySignal(issueText) {
  return SCOPED_COPY_PATTERNS.some(pattern => pattern.test(issueText));
}

function hasSmallScopeSignal(issueText) {
  return hasAny(issueText, SMALL_SCOPE_TERMS) || hasScopedCopySignal(issueText);
}

function hasBoundedFixWording(issueText) {
  const compact = String(issueText || '').replace(/\s+/g, ' ');
  return BOUNDED_FIX_PATTERNS.some(pattern => pattern.test(compact));
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
  const hasStrongFitLabel = labels.some(label => STRONG_FIT_LABELS.some(strong => label.includes(strong)));
  const hasStaleLabel = labels.some(label => STALE_LABELS.some(stale => label.includes(stale)));
  const hasBugLabel = labels.some(label => label === 'bug' || label.includes('bug'));
  const hasClearBehavior = hasAny(issueText, CLEAR_BEHAVIOR_TERMS);
  const hasSmallScope = hasSmallScopeSignal(issueText);
  const hasActionableTaskList = hasTaskList(`${issue?.body || ''}`);
  const hasBoundedFix = hasBoundedFixWording(issueText);

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

  if (hasSmallScope) {
    add(8, 'Small docs/config cleanup scope');
  }

  if (hasClearBehavior) {
    add(8, 'Clear expected behavior');
  }

  if (hasActionableTaskList) {
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

  const hasStrongContributionFitSignal = hasStrongFitLabel
    || hasBoundedFix
    || hasActionableTaskList
    || hasSmallScope
    || (hasBugLabel && hasClearBehavior && hasBoundedFix);
  let score = clampScore(rows.reduce((total, row) => total + row.points, 0));

  if (!hasStrongContributionFitSignal && score > 90) {
    add(90 - score, 'Near-perfect score requires contribution-fit evidence');
    score = 90;
  } else if (!hasStrongFitLabel && score > 94) {
    add(94 - score, 'Perfect score requires a strong contribution label');
    score = 94;
  }

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
