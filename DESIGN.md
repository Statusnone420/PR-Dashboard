---
name: "PR Dashboard"
description: "Local-first GitHub issue finder for contributor decision confidence."
colors:
  primary: "#a78bfa"
  primary-container: "#7c3aed"
  on-primary: "#0a0012"
  on-primary-container: "#ede9fe"
  tertiary: "#34d399"
  tertiary-container: "#065f46"
  on-tertiary-container: "#bbf7d0"
  background: "#09090b"
  surface: "#0c0c0f"
  surface-container-lowest: "#09090b"
  surface-container-low: "#0f0f12"
  surface-container: "#121215"
  surface-container-high: "#18181b"
  surface-container-highest: "#1e1e22"
  surface-variant: "#18181b"
  on-background: "#fafafa"
  on-surface: "#fafafa"
  on-surface-variant: "#a1a1aa"
  outline: "#52525b"
  outline-variant: "#27272a"
  error: "#ef4444"
  error-container: "#3b1111"
  on-error-container: "#fca5a5"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.04em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-secondary:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-danger:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.error}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  chip:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  card:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: PR Dashboard

## Overview

**Creative North Star: "The Contributor Workbench"**

PR Dashboard is a dense product UI for contributors making practical decisions under uncertainty. It should feel like a focused workbench: dark, quiet, information-rich, and explicit about evidence. The interface earns trust by showing fit signals, risks, local workflow state, and privacy boundaries without turning the experience into a tutorial.

The current visual system is a high-contrast dark product surface built from near-black layers, thin borders, Geist typography, violet primary actions, emerald success states, and red errors. This file documents that current system so future agents stay aligned while making changes. It is not a redesign pass.

The system must not become a GitHub visual replica, and it must not look like a generic Shadcn/Vercel observability tool. The current Zinc-on-Violet dark-mode dev aesthetic is a known trap. Future refinement should preserve the workflow clarity while giving PR Dashboard a more specific contributor-decision identity.

**Key Characteristics:**

- Dense product surfaces for scanning, comparison, and repeated action.
- Flat-by-default layering with borders and tonal surfaces instead of decorative depth.
- Restrained semantic color: violet for action and selection, emerald for positive state, red for error or pass risk.
- Copy that is precise, candid, and useful.
- Local-first trust patterns that keep token and storage boundaries visible.

## Colors

The current palette is a restrained dark product system: near-black neutral layers, one violet primary action color, emerald positive state, and red error state.

The same color tokens are currently duplicated across `tailwind.config.js` and `:root` in `src/styles.css`. Treat the CSS custom properties and Tailwind entries as parallel records of the same system for now. A single-source token migration is pending and should be handled separately from this documentation.

### Primary

- **Workbench Violet** (`primary`, `#a78bfa`): primary actions, active navigation, focus rings, selected states, and important affordance hover states.
- **Deep Violet Container** (`primary-container`, `#7c3aed`): stronger primary hover and selected surfaces.
- **Violet Text Pairing** (`on-primary`, `#0a0012`; `on-primary-container`, `#ede9fe`): readable text on violet surfaces.

### Tertiary

- **Completion Emerald** (`tertiary`, `#34d399`): success, strong candidate signals, active work, resolved states, and positive progress.
- **Emerald Container** (`tertiary-container`, `#065f46`; `on-tertiary-container`, `#bbf7d0`): positive chips and low-emphasis success backgrounds.

### Error

- **Caution Red** (`error`, `#ef4444`): destructive actions, failed checks, closed-risk states, and caution signals.
- **Red Container** (`error-container`, `#3b1111`; `on-error-container`, `#fca5a5`): error chips, risk callouts, and low-emphasis destructive surfaces.

### Neutral

- **Workbench Black** (`background`, `#09090b`): page background and deepest surfaces.
- **Drawer Black** (`surface`, `#0c0c0f`): shell surfaces and inspector base.
- **Layered Zinc Surfaces** (`surface-container-lowest` through `surface-container-highest`, `#09090b` to `#1e1e22`): cards, controls, sidebars, rows, and hover states.
- **Primary Text** (`on-background`, `on-surface`, `#fafafa`): main text and labels that must scan quickly.
- **Muted Text** (`on-surface-variant`, `#a1a1aa`): secondary context, metadata, helper copy, and subdued labels.
- **Structural Borders** (`outline`, `#52525b`; `outline-variant`, `#27272a`): panel boundaries, card borders, input borders, and dividers.

### Named Rules

**The Evidence Color Rule.** Color must explain state, action, or evidence. Do not use violet, emerald, or red as decoration.

**The Trap Naming Rule.** Do not let "dark dev tool" become the design rationale. The Zinc-on-Violet palette is the current implementation, not the product identity.

## Typography

**Display Font:** Geist, system-ui, sans-serif

**Body Font:** Geist, system-ui, sans-serif

**Label/Mono Font:** Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace

**Character:** Typography is practical and compact. One sans family carries the interface, while the mono stack is reserved for issue keys, scores, repository references, numbers, and compact technical metadata.

### Hierarchy

- **Display** (700, about `2rem`, line-height `1.1`): route heroes and high-level empty or onboarding moments. Use sparingly in the product shell.
- **Headline** (700, about `1.5rem`, line-height `1.15`): drawer titles, page titles, and major panel headings.
- **Title** (700, about `1rem`, line-height `1.25`): cards, sections, inspector modules, and compact summaries.
- **Body** (400, about `0.875rem`, line-height `1.5`): product copy, issue summaries, field help, and explanatory text. Keep prose to 65 to 75 characters per line when it is not tabular or card metadata.
- **Label** (600, about `0.75rem`, letter-spacing up to `0.04em`): control labels, section labels, dense status labels, and uppercase micro-headings.
- **Mono** (500, about `0.75rem`): issue references, score deltas, API buckets, repository names, and other data that benefits from fixed-width rhythm.

### Named Rules

**The Product Type Rule.** Do not introduce display fonts into controls, labels, cards, or data-heavy surfaces. Product legibility wins over typographic novelty.

**The Candid Copy Rule.** Favor concrete product language such as "Local Session Storage by Default", "no private scopes needed", and "Save candidates from Find Contributions to see them on your Dashboard." Avoid hype, magic, and vague motivation.

## Elevation

PR Dashboard is flat by default. Depth is conveyed primarily through tonal surface changes, 1px borders, sticky chrome, and occasional shadows on overlays. Cards and panels should not appear to float unless they are modal, popover, or inspector surfaces that genuinely overlap other content.

### Shadow Vocabulary

- **Focus Ring** (`0 0 0 2px rgba(167, 139, 250, 0.28)`): keyboard focus and focused form controls.
- **Popover Shadow** (`0 20px 50px rgba(0, 0, 0, 0.45)`): API limits popover and other elevated overlays.
- **Inspector Edge Shadow** (`-10px 0 30px -15px rgba(0, 0, 0, 0.8)`): right-side inspector drawer boundary.
- **Tooltip Shadow** (`0 12px 28px rgba(0, 0, 0, 0.38)`): compact tooltip overlays.

### Named Rules

**The Border-First Rule.** Use tonal layers and 1px borders for most hierarchy. Shadows are for overlays, focus, and true spatial overlap.

**The No Fake Glass Rule.** Backdrop blur and glass-like treatment must be rare and purposeful. Do not use glassmorphism as a default card or panel style.

## Components

### Buttons

Buttons are compact, familiar product controls with an 8px radius, medium weight text, and direct state feedback.

- **Shape:** Gently rounded rectangle (`8px`) for standard buttons; circle or square icon buttons only where the icon control is obvious and named.
- **Primary:** Workbench Violet background with dark text. Use for the main next action in a local context, such as saving, searching, or opening the primary workflow.
- **Secondary:** Surface container background, muted text, structural border. Use for neutral actions, settings, refresh, inspect, and navigation-adjacent commands.
- **Danger:** Red text and red container treatment for destructive or risk-confirming actions.
- **Hover / Focus:** Hover shifts border and surface tone. Focus uses a visible violet outline with offset. Disabled state reduces opacity and removes motion.

### Icon Buttons

Icon buttons are common in the header, inspector, Board, and Settings. Every icon-only button must have an accessible name via `aria-label` or visible text. Decorative icon spans inside named buttons should be hidden from assistive technology.

- **Shape:** 32px current header controls, with 44px preferred for touch-heavy future passes.
- **State:** Hover shifts to the next surface tier and violet text. Focus must remain visible without depending on hover.
- **Accessibility:** Do not let Material Symbols glyph names become accessible text. The canonical pattern is a named button plus `aria-hidden="true"` on the decorative icon.

### Chips

Chips are compact evidence and filter tokens.

- **Style:** Rounded pill or small rounded rectangle, 1px border, surface or semantic-tint background.
- **State:** Selected chips may use violet fill or semantic tint. Passive chips should stay quiet and not compete with primary buttons.
- **Content:** Fit score, confidence, issue labels, filters, pass reasons, and review-flow summaries.

### Cards / Containers

Cards are work surfaces, not decoration.

- **Corner Style:** 8px radius for standard cards; 12px only for larger grouped panels already using that shape.
- **Background:** `surface-container` for cards, `surface-container-lowest` for deeply inset lanes and rows, `surface-container-high` for hover or active states.
- **Shadow Strategy:** Flat at rest. Use borders for structure.
- **Border:** 1px `outline-variant` by default, stronger border only for hover, focus, semantic status, or selected state.
- **Internal Padding:** 12px to 24px depending on density and screen size.

### Inputs / Fields

Fields use the same surface language as cards so forms feel integrated with the product shell.

- **Style:** Surface container fill, outline-variant border, 8px radius, compact padding.
- **Focus:** Violet border plus visible focus ring. Placeholder text uses muted on-surface color.
- **Security Fields:** Token controls should keep trust copy close to the input and must not imply token export or backend storage.

### Navigation

Navigation uses predictable product patterns: fixed side nav on desktop, top shell, mobile drawer, active tab state, and route-specific content below.

- **Default:** Muted text on dark surface.
- **Hover:** Slight surface lift and brighter text.
- **Active:** Higher surface tier with violet text.
- **Mobile:** Drawer preserves the same route vocabulary, with navigation controls sized and named clearly.

### Inspector and Board Surfaces

The inspector is the densest evidence surface. It should keep title, Action Center, alerts, advanced context, contribution brief, score evidence, issue body, and action plan in a readable sequence.

The Board is a workflow tracker. Active lanes, compact cards, completed lanes, and refresh controls should prioritize state recognition and action clarity over decorative layout.

### Tooltips

Tooltips are compact labels for icon and dense controls. They should reinforce accessible names, not replace them.

- **Style:** Small surface-container-highest overlay, 1px border, tight padding, centered text.
- **Behavior:** Hover and focus-visible reveal. Future hardening should handle escape behavior and wrapping better.

## Do's and Don'ts

### Do:

- **Do** document and preserve local-first trust boundaries. Token, export/import, Proof Log, and browser storage copy must stay concrete.
- **Do** make score, confidence, risk, and next action visible enough for users to trust or challenge the recommendation.
- **Do** use standard product affordances for navigation, filters, forms, drawers, cards, popovers, and buttons.
- **Do** use semantic color for evidence, action, warning, success, and error.
- **Do** give icon-only controls accessible names and hide decorative icons from assistive technology.
- **Do** keep dense screens scannable through consistent spacing, clear grouping, and low-noise labels.

### Don't:

- **Don't** become a GitHub visual replica.
- **Don't** look like a generic Shadcn/Vercel observability tool.
- **Don't** treat the Zinc-on-Violet dark-mode dev aesthetic as the goal.
- **Don't** gamify contribution work with streaks, badges, confetti, leaderboards, or point-like reward language.
- **Don't** imply backend trust guarantees, live sync, OAuth, encrypted sync, or remote merge verification that v1 does not provide.
- **Don't** use glassmorphism, gradient text, side-stripe borders, identical card grids, or hero-metric templates as default patterns.
- **Don't** rely on color alone for score, confidence, risk, success, warning, or error states.
