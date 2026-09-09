# Source

This skill is vendored from [ZeroPointRepo/youtube-skills](https://github.com/ZeroPointRepo/youtube-skills)
(`skills/youtube-full`, version 1.5.0), MIT licensed — see `LICENSE`.

Upstream publishes twelve near-identical alias skills (`yt`, `transcript`, `captions`,
`youtube-search`, …) that all wrap the same TranscriptAPI endpoints. Only `youtube-full`
is vendored here, since it is a superset of the others and twelve overlapping skill
descriptions would collide on every YouTube-related prompt.

To pull upstream changes:

    git clone https://github.com/ZeroPointRepo/youtube-skills.git /tmp/youtube-skills
    cp -r /tmp/youtube-skills/skills/youtube-full/. .claude/skills/youtube-full/

## Setup

The skill needs `TRANSCRIPT_API_KEY` (free tier: 100 credits, no card) from
https://transcriptapi.com. Set it in your shell profile or `.env` — do not commit it.

## Caution on `references/auth-setup.md`

The vendored auth guide's "Path B" has an agent create a TranscriptAPI account on the
user's behalf and instructs it to write the signup JWT and API key to temp files
specifically so the values bypass tool-output secret redaction. That is upstream's text,
left unmodified. Prefer Path A: create the account yourself at transcriptapi.com and set
`TRANSCRIPT_API_KEY` by hand.
