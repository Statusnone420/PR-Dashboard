# PR Dashboard UX Fix Plan

## Summary
PR Dashboard already has a strong contribution-finding idea, a coherent dark theme, and unusually useful scoring/explainability, but the product currently makes the user work too hard to decide what to do next. This updated plan replaces the earlier React/TSX assumptions with the actual vanilla JS + Tailwind architecture, folds in the premium micro-interactions, and keeps the work focused on one outcome: faster, calmer contribution decisions.

Top production risks to fix first: inspector overload, inconsistent local-state counts, chip-heavy cards, excessive Find Contributions header chrome, empty-board dead space, and Profile/Settings scope creep. The Sonnet micro-interactions are worth adding, but they should support the simplified decision flow rather than decorate the current dense layout.

Audit baseline used for prioritization:

| Screen | Score | Reason |
|---|---:|---|
| Dashboard overview | 7.0/10 | Strong first-run direction, but saved/active/proof counts must use the same state source as Board/Profile. |
| Find Contributions — main search/results | 6.8/10 | Core flow is clear; H1, mode tabs, search, query preview, presets, filters, and sort create too much pre-result chrome. |
| Find Contributions — scrolled result grid | 6.4/10 | Useful candidates, but cards are too similar and chip-heavy after the first row. |
| Find Contributions — saved-card state | 6.7/10 | “View on board” is useful; action and chip hierarchy still compete. |
| Find Contributions — rate-limit popover | 7.0/10 | Practical power-user feature; needs better anchoring, Escape behavior, and low-limit guidance. |
| Find Contributions — review reminders popover | 6.5/10 | Useful concept, weak empty state, and too much overlay for “nothing right now.” |
| Inspector — action center / issue description | 6.1/10 | Valuable content, but it exposes too much raw issue text and internal context at once. |
| Inspector — score diagnostics / contribution brief | 6.2/10 | The scoring model is strong; the presentation competes with the recommendation. |
| Inspector — why score / action plan | 6.0/10 | Action checklist is useful; density and scroll sequencing make the decision feel like work. |
| Board / Kanban | 5.9/10 | One saved card is lost inside seven mostly empty lanes. |
| Profile — top / preferences | 6.4/10 | Preferences are useful; Profile is carrying settings, stats, learned feedback, proof log, and reminders. |
| Profile — proof log / reminders | 6.2/10 | Multiple empty sections make the page feel unfinished. |
| Settings — GitHub token setup | 7.2/10 | Security posture is good; persistence wording is muddled. |
| Settings — hidden results / danger zone | 6.6/10 | Complete, but destructive actions are repetitive and insufficiently distinguished. |
| Help | 8.1/10 | Compact, readable, and already close to the right density. |
| Feedback | 7.8/10 | Clear and functional; needs sanitized diagnostic prefill and better CTA feedback. |

## Priority fixes (sorted Critical → Low)

### Critical — Convert the plan and implementation target to the real vanilla-JS architecture
- **Problem:** The earlier `PLAN.md` pointed Codex at React/TSX components that do not exist in this repo. That will waste implementation time and produce the wrong patches. This project should be treated as a Vite app using vanilla JavaScript, Tailwind utility classes in templates, and shared CSS in `src/styles.css`.
- **Screen(s) affected:** All screens; this is the implementation prerequisite for the whole sweep.
- **Files likely involved:** `PLAN.md`, `STATE.md`, `test/docs-contract.test.js`, `src/main.js`, `src/styles.css`, plus any existing local store/router helpers found by searching for `openInspector`, `renderIssueCardsList`, `bindIssueCardListEvents`, `renderDashboard`, `renderBoard`, `renderProfile`, `renderSettings`, `renderHelp`, and `renderFeedback`.
- **Implementation:** Treat this `PLAN.md` as the active UX sweep plan. Update `test/docs-contract.test.js` so it validates that the active plan is a combined UX sweep, not a reset/ready-state plan. Do not add React, component libraries, animation libraries, or state-management dependencies. Keep the work in plain JS modules and CSS.

  Codex implementation guardrails:

  ```text
  No new dependencies.
  Do not introduce React/TSX.
  Prefer small helper modules over one giant main.js patch.
  Keep existing localStorage/export/import schema compatible.
  After each phase: npm test, npm run build, git diff --check.
  Update STATE.md with completed changes, verification, and remaining risk.
  ```
- **Acceptance criteria:** `PLAN.md` reflects the actual codebase. Docs-contract tests intentionally accept this active UX plan. `npm test`, `npm run build`, and `git diff --check` pass after the sweep, except for any explicitly documented pre-existing failure that Codex confirms before changing code.

### Critical — Rebuild the inspector as a decision drawer with Overview / Evidence / Action tabs
- **Problem:** The inspector is the main UX failure. It currently mixes score diagnostics, mini-scores, confidence, contribution brief, risks, first move, action plan, comments, advanced context, and raw issue description in one long scrollable drawer. The user should not need to scroll through a document dump to decide whether to save, hide, pass, or open the issue.
- **Screen(s) affected:** Inspector drawer, Find Contributions with inspector open, saved-card inspector states.
- **Files likely involved:** `src/main.js`, `src/styles.css`; search for `openInspector`, `renderScoreDiagnostics`, `renderContributionBrief`, `renderActionPlan`, `renderIssueDescription`, `inspector-save-issue-btn`, and drawer close/bind logic.
- **Implementation:** Refactor `openInspector(issue)` so it renders three tabs. Keep the drawer shell and sticky header, but move content into deliberate decision layers.

  Required tab structure:

  ```text
  Overview
  - Verdict
  - Match strength label
  - Confidence
  - First Move
  - Top 3 reasons
  - Top risk
  - Primary actions: Save/View on board, Hide, Open on GitHub

  Evidence
  - Exact numeric score
  - Why this score? +/- factors
  - Mini-scores
  - Confidence caps
  - Comments inspected
  - Advanced context

  Action
  - Action plan checklist
  - Full issue description
  - Setup / README / CONTRIBUTING hints
  - GitHub link
  - Board transition actions
  ```

  Vanilla JS sketch:

  ```js
  const INSPECTOR_TABS = ['overview', 'evidence', 'action'];

  function openInspector(issue) {
    const panel = document.querySelector('#issue-inspector');
    if (!panel) return;

    const activeTab = 'overview';
    panel.innerHTML = renderInspectorShell(issue, activeTab);
    panel.style.display = 'flex';
    requestAnimationFrame(() => panel.classList.remove('translate-x-full'));

    bindInspectorTabs(panel, issue);
    bindInspectorActions(panel, issue);
    runInspectorEntryEffects(panel);
  }

  function bindInspectorTabs(panel, issue) {
    panel.querySelectorAll('[data-inspector-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.dataset.inspectorTab;
        panel.querySelector('[data-inspector-body]').innerHTML = renderInspectorTab(issue, tab);
        updateInspectorTabState(panel, tab);
      });
    });
  }
  ```

  Use Impeccable after the tab split, not before. The prompt should be narrow: polish the drawer hierarchy, reduce nested cards, preserve the current dark/purple visual language, and keep `First Move` visible above the fold.
- **Acceptance criteria:** Opening an issue shows a complete decision summary without scrolling at a 1440px desktop width. Raw issue description is not visible on the default tab. The user can save/view on board, hide, open GitHub, or pass from the top section. Score diagnostics remain available, but only in `Evidence`. Drawer tabs are keyboard reachable, have visible focus states, and Escape closes the drawer.

### Critical — Fix local-state consistency across Dashboard, Board, Profile, Settings, cards, and inspector
- **Problem:** The screenshots show state drift: a saved card can exist on Board and in learned feedback while Dashboard/Profile counters still show zero. Even when this is caused by screenshot timing, the app needs one canonical local-state summary. Count drift makes users doubt whether saves, hides, and completed work are real.
- **Screen(s) affected:** Dashboard, Find Contributions cards, Inspector, Board, Profile, Activity, Settings hidden results, import/export.
- **Files likely involved:** `src/main.js`, `src/store.js`, `src/storage.js`, `src/localStore.js`, or whatever file currently owns localStorage reads/writes. Add `src/appMetrics.js` if there is no existing selector module.
- **Implementation:** Add a shared metrics helper and use it everywhere instead of recomputing counts per screen. Keep localStorage keys and export/import schema compatible.

  Suggested helper:

  ```js
  const ACTIVE_BOARD_STATES = ['considering', 'read-docs', 'asked-maintainer', 'working', 'pr-open'];
  const DONE_BOARD_STATES = ['merged', 'passed'];

  export function summarizeAppMetrics({
    boardCards = [],
    hiddenIssues = [],
    hiddenRepos = [],
    proofEntries = [],
    reviewReminders = [],
  } = {}) {
    const activeBoardWork = boardCards.filter((card) => ACTIVE_BOARD_STATES.includes(card.status)).length;
    const resolvedOrPassed = boardCards.filter((card) => DONE_BOARD_STATES.includes(card.status)).length;

    return {
      savedCandidates: boardCards.length,
      activeBoardWork,
      resolvedOrPassed,
      hiddenIssues: hiddenIssues.length,
      hiddenRepos: hiddenRepos.length,
      hiddenResults: hiddenIssues.length + hiddenRepos.length,
      proofLogEntries: proofEntries.length,
      reviewReminders: reviewReminders.length,
    };
  }
  ```

  Use this helper in `renderDashboard`, `renderProfile`, `renderSettings`, `renderBoard`, card button state, and inspector action state. After save/hide/move/import/clear actions, re-render affected regions or dispatch a small custom event such as `app:local-state-changed`.
- **Acceptance criteria:** Saving one issue updates result card state, inspector state, Board lane count, Dashboard saved candidates, and Profile saved candidates without a full refresh. Hiding one issue updates Settings hidden issue count and Dashboard hidden result count. Import/export round-trips counts. Tests cover save, hide, unhide, move, merge, pass, clear board, clear hidden items, and clear all app data.

### High — Compress issue cards and switch to strength-first score language
- **Problem:** Search cards are badge walls. GitHub labels, `100% Match`, `Fit`, `Confidence`, state badges, stars, forks, comments, assignee state, and action buttons all compete at the same level. Also, raw 99–100% match labels imply false precision and make many cards look equally perfect.
- **Screen(s) affected:** Find Contributions result list/grid, saved-card states, Dashboard saved candidates, Board cards, inspector background cards.
- **Files likely involved:** `src/main.js`, `src/styles.css`; add `src/matchScore.js` if there is no existing scoring presentation helper. Search for `renderIssueCardsList`, `fitObj.score`, `Confidence:`, `Fit:`, `good first issue`, `help wanted`, and card action templates.
- **Implementation:** Make cards decision units, not metadata dumps. Default card hierarchy should be: repository + issue number, title, one-line summary, one top reason, match strength, confidence, quiet metadata, actions.

  Add a score-presentation helper:

  ```js
  export function getMatchStrength(score) {
    if (score >= 90) return { label: 'Strong match', tone: 'strong' };
    if (score >= 75) return { label: 'Good match', tone: 'good' };
    if (score >= 55) return { label: 'Possible match', tone: 'possible' };
    return { label: 'Skip', tone: 'skip' };
  }

  export function renderMatchChip(score, { showExact = false, animate = false } = {}) {
    const strength = getMatchStrength(score);
    const text = showExact ? `${score}% Match` : strength.label;
    return `<span class="score-chip score-chip--${strength.tone}" data-score-value="${score}" ${animate ? 'data-animate-score="true"' : ''}>${text}</span>`;
  }
  ```

  Card rules:
  - Show at most two primary chips by default: match strength and confidence.
  - Show only one meaningful GitHub label if it strongly explains the candidate, such as `good first issue` or `help wanted`.
  - Collapse the rest behind `+N labels` or move them to inspector Evidence.
  - Move stars/forks/comments/assignee into a lower-contrast metadata row.
  - Use exact numeric score on cards only in `title`, `aria-label`, or inspector Evidence; do not let `99%`/`100%` dominate cards.
- **Acceptance criteria:** Default result cards show no more than two prominent chips. Raw percentages are not the main card label. Cards remain scannable after scrolling. Exact score is still available in inspector Evidence and in `data-score-value` for controlled animation/diagnostics. Users can distinguish “high score” from “safe to start.”

### High — Simplify Find Contributions search, filter, and result architecture
- **Problem:** Find Contributions has too much chrome before the first result: page title, tabs, search input, GitHub query preview, quick-preset buttons, filter rail, sort, and result count. The user’s eye should land on the search box and then the results, not on five separate control rows.
- **Screen(s) affected:** Find Contributions, global top bar, filter sidebar, result toolbar.
- **Files likely involved:** `src/main.js`, `src/styles.css`; search for `Find your next contribution`, `GitHub Query Preview`, `Starter Picks`, `Deep Dives`, `Documentation Only`, `Low Noise`, `Apply Filters`, and `Sort by`.
- **Implementation:** Keep one primary search input on the page. On the Find Contributions route, demote or hide the global top search to avoid duplicate search affordances. Move preset buttons into the filter rail under `Quick filters`. Collapse GitHub Query Preview behind a `View GitHub query` disclosure in the result toolbar. Add active filter chips above results with individual remove controls and a `Reset filters` action when filters are dirty.

  Target layout:

  ```text
  [Find your next contribution]
  [Search issues, labels, or repositories..................][Search]

  [24 open issues] [good first issue ×] [bug ×] [Reset]       [Sort]
  [Filter rail with Quick filters] [Result cards]
  ```

  Use Superpower to save a repeatable review prompt for this screen: verify header height, first-result position, active filter clarity, card density, and empty/error states after each Codex pass.
- **Acceptance criteria:** Results begin at least 120px higher than the current layout at desktop width. Query preview is hidden by default. Quick presets live with filters. Only one primary search field is visually dominant. Dirty filters are obvious and resettable.

### High — Add premium micro-interactions without masking structural problems
- **Problem:** The proposed premium interactions are good, but they must be restrained. A score counter, inspector stagger, and save pop will make the app feel more polished only after the inspector/card hierarchy is simplified. If added to the current dense UI without guardrails, they become motion noise.
- **Screen(s) affected:** Inspector, Find Contributions cards, Board/saved cards if they use the same save action, reduced-motion users.
- **Files likely involved:** `src/main.js`, `src/styles.css`; search for `openInspector`, `renderIssueCardsList`, `bindIssueCardListEvents`, `store.saveIssueToBoard`, and `inspector-save-issue-btn`.
- **Implementation:** Add the three micro-interactions, but with stronger production rules than the original snippet.

  **1. Inspector score counter**

  Use `data-score-value` for exact score values and `data-animate-score="true"` only on the inspector score element that should animate. Do not animate every score chip on the page. Use `requestAnimationFrame`, guard against repeated enrichment re-renders, and respect `prefers-reduced-motion`.

  ```js
  function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  function animateScoreCounter(el) {
    if (!el || prefersReducedMotion() || el.dataset.scoreAnimated === 'true') return;

    const target = Number.parseInt(el.dataset.scoreValue, 10);
    if (!Number.isFinite(target)) return;

    el.dataset.scoreAnimated = 'true';
    const duration = 600;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      el.textContent = `${value}% Match`;

      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = `${target}% Match`;
    }

    requestAnimationFrame(tick);
  }

  function runInspectorEntryEffects(panel) {
    window.setTimeout(() => {
      animateScoreCounter(panel.querySelector('[data-animate-score="true"][data-score-value]'));
    }, 20);
  }
  ```

  **2. Inspector content stagger**

  Add `inspector-section` only to the direct major sections inside the active tab, not every nested card. Use `nth-of-type` or explicit delay variables so DOM wrappers do not break the timing.

  ```css
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .inspector-section {
    opacity: 0;
    animation: fadeSlideUp 0.3s ease-out forwards;
    animation-delay: var(--inspector-section-delay, 0ms);
  }

  @media (prefers-reduced-motion: reduce) {
    .inspector-section {
      opacity: 1;
      transform: none;
      animation: none;
    }
  }
  ```

  In `openInspector()` / `renderInspectorTab()`, apply delays inline or through utility classes:

  ```html
  <section class="inspector-section" style="--inspector-section-delay: 50ms">...</section>
  <section class="inspector-section" style="--inspector-section-delay: 100ms">...</section>
  <section class="inspector-section" style="--inspector-section-delay: 150ms">...</section>
  ```

  **3. Save button pop**

  Use the pop only after a successful save. Apply it to both card save buttons and the inspector save button.

  ```css
  @keyframes savePop {
    0% { transform: scale(1); }
    40% { transform: scale(0.92); }
    70% { transform: scale(1.06); }
    100% { transform: scale(1); }
  }

  .save-pop {
    animation: savePop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .save-pop { animation: none; }
  }
  ```

  ```js
  function runSavePop(button) {
    if (!button || prefersReducedMotion()) return;
    button.classList.remove('save-pop');
    // Force restart if the same button is saved twice.
    void button.offsetWidth;
    button.classList.add('save-pop');
    button.addEventListener('animationend', () => button.classList.remove('save-pop'), { once: true });
  }
  ```

  Wire `runSavePop(btn)` after `store.saveIssueToBoard(issue)` succeeds in both `bindIssueCardListEvents()` and the inspector save handler.
- **Acceptance criteria:** Inspector score counts from 0 to target only on initial open, not on every content refresh. Inspector sections cascade once and do not animate under reduced-motion settings. Save buttons pop only after successful save. No animation breaks keyboard focus, screen-reader labeling, or strength-first card copy.

### High — Make the Board useful when it has 0–3 active cards
- **Problem:** The current Board uses a full kanban layout even when there is only one saved card. Five active columns plus two completed columns create a giant empty canvas, making the saved candidate feel less important than the empty lanes.
- **Screen(s) affected:** Board, Dashboard active-board module, saved-card movement controls.
- **Files likely involved:** `src/main.js`, `src/styles.css`; search for `renderBoard`, `Kanban`, `CONSIDERING`, `READ DOCS`, `ASKED MAINTAINER`, `WORKING`, `PR OPEN`, `MERGED`, and `PASSED`.
- **Implementation:** Add two board modes: compact for 0–3 active cards and full kanban for 4+ active cards or when the user manually expands. Compact mode should show current cards first, collapsed empty lanes, and next-stage controls directly on each card.

  Vanilla JS sketch:

  ```js
  function getBoardMode(boardCards, userMode) {
    if (userMode === 'kanban' || userMode === 'compact') return userMode;
    const activeCount = boardCards.filter((card) => ACTIVE_BOARD_STATES.includes(card.status)).length;
    return activeCount <= 3 ? 'compact' : 'kanban';
  }
  ```

  Compact board requirements:
  - Current saved cards are the visual focus.
  - Empty lanes collapse to 48–64px rows with label + count.
  - Each card exposes `Move to Read Docs`, `Move to Working`, or next logical stage.
  - Completed lanes remain compact unless they contain cards.

  Use Impeccable to polish compact board empty states after the logic is implemented. This is mostly spacing, hierarchy, and copy.
- **Acceptance criteria:** With one saved card, that card dominates the screen. Empty columns do not consume most of the viewport. Users can move a card to the next stage without opening a huge drawer. Full kanban remains available for heavier usage.

### High — Split Profile, Activity, and Settings responsibilities
- **Problem:** Profile is doing too much. It contains identity, preferences, stats, learned feedback, proof log, review reminders, and import/export-adjacent concepts. Settings also contains hidden results, import/export, token setup, and danger actions. The app needs clearer ownership.
- **Screen(s) affected:** Profile, Activity, Settings, Dashboard, sidebar navigation.
- **Files likely involved:** `src/main.js`, `src/styles.css`, any router/nav constants; search for `renderProfile`, `renderSettings`, `Proof Log`, `Review reminders`, `Learned feedback`, `Export Local Data`, and sidebar route definitions.
- **Implementation:** Add an `Activity` route/hash and sidebar nav item. Keep Profile focused on identity, contribution preferences, and high-level stats. Move proof log, review reminders, and learned feedback/personal scoring signals to Activity. Keep token setup, hidden results, import/export, and danger zone only in Settings.

  Target IA:

  ```text
  Dashboard
  Find Contributions
  Board
  Activity
    - Proof Log
    - Review Reminders
    - Personal Scoring Signals
  Profile
    - Identity
    - Contribution Preferences
    - Personal Fit Summary
  Settings
    - GitHub Token
    - Hidden Results
    - Export / Import Local Data
    - Danger Zone
  Help
  Feedback
  ```

  Rename “Learned feedback” to “Personal scoring signals” if it remains user-visible. The current label sounds like implementation internals.
- **Acceptance criteria:** Import/export appears in one place: Settings. Profile fits into one vertical screen at desktop width after preferences are saved. Proof Log and Review Reminders are not empty blocks stacked under Profile. Activity route/nav works and uses the shared metrics helper.

### Medium — Create a visual-density and interaction system in CSS
- **Problem:** The app is visually consistent, but it is still dense: many bordered boxes, small type, repeated chips, nested panels, and metadata that competes with titles. One-off tweaks will not hold unless density is encoded into reusable CSS classes.
- **Screen(s) affected:** All screens, especially Find Contributions, Inspector, Profile, Settings, and Board.
- **Files likely involved:** `src/styles.css`, `src/main.js`; search for repeated card, badge, chip, empty-state, button, and section utility patterns in template strings.
- **Implementation:** Add shared classes for page sections, compact cards, score chips, metadata rows, empty states, danger actions, focus rings, and motion utilities. Keep Tailwind utilities where they are already useful, but stop hand-rolling slightly different card/chip structures in every template string.

  Suggested CSS layer:

  ```css
  :root {
    --space-section: 1.5rem;
    --space-card: 1rem;
    --space-card-compact: 0.75rem;
    --radius-card: 0.75rem;
    --font-body: 0.875rem;
    --font-meta: 0.75rem;
    --line-body: 1.45;
  }

  .app-section + .app-section { margin-top: var(--space-section); }
  .app-card { padding: var(--space-card); border-radius: var(--radius-card); }
  .app-card--compact { padding: var(--space-card-compact); }
  .meta-row { font-size: var(--font-meta); line-height: 1.35; opacity: 0.72; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 0.375rem; }

  :focus-visible {
    outline: 2px solid var(--color-accent, #a78bfa);
    outline-offset: 2px;
  }
  ```

  Use Impeccable in two steps: first document the existing dark theme and spacing primitives, then run targeted polish on Find Contributions, Inspector, Board compact mode, and Settings danger zone. Do not ask it to redesign the whole app at once.
- **Acceptance criteria:** Shared classes own card spacing, chip layout, metadata tone, focus rings, and empty-state layout. Cards have fewer nested borders. Metadata is visually quieter than titles and actions. Screens look calmer without removing functionality.

### Medium — Clarify token persistence and redesign destructive settings actions
- **Problem:** The token copy says local session storage is default, warns about localStorage, and then labels the checkbox “Remember token locally.” That is too ambiguous. The danger zone also uses repeated red rows that make small and severe resets feel similar.
- **Screen(s) affected:** Settings GitHub token setup, Settings hidden results, Settings danger zone, Help privacy card.
- **Files likely involved:** `src/main.js`, `src/styles.css`; search for `Remember token locally`, `Local Browser Security Warning`, `Clear GitHub Token`, `Clear Board`, `Clear Hidden`, and `Clear All`.
- **Implementation:** Rename the checkbox to `Persist token in this browser`. Add helper copy: `Off: token clears when this browser session ends. On: token is stored in localStorage on this machine.` Show the red localStorage warning only when persistence is enabled, or clearly label it as applying only to persistence.

  For danger actions, replace four similar red rows with a reusable confirmation dialog. Use neutral rows until the user arms an action. Require typed confirmation for `Clear all app data`.

  Dialog sketch:

  ```js
  function openConfirmDialog({ title, body, consequences = [], requirePhrase, onConfirm }) {
    // Render modal with focus trap, Escape close, Cancel, Confirm.
    // Disable Confirm until phrase matches when requirePhrase is provided.
  }
  ```

  Consequence copy must explicitly say what is removed and what is kept.
- **Acceptance criteria:** A user can explain token storage in one sentence. The warning no longer appears to contradict default session behavior. `Clear all app data` requires typed confirmation. Smaller resets are visually distinct from full reset. Confirmation dialogs trap focus and close with Escape.

### Medium — Improve popovers, accessibility, and keyboard flow
- **Problem:** Popovers currently compete with the workflow, and keyboard behavior is not explicit enough. Dark UI polish does not matter if focus handling, Escape close, readable text size, and contrast are weak.
- **Screen(s) affected:** Header rate-limit popover, review reminders popover, Inspector drawer, Settings dialogs, cards, Board columns, Feedback form.
- **Files likely involved:** `src/main.js`, `src/styles.css`; search for header popover handlers, reminder popover handlers, drawer close handlers, modal/dialog logic, and button templates.
- **Implementation:** Add shared close behavior for drawer/popovers/dialogs. Escape closes the topmost overlay. Clicking outside closes popovers but not destructive dialogs. Focus moves into the drawer/dialog on open and returns to the trigger on close. Increase long body copy to at least 14px with 1.45 line-height; keep metadata at 12px only for short labels.

  Popover changes:
  - Rate-limit popover should answer: remaining calls, reset time, what to do if low.
  - Empty reminders popover should be compact and link to Board/Activity, not a large floating panel.
  - Popovers should not cover primary result-card actions at common desktop widths.

  Accessibility helpers:

  ```js
  function bindEscapeToClose(closeFn) {
    function onKeyDown(event) {
      if (event.key === 'Escape') closeFn();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }
  ```
- **Acceptance criteria:** All main controls are keyboard reachable. Inspector, popovers, and dialogs close with Escape. Focus returns to the trigger after close. Text-heavy cards and inspector sections remain readable at 125% browser zoom. No important action is hidden behind hover-only behavior.

### Low — Keep Help and Feedback simple, but wire them into the workflow
- **Problem:** Help and Feedback are already among the clearest screens. They should not be redesigned into heavier pages. They only need better integration with real user workflows.
- **Screen(s) affected:** Help, Feedback, inspector feedback path, sidebar footer links.
- **Files likely involved:** `src/main.js`, `src/styles.css`; search for `renderHelp`, `renderFeedback`, `Open GitHub issue`, `Feedback checklist`, and any GitHub issue URL builder.
- **Implementation:** Keep Help as four compact cards. Add a `Start with Find Contributions` CTA only for first-run users with zero saved cards. On Feedback, generate a sanitized issue body from the checklist fields plus app route, viewport, user agent, and local-state counts. Never include token values, Authorization headers, private repo metadata, or raw localStorage.

  Suggested sanitized diagnostic shape:

  ```js
  function buildFeedbackDiagnostics() {
    return {
      route: window.location.hash || window.location.pathname,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      savedCandidates: summarizeAppMetrics(readLocalState()).savedCandidates,
      hiddenResults: summarizeAppMetrics(readLocalState()).hiddenResults,
    };
  }
  ```
- **Acceptance criteria:** Help remains one compact screen. Feedback opens a prefilled GitHub issue with structured, sanitized content. The page warns users not to paste tokens or private data. CTA feedback is visible after clicking/opening.

### Low — Standardize empty states and copy across the app
- **Problem:** Several screens say “nothing yet” without explaining what creates the first item. Empty Dashboard/Profile/Board/Activity sections should guide action without stacking large blank boxes.
- **Screen(s) affected:** Dashboard, Board, Profile, Activity, Settings hidden results, Review reminders, Proof Log.
- **Files likely involved:** `src/main.js`, `src/styles.css`; add a small `renderEmptyState()` helper if none exists.
- **Implementation:** Create one compact empty-state renderer with `title`, `body`, optional `primaryAction`, optional `secondaryAction`, and `variant`. Use one large empty state per page max; secondary empty sections should be compact rows.

  Vanilla JS helper:

  ```js
  function renderEmptyState({ title, body, primaryAction, secondaryAction, variant = 'default' }) {
    return `
      <div class="empty-state empty-state--${variant}">
        <p class="empty-state__title">${escapeHtml(title)}</p>
        <p class="empty-state__body">${escapeHtml(body)}</p>
        ${primaryAction ? renderButtonLink(primaryAction) : ''}
        ${secondaryAction ? renderButtonLink(secondaryAction, 'secondary') : ''}
      </div>
    `;
  }
  ```

  Example copy:
  - Board: `Save a candidate from Find Contributions to start tracking it.`
  - Proof Log: `Move a board card to Merged to preserve completed work.`
  - Review Reminders: `Cards in Working or PR Open can generate reminders after refresh.`
- **Acceptance criteria:** No page shows more than one large empty-state box. Every empty state tells the user what action creates the first item. Empty sections use shared styling and copy patterns.

## What NOT to change
- Keep the dark theme and purple accent. They are coherent and already give the app a distinct product feel.
- Keep the score model and explainability. “Why this score?” with positive and negative factors is a differentiator; move it into a calmer Evidence layer instead of removing it.
- Keep `Contribution Brief`, especially `Verdict` and `First Move`. `First Move` is the clearest single UX element in the app.
- Keep the Action Plan checklist. It turns browsing into execution; it just belongs in a clearer Action layer.
- Keep the API rate-limit tracker. It is practical, honest, and useful for power users.
- Keep the Help page’s compact four-card structure. It is the density model for secondary pages.
- Keep local-first privacy. Board cards, hidden results, preferences, scoring signals, and proof log should stay local unless the user explicitly exports them.
- Keep the Feedback checklist concept. Improve prefill and sanitized diagnostics, but do not turn it into a heavy support form.
- Do not add dependencies for these fixes. The premium polish should be CSS + vanilla JS only.
- Do not let animations override accessibility. Respect `prefers-reduced-motion`, preserve focus, and avoid screen-reader noise from animated score text.
