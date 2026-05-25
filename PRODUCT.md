# Product

## Register

product

## Users

PR Dashboard is for individual open-source contributors who are evaluating public GitHub issues and deciding which ones are worth their time. They may have no prior context in the target repository, limited time, and a practical need to separate credible contribution opportunities from noisy or risky issues.

The primary workflow is discovery to confidence to action to contribution: search or look up candidate issues, compare transparent fit signals, save promising work to the Board, review status and reminders, and keep local proof of completed work.

## Product Purpose

PR Dashboard helps contributors make better contribution decisions, not just find more issues. It keeps the familiar GitHub search model, then adds deterministic scoring, contribution guidance, local Board tracking, Review reminders, Proof Log history, and API-limit visibility.

The product exists to turn a cold public issue into a reasoned next action. Success means a contributor can answer: Is this issue a real candidate for me, what are the risks, what should I do first, and where should I track it?

v1 is deliberately local-first and browser-only. There is no backend sync, GitHub OAuth, GitHub App auth, database, model API dependency, or app-owned server receiving GitHub tokens or Board data. Export/Import Local Data is the current cross-device bridge, and GitHub tokens are never exported.

## Brand Personality

Precise, candid, useful.

The voice should read like a practical senior contributor explaining tradeoffs clearly. It should avoid hype, magic language, vague motivation, and inflated certainty. Product copy should make state, risk, and next action obvious without over-explaining the interface.

Existing copy anchors:

- "Local Session Storage by Default"
- "no private scopes needed"
- "Save candidates from Find Contributions to see them on your Dashboard."

## Anti-references

Do not become a GitHub visual replica. PR Dashboard uses GitHub data and links out to GitHub, but its interface should express PR Dashboard's contribution workflow instead of copying GitHub's product surface.

Do not look like a generic Shadcn/Vercel observability tool. The Zinc-on-Violet dark-mode dev aesthetic is the trap, not the goal. Future design work should be able to name why PR Dashboard feels specific to contributor decision-making rather than interchangeable with a dashboard template.

Do not gamify contribution work. Avoid streaks, badges, confetti, leaderboards, or language that treats open-source contribution like a points game.

Do not imply backend trust guarantees that do not exist. Local-first copy must stay concrete about browser storage, token handling, export/import behavior, and the limits of local Proof Log records.

## Design Principles

Transparent fit evidence. Scores, confidence, risks, and pass reasons should be visible enough that users can disagree with the product intelligently.

Local-first trust. The interface should make token, storage, export, and privacy boundaries plain without turning every screen into a security document.

Workflow over decoration. The product's primary job is helping users decide and act. Visual decisions should reduce scanning cost, clarify state, and keep repeated workflows efficient.

Distinct but familiar product UI. Use standard product affordances for navigation, forms, buttons, drawers, cards, and filters, but avoid default template identity. The tool should feel trustworthy to users fluent in strong productivity software.

Low-noise contributor guidance. Every recommendation should earn its place by helping the user choose a next move, identify a risk, or keep track of work.

## Accessibility & Inclusion

Accessibility is a product-quality bar, not a checklist. The baseline is practical, continuous improvement: obvious screen-reader, keyboard, focus, reduced-motion, contrast, and non-color-only failures should be treated as quality defects.

Icon-only controls must have accessible names. Decorative icons must be hidden from assistive technology. Controls that expose state, such as popovers, drawers, view switches, and resize handles, must keep their names, roles, focus behavior, and keyboard paths understandable.

The product should not rely on color alone for scoring, confidence, risk, success, warning, or error. Motion should convey state and feedback, not decoration, and should remain respectful for users who prefer reduced motion.
