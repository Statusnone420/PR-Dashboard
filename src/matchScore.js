import { isClosedIssue } from './boardModel.js';
import { getFeedbackScoreAdjustment } from './matchFeedback.js';
import { getPlatformEvidence, getPlatformMismatchReason, issueMatchesTargetPlatforms } from './platformFilters.js';

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
const CONFIDENCE_CAPS = {
  Low: 88,
  Medium: 94
};
const WORK_TYPE_TERMS = {
  docs: ['docs', 'documentation', 'readme', 'copy', 'wording'],
  readme: ['readme'],
  tests: ['test', 'tests', 'testing'],
  test: ['test', 'tests', 'testing'],
  config: ['config', 'configuration', 'settings'],
  ui: ['ui', 'button', 'label', 'tooltip', 'copy'],
  bug: ['bug', 'fix', 'broken', 'expected', 'actual'],
  refactor: ['refactor', 'rewrite', 'architecture'],
  migration: ['migration', 'migrate'],
  api: ['api', 'endpoint']
};

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

function hasWholeTerm(value, term) {
  return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(value);
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

function levelScore(level) {
  if (level === 'High') return 90;
  if (level === 'Medium') return 60;
  if (level === 'Low') return 25;
  return 0;
}

function createMiniScore(label, level, reasons = []) {
  return {
    label,
    level,
    score: levelScore(level),
    reasons: reasons.filter(Boolean)
  };
}

function getIssueBody(issue) {
  return typeof issue?.body === 'string' ? issue.body.trim() : '';
}

function repoMetadataUnavailable(issue) {
  const repo = issue?.repository || {};
  return Boolean(
    repo.metadataUnavailable
    || issue?.repository_metadata_unavailable
    || (!repo.full_name && !repo.name)
    || (
      repo.full_name
      && repo.pushed_at === undefined
      && repo.stargazers_count === undefined
      && repo.archived === undefined
      && repo.disabled === undefined
    )
  );
}

function buildConfidence(issue, signals, stage, enrichment = {}, targetPlatforms = null) {
  const reasons = [];
  const currentWeaknesses = [];
  const repo = issue?.repository || {};
  const body = getIssueBody(issue);
  const commentSummary = enrichment?.comments || null;
  const timelineSummary = enrichment?.timeline || null;
  const setupSummary = enrichment?.setup || null;
  const historySummary = enrichment?.history || null;
  const commentsInspected = Boolean(commentSummary?.inspected);
  const timelineInspected = Boolean(timelineSummary?.inspected);
  const setupInspected = Boolean(setupSummary?.inspected);
  const historyInspected = Boolean(historySummary?.inspected);

  if (repoMetadataUnavailable(issue)) {
    reasons.push('Repository metadata unavailable');
    currentWeaknesses.push('repo');
  }
  if (repo.archived || repo.disabled) {
    reasons.push('Repository archived or disabled');
    currentWeaknesses.push('repo');
  }
  if (!body || body.length < 80) {
    reasons.push('Issue body is short');
    currentWeaknesses.push('body');
  } else if (/details are unclear|unclear|not sure|somehow/i.test(body)) {
    reasons.push('Issue body is vague');
    currentWeaknesses.push('body');
  }
  if (signals.updatedDays > 365) {
    reasons.push('Issue is stale');
    currentWeaknesses.push('age');
  }
  if (repo.pushed_at && daysSince(repo.pushed_at, signals.now) > 365) {
    reasons.push('Repository appears stale');
    currentWeaknesses.push('repo-age');
  }
  if (signals.isAssigned && Number(issue?.comments || 0) > 10) {
    reasons.push('Assigned issue has an active thread');
    currentWeaknesses.push('social');
  }

  if (commentsInspected) {
    reasons.push('Comments inspected');
    if (commentSummary.botOnlyRecentActivity) {
      reasons.push('Only bot comments inspected');
    }
    if (commentSummary.ownershipClaim || commentSummary.blockedHint) {
      currentWeaknesses.push('social');
    }
  } else if (stage === 'preview') {
    reasons.push('Comments not inspected');
  }
  if (timelineInspected) {
    reasons.push('Timeline inspected');
    if (timelineSummary.linkedPullRequest || timelineSummary.assignmentActivity || timelineSummary.duplicateOrBlockedReference) {
      currentWeaknesses.push('social');
    }
  } else {
    reasons.push('Timeline not inspected');
  }
  if (setupInspected) {
    reasons.push('Setup files inspected');
    if (setupSummary.setupUnclear) {
      currentWeaknesses.push('setup');
    }
    if (!issueMatchesTargetPlatforms(setupSummary, targetPlatforms)) {
      reasons.push('Target platform mismatch');
      currentWeaknesses.push('setup');
    }
  } else {
    reasons.push('Setup files not inspected');
  }
  if (historyInspected) {
    reasons.push('Repo history inspected');
    if (historySummary.staleSameLabelSample) {
      currentWeaknesses.push('age');
    }
  }

  const distinctWeaknesses = new Set(currentWeaknesses);
  let level = 'High';
  if (
    distinctWeaknesses.has('repo')
    || (distinctWeaknesses.has('body') && (distinctWeaknesses.has('age') || distinctWeaknesses.has('social')))
    || distinctWeaknesses.has('repo-age')
  ) {
    level = 'Low';
  } else if (
    distinctWeaknesses.size > 0
    || Number(issue?.comments || 0) > 10
    || signals.isAssigned
    || signals.updatedDays > 180
  ) {
    level = 'Medium';
  }

  return { level, reasons };
}

function workTypeMatches(term, labels, issueText) {
  const normalized = String(term || '').toLowerCase();
  const terms = WORK_TYPE_TERMS[normalized] || [normalized];
  return terms.some(item => labels.some(label => hasWholeTerm(label, item)) || hasWholeTerm(issueText, item));
}

function scopeLabel(signals) {
  if (signals.hasComplexScope) return 'Large/unclear';
  if (signals.hasSmallScope || signals.hasActionableTaskList || signals.hasBoundedFix) return 'Small';
  return 'Medium';
}

function buildPersonalFit(issue, profile, signals) {
  if (!profile || typeof profile !== 'object') {
    return {
      personalFit: {
        status: 'Unknown',
        adjustment: 0,
        reasons: ['No contribution preferences saved']
      },
      rows: []
    };
  }

  const rows = [];
  const reasons = [];
  const labels = signals.labels;
  const issueText = signals.issueText;
  const repoLanguage = String(issue?.repository?.language || '').toLowerCase();
  const languages = Array.isArray(profile.languages) ? profile.languages : [];
  const preferredWork = Array.isArray(profile.preferredWork) ? profile.preferredWork : [];
  const avoidWork = Array.isArray(profile.avoidWork) ? profile.avoidWork : [];

  for (const language of languages) {
    const clean = String(language || '').trim();
    if (clean && repoLanguage && repoLanguage === clean.toLowerCase()) {
      rows.push({ points: 6, label: `Matches ${clean} preference` });
      reasons.push(`Matches ${clean} preference`);
      break;
    }
  }

  for (const work of preferredWork) {
    const clean = String(work || '').trim();
    if (clean && workTypeMatches(clean, labels, issueText)) {
      rows.push({ points: 5, label: `Matches ${clean} preference` });
      reasons.push(`Matches ${clean} preference`);
    }
  }

  for (const work of avoidWork) {
    const clean = String(work || '').trim();
    if (clean && workTypeMatches(clean, labels, issueText)) {
      rows.push({ points: -8, label: `Matches avoided ${clean} work` });
      reasons.push(`Avoids ${clean} work`);
    }
  }

  const scope = scopeLabel(signals);
  if (profile.timeBudget === 'under-1-hour' && scope !== 'Small') {
    rows.push({ points: -7, label: 'Larger than under-1-hour preference' });
    reasons.push('Larger than under-1-hour preference');
  } else if (profile.timeBudget === 'half-day' && scope === 'Large/unclear') {
    rows.push({ points: -5, label: 'Larger than half-day preference' });
    reasons.push('Larger than half-day preference');
  }

  if (profile.experience === 'first-pr' && signals.hasBeginnerLabel && scope === 'Small') {
    rows.push({ points: 4, label: 'Matches first PR preference' });
    reasons.push('Matches first PR preference');
  } else if (profile.experience === 'first-pr' && scope === 'Large/unclear') {
    rows.push({ points: -6, label: 'Too broad for first PR preference' });
    reasons.push('Too broad for first PR preference');
  } else if (profile.experience === 'advanced' && scope === 'Large/unclear') {
    rows.push({ points: 3, label: 'Matches advanced preference' });
    reasons.push('Matches advanced preference');
  }

  const rawAdjustment = rows.reduce((total, row) => total + row.points, 0);
  const adjustment = Math.max(-20, Math.min(15, rawAdjustment));
  if (adjustment !== rawAdjustment) {
    rows.push({
      points: adjustment - rawAdjustment,
      label: 'Contribution preference adjustment cap'
    });
  }
  const status = adjustment > 0 ? 'Matched' : adjustment < -8 ? 'Mismatch' : adjustment < 0 ? 'Mixed' : 'Unknown';

  return {
    personalFit: {
      status,
      adjustment,
      reasons: reasons.length ? reasons : ['No contribution preference match']
    },
    rows
  };
}

function buildMiniScores(issue, signals, personalFit, enrichment = {}, targetPlatforms = null) {
  const opportunityReasons = [];
  const historySummary = enrichment?.history || null;
  const timelineSummary = enrichment?.timeline || null;
  const setupSummary = enrichment?.setup || null;
  if (signals.hasBeginnerLabel || signals.hasStrongFitLabel || signals.hasBoundedFix) opportunityReasons.push('Clear contribution target');
  if (historySummary?.activeSameLabelIssues) opportunityReasons.push('Same-label issues are active');
  if (historySummary?.staleSameLabelSample) opportunityReasons.push('Same-label issues look stale');
  if (signals.hasStaleLabel || signals.hasMetaGrowth || isClosedIssue(issue)) opportunityReasons.push('Hard-pass signal present');
  const opportunityLevel = isClosedIssue(issue) || signals.hasStaleLabel || signals.hasMetaGrowth || historySummary?.staleSameLabelSample
    ? 'Low'
    : signals.hasBeginnerLabel || signals.hasStrongFitLabel || signals.hasBoundedFix || signals.hasSmallScope || historySummary?.activeSameLabelIssues
      ? 'High'
      : 'Medium';

  const body = getIssueBody(issue);
  const clarityLevel = !body
    ? 'Unknown'
    : body.length < 80 || /details are unclear|unclear|not sure|somehow/i.test(body)
      ? 'Low'
      : signals.hasClearBehavior || signals.hasActionableTaskList || body.length >= 140
        ? 'High'
        : 'Medium';

  const scope = scopeLabel(signals);
  const scopeLevel = scope === 'Small' ? 'High' : scope === 'Medium' ? 'Medium' : 'Low';
  const repo = issue?.repository || {};
  const pushedDays = daysSince(repo.pushed_at, signals.now);
  const repoHealth = repo.archived || repo.disabled || pushedDays > 365
    ? createMiniScore('Low', 'Low', ['Repository is stale or unavailable'])
    : repoMetadataUnavailable(issue)
      ? createMiniScore('Unknown', 'Unknown', ['Repository metadata unavailable'])
      : pushedDays <= 90 || historySummary?.recentMergedPrs
        ? createMiniScore('High', 'High', [historySummary?.recentMergedPrs ? 'Recent repo PRs are merging' : 'Repository pushed recently'])
        : createMiniScore('Medium', 'Medium', ['Repository activity is mixed']);

  const comments = Number(issue?.comments || 0);
  const commentSummary = enrichment?.comments || null;
  const socialRisk = timelineSummary?.linkedPullRequest || timelineSummary?.assignmentActivity
    ? createMiniScore('High risk', 'Low', [timelineSummary.linkedPullRequest ? 'Timeline shows linked PR activity' : 'Timeline shows assignment activity'])
    : commentSummary?.blockedHint || commentSummary?.ownershipClaim
    ? createMiniScore('High risk', 'Low', [commentSummary.blockedHint ? 'Comment thread suggests blocked work' : 'Comment thread suggests someone may be working on this'])
    : signals.isAssigned || comments > 15
      ? createMiniScore('High risk', 'Low', [signals.isAssigned ? 'Already assigned' : 'Crowded thread'])
      : comments > 5
        ? createMiniScore('Medium risk', 'Medium', ['Needs comment review'])
        : createMiniScore('Low risk', 'High', [commentSummary?.maintainerEncouragement ? 'Maintainer appears open to PRs' : 'Unassigned or quiet thread']);
  const setupEase = setupSummary?.inspected
    ? !issueMatchesTargetPlatforms(setupSummary, targetPlatforms)
      ? createMiniScore('Blocked', 'Low', [getPlatformMismatchReason(setupSummary, targetPlatforms)])
      : setupSummary.setupUnclear
      ? createMiniScore('Unclear', 'Low', ['Setup files look unclear'])
      : setupSummary.setupDocsPresent || setupSummary.workflowPresent || setupSummary.configHintsPresent
        ? createMiniScore('Discoverable', 'High', setupSummary.reasons?.length ? setupSummary.reasons : ['Repo setup files look discoverable'])
        : createMiniScore('Limited', 'Medium', ['Setup evidence is limited'])
    : createMiniScore('Unknown', 'Unknown', ['Setup files not inspected']);

  return {
    opportunityFit: createMiniScore(opportunityLevel, opportunityLevel, opportunityReasons),
    issueClarity: createMiniScore(clarityLevel, clarityLevel, [clarityLevel === 'High' ? 'Issue describes expected outcome' : 'Issue may need clarification']),
    scope: createMiniScore(scope, scopeLevel, [scope === 'Small' ? 'Work looks bounded' : 'Inspect scope before starting']),
    repoHealth,
    socialRisk,
    setupEase,
    personalFit: createMiniScore(personalFit.status, personalFit.status === 'Matched' ? 'High' : personalFit.status === 'Mixed' ? 'Medium' : personalFit.status === 'Mismatch' ? 'Low' : 'Unknown', personalFit.reasons)
  };
}

function applyScoreCap(score, cap, label, add) {
  if (score <= cap) return score;
  add(cap - score, label);
  return cap;
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
  const hasComplexScope = hasAny(issueText, COMPLEX_SCOPE_TERMS);
  const hasMetaGrowth = hasAny(issueText, META_GROWTH_TERMS) || labels.some(label => /marketing|community|growth/.test(label));
  const updatedDays = daysSince(issue?.updated_at, now);
  const stage = options.stage || (options.enrichment ? 'enriched' : 'preview');
  const enrichment = options.enrichment || {};
  const targetPlatforms = options.targetPlatforms;
  const signals = {
    now,
    labels,
    issueText,
    updatedDays,
    isAssigned,
    hasBeginnerLabel,
    hasStrongFitLabel,
    hasStaleLabel,
    hasSmallScope,
    hasActionableTaskList,
    hasBoundedFix,
    hasClearBehavior,
    hasComplexScope,
    hasMetaGrowth
  };
  const emptyPersonalFit = {
    status: 'Unknown',
    adjustment: 0,
    reasons: ['No contribution preferences saved']
  };

  if (isClosedIssue(issue)) {
    add(-100, 'Closed issue', 'Closed issue');
    return {
      score: 0,
      rating: getMatchScoreRating(0),
      rows,
      passReasons: [...passReasons],
      flags: { isAssigned, hasBeginnerLabel, hasStaleLabel },
      isContributionCandidate: false,
      stage,
      confidence: {
        level: 'High',
        reasons: ['Closed issue']
      },
      miniScores: buildMiniScores(issue, signals, emptyPersonalFit, enrichment, targetPlatforms),
      personalFit: emptyPersonalFit
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

  if (hasComplexScope) {
    add(-22, 'Large or ambiguous scope', 'Too complex');
  }

  if (hasMetaGrowth) {
    add(-30, 'Meta/growth issue', 'Meta/growth issue');
  }

  const personal = buildPersonalFit(issue, options.profile, signals);
  for (const row of personal.rows) {
    add(row.points, row.label);
  }

  const feedback = getFeedbackScoreAdjustment(issue, options.feedback);
  for (const row of feedback.rows) {
    add(row.points, row.label);
  }

  const commentSummary = enrichment?.comments;
  if (commentSummary?.inspected) {
    if (commentSummary.maintainerEncouragement) {
      add(4, 'Maintainer appears open to PRs');
    }
    if (commentSummary.ownershipClaim) {
      add(-8, 'Comment thread suggests someone may be working on this', 'Possibly claimed');
    }
    if (commentSummary.blockedHint) {
      add(-10, 'Comment thread suggests blocked work', 'Blocked');
    }
  }
  const timelineSummary = enrichment?.timeline;
  if (timelineSummary?.inspected) {
    if (timelineSummary.linkedPullRequest) {
      add(-12, 'Timeline shows linked PR activity', 'Linked PR');
    }
    if (timelineSummary.assignmentActivity) {
      add(-6, 'Timeline shows assignment activity', 'Possibly claimed');
    }
    if (timelineSummary.duplicateOrBlockedReference) {
      add(-8, 'Timeline mentions duplicate or blocked context', 'Blocked');
    }
  }
  const setupSummary = enrichment?.setup;
  const platformEvidence = getPlatformEvidence(setupSummary, targetPlatforms);
  const platformMismatch = platformEvidence.status === 'mismatch';
  if (setupSummary?.inspected) {
    if (platformMismatch) {
      add(-45, `Target platform mismatch: ${getPlatformMismatchReason(setupSummary, targetPlatforms)}`, 'Platform mismatch');
    } else if (setupSummary.setupUnclear) {
      add(-6, 'Repo setup files look unclear', 'Repo setup risk');
    } else if (setupSummary.setupDocsPresent || setupSummary.workflowPresent || setupSummary.configHintsPresent) {
      add(4, 'Repo setup files look discoverable');
    }
    if (platformEvidence.filterActive && platformEvidence.status === 'confirmed') {
      add(3, 'Selected platform confirmed');
    }
  }
  const historySummary = enrichment?.history;
  if (historySummary?.inspected) {
    if (historySummary.recentMergedPrs) {
      add(4, 'Recent repo PRs are merging');
    }
    if (historySummary.activeSameLabelIssues) {
      add(3, 'Same-label issues are active');
    }
    if (historySummary.staleSameLabelSample) {
      add(-6, 'Same-label issues look stale', 'Too old');
    }
  }

  const hasStrongContributionFitSignal = hasStrongFitLabel
    || hasBoundedFix
    || hasActionableTaskList
    || hasSmallScope
    || (hasBugLabel && hasClearBehavior && hasBoundedFix);
  const confidence = buildConfidence(issue, signals, stage, enrichment, targetPlatforms);
  let score = clampScore(rows.reduce((total, row) => total + row.points, 0));

  if (!hasStrongContributionFitSignal && score > 90) {
    add(90 - score, 'Near-perfect score requires contribution-fit evidence');
    score = 90;
  } else if (!hasStrongFitLabel && score > 94) {
    add(94 - score, 'Perfect score requires a strong contribution label');
    score = 94;
  }

  if (CONFIDENCE_CAPS[confidence.level]) {
    score = applyScoreCap(score, CONFIDENCE_CAPS[confidence.level], `${confidence.level} confidence cap`, add);
  }

  if (platformMismatch && score > 45) {
    score = applyScoreCap(score, 45, 'Platform mismatch cap', add);
  }

  return {
    score,
    rating: getMatchScoreRating(score),
    rows,
    passReasons: [...passReasons],
    flags: { isAssigned, hasBeginnerLabel, hasStaleLabel },
    isContributionCandidate: score >= 50 && !platformMismatch,
    stage,
    confidence,
    miniScores: buildMiniScores(issue, signals, personal.personalFit, enrichment, targetPlatforms),
    personalFit: personal.personalFit
  };
}

export function isContributionCandidate(issue, options = {}) {
  return calculateMatchScore(issue, options).isContributionCandidate;
}
