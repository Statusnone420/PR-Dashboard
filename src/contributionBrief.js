import { isClosedIssue } from './boardModel.js';

const BEGINNER_LABELS = ['good first issue', 'help wanted', 'beginner', 'starter'];
const HARD_PASS_LABELS = ['blocked', 'duplicate', 'wontfix', "won't fix", 'invalid'];
const SMALL_SCOPE_TERMS = ['docs', 'readme', 'typo', 'config', 'cleanup', 'spelling', 'copy', 'documentation'];
const CLEAR_TERMS = ['expected', 'actual', 'should', 'steps to reproduce', 'acceptance criteria', 'repro'];
const VAGUE_TERMS = ['details are unclear', 'unclear', 'not sure', 'somehow', 'needs discussion', 'tbd'];
const COMPLEX_TERMS = ['rewrite', 'entire', 'architecture', 'large refactor', 'refactor', 'migration', 'redesign'];
const META_PHRASES = ['community onboarding', 'contributors wanted', 'growth plan', 'starter issues board'];

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

function includesAny(value, terms) {
  return terms.some(term => value.includes(term));
}

function escapedRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesWholeTerm(value, term) {
  return new RegExp(`(^|[^a-z0-9])${escapedRegex(term)}([^a-z0-9]|$)`, 'i').test(value);
}

function includesAnyWholeTerm(value, terms) {
  return terms.some(term => includesWholeTerm(value, term));
}

function isMetaWork(text, labels) {
  return includesAny(text, META_PHRASES)
    || includesAnyWholeTerm(text, ['meta', 'roadmap'])
    || labels.some(label => label === 'meta' || label === 'roadmap' || includesAnyWholeTerm(label, ['marketing', 'community', 'growth']));
}

function hasTaskList(issue) {
  return /(^|\n)\s*(- \[[ x]\]|\d+\.|- )\s+\S/i.test(String(issue?.body || ''));
}

function rowLabels(scoreData) {
  return (scoreData?.rows || []).map(row => String(row?.label || '').toLowerCase());
}

function passReasons(scoreData) {
  return (scoreData?.passReasons || []).map(reason => String(reason || '').toLowerCase());
}

function hasScoreSignal(scoreData, needle) {
  const normalized = needle.toLowerCase();
  return rowLabels(scoreData).some(label => label.includes(normalized))
    || passReasons(scoreData).some(reason => reason.includes(normalized));
}

function pushUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

function firstItems(list, count) {
  return list.filter(Boolean).slice(0, count);
}

function formatCompactNumber(value) {
  const count = Number(value || 0);
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  return `${count}`;
}

function hasPositiveScoreSignal(scoreData, needle) {
  const normalized = needle.toLowerCase();
  return (scoreData?.rows || []).some(row => Number(row?.points || 0) > 0 && String(row?.label || '').toLowerCase().includes(normalized));
}

function buildPrimaryScoreReason(issue, scoreData) {
  const score = Number(scoreData?.score || 0);
  const rows = scoreData?.rows || [];
  const negativeRows = rows
    .filter(row => Number(row?.points || 0) < 0)
    .map(row => String(row?.label || '').toLowerCase());

  if (score < 70) {
    const risks = [];
    if (negativeRows.some(label => label.includes('unfilled issue template'))) pushUnique(risks, 'unfilled issue template');
    if (negativeRows.some(label => label.includes('assigned'))) pushUnique(risks, 'already assigned');
    if (negativeRows.some(label => label.includes('below selected repo stars'))) pushUnique(risks, 'below selected stars filter');
    if (negativeRows.some(label => label.includes('thin issue') || label.includes('vague'))) pushUnique(risks, 'not enough issue detail');
    if (negativeRows.some(label => label.includes('too many comments') || label.includes('comment'))) pushUnique(risks, 'comment noise');
    if (risks.length) return `${risks.join(', ')}.`;
    if (score < 50) return null;
  }

  const parts = [];
  const preferenceRows = rows
    .filter(row => Number(row?.points || 0) > 0 && /^Matches .* preference$/.test(String(row?.label || '')))
    .map(row => String(row.label).replace(/^Matches\s+/i, '').replace(/\s+preference$/i, ''));
  if (preferenceRows.length) pushUnique(parts, `matches ${firstItems(preferenceRows, 2).join('/')} preference`);
  if (hasPositiveScoreSignal(scoreData, 'selected label filter')) pushUnique(parts, 'matches selected labels');
  if (hasPositiveScoreSignal(scoreData, 'unassigned')) pushUnique(parts, 'unassigned');
  if (hasPositiveScoreSignal(scoreData, 'small') || hasPositiveScoreSignal(scoreData, 'task list')) pushUnique(parts, 'bounded work');
  if (hasPositiveScoreSignal(scoreData, 'expected behavior')) pushUnique(parts, 'clear expected behavior');

  const stars = Number(issue?.repository?.stargazers_count || 0);
  if (stars >= 5000) {
    const repoActivity = hasPositiveScoreSignal(scoreData, 'pushed recently') || hasPositiveScoreSignal(scoreData, 'repo prs are merging')
      ? 'active '
      : '';
    pushUnique(parts, `${repoActivity}${formatCompactNumber(stars)}-star repo`);
  } else if (hasPositiveScoreSignal(scoreData, 'selected repo stars filter')) {
    pushUnique(parts, 'meets selected star filter');
  }

  return parts.length ? `${firstItems(parts, 3).join(', ')}.` : null;
}

function getRepoHealth(issue, now) {
  const repo = issue?.repository || {};
  if (repo.archived) return { label: 'Archived repo', inactive: true, hard: true };
  if (repo.disabled) return { label: 'Disabled repo', inactive: true, hard: true };
  if (repo.metadataUnavailable || issue?.repository_metadata_unavailable) {
    return { label: 'Repo metadata unavailable', inactive: false, hard: false };
  }

  const pushedDays = daysSince(repo.pushed_at, now);
  if (pushedDays <= 90) return { label: 'Active repo', inactive: false, hard: false };
  if (pushedDays > 365) return { label: 'Repo looks inactive', inactive: true, hard: false };
  if (Number.isFinite(pushedDays)) return { label: 'Repo activity mixed', inactive: false, hard: false };
  return { label: 'Repo activity unclear', inactive: false, hard: false };
}

function getScope(issue, text, scoreData) {
  if (includesAny(text, COMPLEX_TERMS) || hasScoreSignal(scoreData, 'complex') || hasScoreSignal(scoreData, 'large') || hasScoreSignal(scoreData, 'advanced difficulty')) {
    return 'Large/unclear scope';
  }
  if (includesAny(text, SMALL_SCOPE_TERMS) || hasTaskList(issue) || hasScoreSignal(scoreData, 'small')) {
    return 'Small scope';
  }
  return 'Medium scope';
}

function getClarity(issue, text, scoreData) {
  const body = String(issue?.body || '').trim();
  const vague = body.length < 80 || includesAny(text, VAGUE_TERMS) || hasScoreSignal(scoreData, 'vague');
  if (!vague && (body.length >= 140 || includesAny(text, CLEAR_TERMS) || hasTaskList(issue))) {
    return 'Clear enough';
  }
  if (body.length < 30 && (Number(scoreData?.score || 0) < 50 || includesAny(text, VAGUE_TERMS))) {
    return 'Too vague';
  }
  return 'Needs clarification';
}

function getSocialRisk(issue, issueUpdatedDays) {
  const assigned = Boolean(issue?.assignee || (Array.isArray(issue?.assignees) && issue.assignees.length > 0));
  const comments = Number(issue?.comments || 0);
  if (assigned) return 'Already assigned';
  if (comments > 15) return 'Crowded thread';
  if (issueUpdatedDays > 180) return 'Stale risk';
  return 'Low noise';
}

function getGuidanceFit({ verdict, scope, clarity, repoHealth, hasHardPassLabel, isMeta }) {
  if (verdict === 'Likely pass' && (scope === 'Large/unclear scope' || clarity === 'Too vague' || hasHardPassLabel || isMeta)) {
    return 'Too open-ended';
  }
  if (clarity === 'Needs clarification') return 'Ask maintainer first';
  if (scope === 'Large/unclear scope' || repoHealth.inactive || repoHealth.label === 'Repo metadata unavailable') {
    return 'Needs repo inspection';
  }
  return 'Well-bounded';
}

function getHardPassReasons({ closed, assigned, comments, stale, repoHealth, scope, clarity, hasHardPassLabel, hasPlatformMismatch }) {
  const reasons = [];
  if (closed) pushUnique(reasons, 'The issue is closed.');
  if (repoHealth.hard) pushUnique(reasons, `${repoHealth.label} makes new contribution work unlikely to land.`);
  if (hasHardPassLabel) pushUnique(reasons, 'A blocked, duplicate, wontfix, or invalid label makes this a poor target.');
  if (hasPlatformMismatch) pushUnique(reasons, 'The setup docs do not match the selected target platforms.');
  if (assigned && comments > 15) pushUnique(reasons, 'The issue is already assigned and has a crowded thread.');
  if (assigned && stale) pushUnique(reasons, 'The issue is already assigned and stale.');
  if (clarity === 'Too vague' && scope === 'Large/unclear scope') {
    pushUnique(reasons, 'The issue is both too vague and too broad to bound.');
  }
  return reasons;
}

function getVerdict({ score, closed, assigned, comments, stale, repoHealth, scope, clarity, hasHardPassLabel, hasPlatformMismatch }) {
  if (
    score < 50
    || getHardPassReasons({ closed, assigned, comments, stale, repoHealth, scope, clarity, hasHardPassLabel, hasPlatformMismatch }).length > 0
  ) {
    return 'Likely pass';
  }
  if (!assigned && score >= 70 && scope !== 'Large/unclear scope' && clarity === 'Clear enough' && !repoHealth.inactive) {
    return 'Good candidate';
  }
  return 'Maybe';
}

function getBestFor({ verdict, assigned, hasBeginnerLabel, scope, clarity }) {
  if (verdict === 'Likely pass') return 'Skip';
  if (scope === 'Large/unclear scope') return 'Deep Dive';
  if (!assigned && hasBeginnerLabel && scope === 'Small scope' && clarity === 'Clear enough') return 'First PR';
  return 'Standard';
}

function buildWhy({ verdict, issue, score, scoreData, hasBeginnerLabel, scope, clarity, socialRisk, repoHealth, hardPassReasons }) {
  const why = [];
  const primaryScoreReason = buildPrimaryScoreReason(issue, scoreData);
  if (primaryScoreReason) pushUnique(why, primaryScoreReason);

  if (verdict === 'Likely pass') {
    if (score < 50) {
      pushUnique(why, `Match score is ${score}, below the usual contribution bar.`);
    }
    hardPassReasons.forEach(reason => pushUnique(why, reason));
    if (socialRisk === 'Already assigned') pushUnique(why, 'Someone is already assigned to the issue.');
    if (socialRisk === 'Crowded thread') pushUnique(why, 'The discussion is already crowded.');
    if (repoHealth.inactive || repoHealth.hard) pushUnique(why, `${repoHealth.label} raises follow-through risk.`);
    if (clarity !== 'Clear enough') pushUnique(why, 'The issue does not give enough direction yet.');
    if (scope === 'Large/unclear scope') pushUnique(why, 'The requested work looks broad or hard to bound.');
    return firstItems(why, 3);
  }

  if (hasBeginnerLabel) pushUnique(why, 'Beginner-friendly label is present, but the score uses the issue details too.');
  if (scope === 'Small scope') pushUnique(why, 'The visible work looks small and bounded.');
  if (scope === 'Medium scope') pushUnique(why, 'The issue looks approachable after a normal repo read-through.');
  if (scope === 'Large/unclear scope') pushUnique(why, 'This looks like deeper repo work, not a quick first PR.');
  if (clarity === 'Clear enough') pushUnique(why, 'The body gives enough expected behavior to start inspection.');
  if (clarity === 'Needs clarification') pushUnique(why, 'The score is usable, but the issue needs a maintainer clarification first.');
  if (socialRisk === 'Low noise') pushUnique(why, 'The thread is quiet and not assigned.');
  if (repoHealth.label === 'Active repo') pushUnique(why, 'Recent repository activity suggests maintainers may respond.');
  if (!issue?.repository?.full_name && !issue?.repository?.name) pushUnique(why, 'Repository context is limited, so inspect before committing.');
  return firstItems(why, 3);
}

function buildRisks({ issue, text, scoreData, scope, clarity, socialRisk, issueUpdatedDays, repoHealth, hasHardPassLabel, isMeta }) {
  const risks = [];
  if (socialRisk === 'Already assigned') pushUnique(risks, 'Already assigned; contributing may duplicate active work.');
  if (socialRisk === 'Crowded thread' || Number(issue?.comments || 0) > 15) {
    pushUnique(risks, 'High comment noise; the useful next step may be buried.');
  }
  if (issueUpdatedDays > 365 || hasScoreSignal(scoreData, 'old')) pushUnique(risks, 'Stale issue; maintainer interest may have cooled.');
  if (repoHealth.inactive || repoHealth.hard) pushUnique(risks, `${repoHealth.label}; validate the repo before investing time.`);
  if (hasHardPassLabel) pushUnique(risks, 'Blocked, duplicate, or wontfix label makes this a poor target.');
  if (hasScoreSignal(scoreData, 'platform mismatch')) pushUnique(risks, 'Selected target platforms do not match the setup requirements.');
  if (hasScoreSignal(scoreData, 'advanced difficulty')) pushUnique(risks, 'Advanced difficulty label; treat this as deeper repo work.');
  if (isMeta) pushUnique(risks, 'Roadmap or meta work is hard to finish as a focused PR.');
  if (scope === 'Large/unclear scope') pushUnique(risks, 'Large scope or refactor language may hide substantial design work.');
  if (clarity !== 'Clear enough') pushUnique(risks, 'Vague body; ask what outcome would be accepted.');
  if (includesAny(text, ['breaking change', 'api change'])) pushUnique(risks, 'API or breaking-change language can expand review scope.');
  if (risks.length === 0) pushUnique(risks, 'Still confirm setup, tests, and maintainer expectations before starting.');
  return firstItems(risks, 3);
}

function getFirstMove({ verdict, bestFor, guidanceFit }) {
  if (verdict === 'Likely pass') return 'Pass for now and compare against a fresher unassigned issue.';
  if (guidanceFit === 'Ask maintainer first') return 'Ask the maintainer to confirm the smallest acceptable fix before starting.';
  if (guidanceFit === 'Needs repo inspection') return 'Read CONTRIBUTING.md and inspect the likely files before commenting.';
  if (bestFor === 'First PR') return 'Read CONTRIBUTING.md, then comment with the small fix you plan to make.';
  if (bestFor === 'Deep Dive') return 'Map the affected files and propose a narrow plan before coding.';
  return 'Reproduce or inspect locally, then comment with your intended approach.';
}

export function buildContributionBrief(issue, scoreData = {}, options = {}) {
  const now = options.now ?? Date.now();
  const labels = labelNames(issue);
  const text = textBlob(issue);
  const score = Number.isFinite(Number(scoreData?.score)) ? Number(scoreData.score) : 0;
  const comments = Number(issue?.comments || 0);
  const issueUpdatedDays = daysSince(issue?.updated_at, now);
  const closed = isClosedIssue(issue);
  const assigned = Boolean(issue?.assignee || (Array.isArray(issue?.assignees) && issue.assignees.length > 0));
  const hasBeginnerLabel = Boolean(scoreData?.flags?.hasBeginnerLabel)
    || labels.some(label => BEGINNER_LABELS.some(beginner => label.includes(beginner)));
  const hasHardPassLabel = labels.some(label => HARD_PASS_LABELS.some(hardPass => includesWholeTerm(label, hardPass)));
  const hasPlatformMismatch = hasScoreSignal(scoreData, 'platform mismatch');
  const isMeta = isMetaWork(text, labels);
  const stale = issueUpdatedDays > 180 || hasScoreSignal(scoreData, 'old');
  const repoHealth = getRepoHealth(issue, now);
  const scope = getScope(issue, text, scoreData);
  const clarity = getClarity(issue, text, scoreData);
  const socialRisk = getSocialRisk(issue, issueUpdatedDays);
  const hardPassReasons = getHardPassReasons({ closed, assigned, comments, stale, repoHealth, scope, clarity, hasHardPassLabel, hasPlatformMismatch });
  const verdict = getVerdict({
    score,
    closed,
    assigned,
    comments,
    stale,
    repoHealth,
    scope,
    clarity,
    hasHardPassLabel,
    hasPlatformMismatch
  });
  const bestFor = getBestFor({ verdict, assigned, hasBeginnerLabel, scope, clarity });
  const guidanceFit = getGuidanceFit({ verdict, scope, clarity, repoHealth, hasHardPassLabel, isMeta });
  const maintainerQuestion = guidanceFit === 'Ask maintainer first' && verdict !== 'Likely pass'
    ? 'Could you clarify the expected behavior and the smallest acceptable fix for this issue?'
    : null;

  return {
    verdict,
    bestFor,
    scope,
    clarity,
    socialRisk,
    repoHealth: repoHealth.label,
    guidanceFit,
    why: buildWhy({ verdict, issue, score, scoreData, hasBeginnerLabel, scope, clarity, socialRisk, repoHealth, hardPassReasons }),
    risks: buildRisks({ issue, text, scoreData, scope, clarity, socialRisk, issueUpdatedDays, repoHealth, hasHardPassLabel, isMeta }),
    firstMove: getFirstMove({ verdict, bestFor, guidanceFit }),
    maintainerQuestion
  };
}
