export const GITHUB_ACTIVITY_NO_CHANGES_SUMMARY = 'No changes since last refresh.';

function normalizeText(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function loginOf(user) {
  return normalizeText(user?.login);
}

function sortedLogins(users) {
  if (!Array.isArray(users)) return [];
  return users
    .map(loginOf)
    .filter(Boolean)
    .map(login => login.toLowerCase())
    .sort();
}

function sortedLabelNames(labels) {
  if (!Array.isArray(labels)) return [];
  return labels
    .map(label => typeof label === 'string' ? label : label?.name)
    .filter(Boolean)
    .map(name => String(name).toLowerCase())
    .sort();
}

function sameList(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function plural(value, singular, pluralValue) {
  return value === 1 ? singular : pluralValue;
}

function summarizeActivity(activity) {
  if (activity.latest_state === 'closed' && (activity.state_changed || activity.closed_changed)) {
    return 'Issue was closed on GitHub.';
  }

  if (activity.state_changed) {
    return `GitHub state changed to ${activity.latest_state}.`;
  }

  if (activity.comment_delta > 0) {
    return `${activity.comment_delta} new ${plural(activity.comment_delta, 'comment', 'comments')} since last refresh.`;
  }

  if (activity.assignee_changed || activity.assignees_changed) {
    return 'Assignee changed on GitHub.';
  }

  if (activity.labels_changed) {
    return 'Labels changed on GitHub.';
  }

  if (activity.state_reason_changed) {
    return 'GitHub state reason changed.';
  }

  if (activity.closed_changed) {
    return 'Closed state changed on GitHub.';
  }

  return 'Updated on GitHub since last refresh.';
}

function baseActivityFromIssue(issue, options = {}) {
  const now = options.now || new Date().toISOString();
  const comments = numberOrZero(issue?.comments);
  const state = normalizeText(issue?.state) || 'open';
  const stateReason = normalizeText(issue?.state_reason);
  const closedAt = normalizeText(issue?.closed_at);
  return {
    last_checked_at: now,
    previous_updated_at: normalizeText(issue?.updated_at),
    latest_updated_at: normalizeText(issue?.updated_at),
    previous_comments: comments,
    latest_comments: comments,
    comment_delta: 0,
    previous_state: state,
    latest_state: state,
    state_changed: false,
    previous_state_reason: stateReason,
    latest_state_reason: stateReason,
    state_reason_changed: false,
    assignee_changed: false,
    assignees_changed: false,
    labels_changed: false,
    closed_changed: false,
    updated_changed: false,
    has_new_activity: false,
    summary: GITHUB_ACTIVITY_NO_CHANGES_SUMMARY,
    etag: options.etag || issue?.github_activity?.etag || ''
  };
}

export function buildUnchangedGitHubActivity(card, options = {}) {
  return baseActivityFromIssue(card, {
    now: options.now,
    etag: options.etag || card?.github_activity?.etag || ''
  });
}

export function buildGitHubActivity(savedCard, apiIssue, options = {}) {
  const previousUpdatedAt = normalizeText(savedCard?.updated_at);
  const latestUpdatedAt = normalizeText(apiIssue?.updated_at ?? savedCard?.updated_at);
  const previousComments = numberOrZero(savedCard?.comments);
  const latestComments = numberOrZero(apiIssue?.comments ?? savedCard?.comments);
  const previousState = normalizeText(savedCard?.state) || 'open';
  const latestState = normalizeText(apiIssue?.state ?? savedCard?.state) || previousState;
  const previousStateReason = normalizeText(savedCard?.state_reason);
  const latestStateReason = normalizeText(apiIssue?.state_reason ?? savedCard?.state_reason);
  const previousClosedAt = normalizeText(savedCard?.closed_at);
  const latestClosedAt = normalizeText(apiIssue?.closed_at ?? savedCard?.closed_at);
  const previousAssignee = loginOf(savedCard?.assignee);
  const latestAssignee = loginOf(apiIssue?.assignee ?? savedCard?.assignee);
  const previousAssignees = sortedLogins(savedCard?.assignees);
  const latestAssignees = sortedLogins(apiIssue?.assignees ?? savedCard?.assignees);
  const previousLabels = sortedLabelNames(savedCard?.labels);
  const latestLabels = sortedLabelNames(apiIssue?.labels ?? savedCard?.labels);

  const commentDelta = latestComments - previousComments;
  const stateChanged = previousState !== latestState;
  const stateReasonChanged = previousStateReason !== latestStateReason;
  const closedChanged = previousClosedAt !== latestClosedAt;
  const assigneeChanged = previousAssignee !== latestAssignee;
  const assigneesChanged = !sameList(previousAssignees, latestAssignees);
  const labelsChanged = !sameList(previousLabels, latestLabels);
  const updatedChanged = previousUpdatedAt !== latestUpdatedAt;
  const commentDecreaseOnly = commentDelta < 0
    && !stateChanged
    && !stateReasonChanged
    && !closedChanged
    && !assigneeChanged
    && !assigneesChanged
    && !labelsChanged;
  const updatedActivity = updatedChanged && !commentDecreaseOnly;

  const activity = {
    last_checked_at: options.now || new Date().toISOString(),
    previous_updated_at: previousUpdatedAt,
    latest_updated_at: latestUpdatedAt,
    previous_comments: previousComments,
    latest_comments: latestComments,
    comment_delta: commentDelta,
    previous_state: previousState,
    latest_state: latestState,
    state_changed: stateChanged,
    previous_state_reason: previousStateReason,
    latest_state_reason: latestStateReason,
    state_reason_changed: stateReasonChanged,
    assignee_changed: assigneeChanged,
    assignees_changed: assigneesChanged,
    labels_changed: labelsChanged,
    closed_changed: closedChanged,
    updated_changed: updatedChanged,
    has_new_activity: stateChanged
      || stateReasonChanged
      || closedChanged
      || commentDelta > 0
      || assigneeChanged
      || assigneesChanged
      || labelsChanged
      || updatedActivity,
    summary: GITHUB_ACTIVITY_NO_CHANGES_SUMMARY,
    etag: options.etag || savedCard?.github_activity?.etag || ''
  };

  activity.summary = activity.has_new_activity
    ? summarizeActivity(activity)
    : GITHUB_ACTIVITY_NO_CHANGES_SUMMARY;

  return activity;
}
