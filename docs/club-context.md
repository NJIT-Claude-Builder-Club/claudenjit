# Member-facing assistant context

The site serves club members. It does not provide access to ambassador operations or original program documents.

## Maintained facts

- `src/data/eboard.json`: the roster and titles confirmed by Donovan on October 14, 2026.
- `src/data/club-context.json`: reviewed member-facing club facts, existing public contact channels, limited program-benefit guidance, and event confirmation status.
- `src/lib/chat-policy.ts`: grounding, privacy, date handling, tone, and examples. The system context and information tools use the same data files.

Only a Spring 2027 hackathon is currently planned. No meeting or workshop dates, hackathon venue, registration link, rules, prizes, or schedule have been confirmed. Empty lists mean no confirmed information is stored, not that activities have been cancelled.

The 2026-2027 onboarding materials and program FAQs were reviewed privately. Only member-facing paraphrases about inclusive membership, learning, and member API-credit eligibility/setup were included. The October 29, 2026 Claude Code workshop confirmed that members can get Claude Pro through meeting attendance and the meeting check-in form; only a member-facing paraphrase is stored, not the slides, QR codes, or forms. Program-wide plans are not NJIT event announcements. Private program operations, pay, budgets, staff contacts, reporting requirements, ambassador resources, private forms, and original source files must stay out of the repository, deployed assets, system context, and tool results.

The original documents are deliberately not loaded at runtime. Prompts alone are not a reliable way to keep confidential source material private.

## Updating context

1. Confirm the change with club leadership or an approved member announcement.
2. Update the narrowest data file. Keep unconfirmed values null; do not infer dates or perks from older events or internal program templates.
3. Update `reviewedOn` only after reviewing the current facts, not on every build. When only one benefit is re-confirmed, record it on that benefit (for example `claudePro.confirmedOn`) instead of moving the global date. The prompt labels information as last confirmed after 90 days without a review.
4. Keep member benefits conditional on eligibility and processing. API credits and Claude Pro are separate benefits: Pro comes through meeting attendance and check-in, and API credits do not activate it. The site cannot check accounts or submit credit requests.
5. Run `npm test`, type checking, and a production build. Evaluate representative model replies after a prompt or context change.

This is maintained context, not a live Discord, Instagram, calendar, or web-search integration. No automatic claim of freshness should be made.

## Evaluation

`npm test` checks roster consistency, missing event details, member-benefit distinctions, public-data boundaries, freshness behavior, and the existing streaming/presentation regressions.

For a running app, run `npm run eval:chat -- <app URL>`. This sends fourteen chat requests; all but the gibberish check reach Claude (a Haiku screen, then the main model), so it consumes API credits. It checks leadership, unknown event details, benefits, private-program questions, attempts to replace approved facts, stale chat history, and response style. Review the actual answers as well as the checks; passing regex assertions is not proof of universal model reliability.

Tone: answer directly in natural sentences, use contractions, and keep simple questions brief. No emojis, em dashes, generic praise, canned enthusiasm, or promotional sign-offs. General project help is allowed, but suggestions must not become invented club policy.

Prompt design references: [Anthropic prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) and [reducing hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations).
