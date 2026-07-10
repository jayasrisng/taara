# TaaraNight Submission Notes

## One-Line Pitch

TaaraNight is a daily Reddit constellation ritual: connect tonight's real stars, reveal a bedtime myth, and share a spoiler-safe sky card with the community.

## Demo Flow

1. Open the nightly Reddit post.
2. Tap **Easy** as the judge path.
3. Let the ghost comet trace the first connection.
4. Connect the remaining stars.
5. Pause on the hologram reveal and Latin constellation name.
6. Tap into the story reward.
7. Show Results: Jwala, community star milestone, and share buttons.
8. Open My Sky to show the long-term collection.

## Devpost Description

Every night, TaaraNight gives a subreddit one shared sky. Players trace between real catalogued stars to reveal a constellation, then unlock a calm original myth. The daily puzzle is deterministic and spoiler-safe: everyone gets the same constellation, but share cards only show effort, mood, and streak. That makes it feel native to Reddit: a daily post, comments, shareable results, soft competition, and a community milestone as everyone lights the same sky together.

Under the hood, TaaraNight uses Phaser for a custom starfield, one-stroke tracing, hologram reveal, and a continuous My Sky chart. Devvit Redis stores results, Jwala streaks, leaderboards, post-night mappings, and collected constellations. The server owns identity and nightly state, so archive posts open their original sky and share text is composed server-side.

## Trailer Script

**0-5s:** "Every evening, Reddit gets one shared sky." Show the TaaraNight wordmark and the nightly moon.

**5-12s:** "Connect real stars. Avoid Glitches. Spend Whispers only if you need them." Show star tracing and a glowing connection.

**12-20s:** "Reveal a constellation. Unlock a bedtime myth." Show the hologram reveal and story card.

**20-28s:** "Keep your Jwala burning. Gather every sky." Show Results and My Sky collection.

**28-35s:** "Share the night without spoiling it." Show spoiler-safe share card and community milestone.

**35-42s:** "TaaraNight. One night. One constellation. One story." End on the logo and call to play.

## Release Checklist

- Run `npm run type-check`
- Run `npm run lint`
- Run `npm run test`
- Run `npm run build`
- Run `npm run trailer`
- Verify `npm run dev` on real Reddit
- Solve Easy on desktop and phone
- Solve one dense constellation on phone
- Test signed-in result recording
- Test signed-out play
- Test share comment
- Test share-as-post
- Test My Sky pinch and tap-to-story
- Test audio and read-aloud in Reddit webview
- Confirm nightly post creation or manual menu action
