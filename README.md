# CBC @ NJIT

The member-facing Claude Builder Club assistant for NJIT, deployed at https://www.claudenjit.com.

Next.js 16, React 19, TypeScript, the Anthropic SDK, and Zustand. Claude responses stream over server-sent events; the client smooths incoming text and shows a thinking indicator while waiting. The dark interface includes local-time greetings, image attachments, and copying replies.

## Development

Use Node.js 22.6 or newer.

```sh
npm install
```

Create a local `.env.local` file:

```sh
ANTHROPIC_API_KEY=your-api-key-here
# Optional override; the default is claude-sonnet-4-6.
ANTHROPIC_MODEL=claude-sonnet-4-6
# Optional override for the prompt screen; the default is claude-haiku-5-5.
ANTHROPIC_SCREEN_MODEL=claude-haiku-5-5
```

```sh
npm run dev
npm run build
npm run start
npm run lint
npm test
```

The chat route uses the Node.js runtime with a 60-second maximum duration. Configure the API key in Vercel for deployments; never commit environment files or credentials.

## Club facts and response quality

- E-board: Donovan McHenry (President), Walter Zhong (Vice President), Dhruva Lepakshi (Marketing Manager).
- Planned event: Spring 2027 hackathon. Date, location, registration, rules, prizes, and schedule are not confirmed.
- No specific meeting or workshop dates are currently confirmed in the site's context.
- Member-facing program guidance is curated separately from private ambassador materials.

Read [the context maintenance guide](docs/club-context.md) before changing club facts or prompt behavior. The approved data is in `src/data/club-context.json` and `src/data/eboard.json`. The system prompt and tools use the same source data. Context is dated and explicitly treated as last confirmed after 90 days without a review.

The assistant's tools read maintained club information. They do not browse live announcements, access private documents, register members, or inspect credit balances. There is no live calendar or social-media sync.

For live response evaluation:

```sh
npm run eval:chat -- https://www.claudenjit.com
```

This sends thirteen chat requests, spaced to stay under the rate limit. All but the gibberish check reach Claude (a Haiku screen, then the main model), so the run consumes API credits. Review both the checks and the actual reply text. The suite covers current leadership, unconfirmed event details, member benefits, private-program questions, conflicting chat history, and natural response style.

## Abuse limits

`src/lib/chat-guard.ts` runs before the main model:

- Code-only checks cost no tokens: at most 10 requests per minute and 100 per hour per IP, a 4,000-character message limit, at most 4 images under 5 MB each, and history trimmed to the last 30 messages or 40,000 characters. Obvious gibberish gets a fixed reply.
- The latest message is then screened by `claude-haiku-5-5` (override with `ANTHROPIC_SCREEN_MODEL`) for gibberish and requests for long, unrelated output. If the screen fails, the message is allowed.
- Replies are capped at 2,048 output tokens.

Rate limits are kept in memory, so each server instance counts separately and the counts reset on cold starts. Use a shared store if stricter limits are needed.

## Existing club channels

- Email: njitclaudebuilderclub@gmail.com
- Discord: https://discord.gg/Z36MRK6jnS
- Instagram: https://www.instagram.com/claudenjit/
- GitHub: https://github.com/NJIT-Claude-Builder-Club
