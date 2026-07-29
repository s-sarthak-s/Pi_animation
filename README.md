# Pi Animation

A little pixel **π** that lives at the bottom of your [Pi](https://github.com/earendil-works/pi) terminal, greets you by name, and does a different cute animation every time the agent is working — plus a status readout that actually tells you something useful.

![the mascot cycling through its routines](demo.gif)

If we're honest, a lot of us now spend more of the day watching Pi think than typing code ourselves. This just makes that time a bit nicer to look at — and sneaks in a few genuinely handy readouts while it's there.

## What's in the box

- **A pixel π mascot** rendered with truecolor half-blocks (so it's still just text — it works inside Pi's TUI, no image support needed). It sits idle when nothing's happening and breaks into a random routine while the agent works: walk, dance, gym curls, basketball dribble, flag wave, confetti, jump, think, cheer, sleep, spin — twelve in all, picked at random so you rarely see the same one twice.
- **A "Hello NAME" greeting** in big block letters when you open a fresh session, cleared the moment you send your first message.
- **An effort meter** — a live bar of your current thinking level (`off → max`), colored from the active theme.
- **A context bar** — how full your context window is, right now, as a bar plus a percentage. Cyan when you're fine, amber past 70%, red past 85%.
- **A compaction counter** — how many times the session has auto-compacted, so you know when the conversation is getting long and it might be time to start fresh.
- **Smart, model-aware auto-compaction** — compaction that triggers at a percentage of *whatever model you're on*, instead of a fixed token count that means different things on a 200k vs a 1M window.
- **A synthwave theme** to tie it together.
- **A web version** (`web/pi-mascot.html`) — the same character rebuilt as smooth SVG + GSAP for the browser, if you want the polished vector version outside the terminal.

## The status line, up close

```
▄▄π▄▄
█π█   effort ▮▮▮▮▮▯▯ high
██    ctx    ▮▮▯▯▯▯▯▯▯▯ 19%
█ █   ⟳ compacted ×0
```

The mascot's eyes even drift toward the context bar as it fills up — a small touch, but it makes the whole thing feel alive.

## Install

These are [Pi extensions](https://github.com/earendil-works/pi), so they drop straight into your Pi config.

```bash
# copy the pieces into your Pi agent directory
cp extensions/*.ts   ~/.pi/agent/extensions/
cp themes/*.json     ~/.pi/agent/themes/
```

Then in `~/.pi/agent/settings.json` set the theme and make sure the built-in compaction stays on as a safety net:

```json
{
  "theme": "synthwave",
  "compaction": { "enabled": true, "reserveTokens": 16384, "keepRecentTokens": 20000 }
}
```

Reload Pi (`/reload`) and you're set.

### Make it say your name

The greeting uses `$PI_MASCOT_NAME` if set, otherwise the first name from `$USER`, otherwise a friendly "there". To pin it:

```bash
export PI_MASCOT_NAME=Ada
```

## Commands

| Command | What it does |
|---------|--------------|
| `/mascot` | Toggle the greeting + mascot on/off |
| `/fx` | Toggle the custom footer (dir · branch · ctx% · cost · model) |
| `/compact-at 85` | Set the auto-compaction threshold to any percent (10–99) |

## The web version

`web/pi-mascot.html` is a standalone page — open it in any browser. It's the same π rebuilt from `<rect>`s and animated with GSAP (wave, jump, dance, think, flex, pie-time), picking a new routine each loop. Inspired by the [Codrops breakdown of Claude's mascot animations](https://tympanus.net/codrops/2026/05/05/reverse-engineering-claude-ais-mascot-animations-with-svg-and-gsap/).

## Regenerating the GIF

`demo.gif` is produced by `tools/build_gif.py`, a tiny dependency-free GIF encoder (no Pillow, no ffmpeg — just the standard library). Run `python3 tools/build_gif.py` to rebuild it.

## Layout

```
extensions/
  pi-mascot.ts        greeting + mascot + effort/ctx/compaction status
  pi-fx.ts            custom footer bar
  smart-compaction.ts model-aware %-based auto-compaction
themes/
  synthwave.json      neon dark theme
web/
  pi-mascot.html      SVG + GSAP browser version
tools/
  build_gif.py        dependency-free demo.gif generator
```

MIT. Have fun — your corner of the terminal should be a little fun.
