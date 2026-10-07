# Pi Animation

A little pixel **π** that lives at the bottom of your [Pi](https://github.com/earendil-works/pi) terminal, greets you by name, and does a different cute animation every time the agent is working — plus a status readout that actually tells you something useful.

![the mascot cycling through its routines](demo.gif)

If we're honest, a lot of us now spend more of the day watching Pi think than typing code ourselves. This just makes that time a bit nicer to look at — and sneaks in a few genuinely handy readouts while it's there.

## What's in the box

- **A pixel π mascot** rendered with truecolor half-blocks (so it's still just text — it works inside Pi's TUI, no image support needed). It sits idle when nothing's happening and rotates through **218 routines** while the agent works. The original walk, dance, gym, dribble, flag, confetti, jump, think, cheer, sleep, spin, and wave are joined by typing, coffee, reading, rocket, magic, guitar, rain, meditation, peek, shrug, heart, search, painting, panic, juggling, bubble gum, singing, photography, fishing, skateboarding, balloon, and yo-yo — plus a third wave of thirty (moonwalk, robot, salsa, headbang, DJ, ballet, hula, disco, drums, saxophone, violin, conductor, tennis, dunk, soccer, boxing, kayak, surf, yoga, tai chi, campfire, stargazing, gardening, butterfly chase, sneeze, selfie, beatbox, lullaby, limbo, parade) and a fourth wave of 154 more: forty dance styles (tango, waltz, breakdance, krump, vogue, floss, dab, macarena, bhangra, cossack, cancan, moshpit…), forty sports (golf, fencing, javelin, highjump, sprint, swim, bmx, ski, volleyball, sumo, karate, capoeira, billiards…), twenty-five music acts (piano, cello, harp, trumpet, banjo, accordion, tuba, bongo, karaoke, opera, bagpipes, keytar, airguitar, rap battle…), twenty-five jobs and characters (chef, barista, farmer, welder, doctor, detective, spy, ninja, pirate, cowboy, knight, witch, vampire, zombie, ghost, superhero, clown, mime, acrobat…), and twenty odds and ends (chess, dice, rubik's cube, pinball, trampoline, snowball, rainbow, tornado, pizza, popcorn, birthday, toast…).
- **Stable terminal layout** — every frame stays inside a fixed five-row canvas and is width-truncated before rendering, so jump/peek/shake frames cannot wrap and push the editor or footer around.
- **Effort reactions** — changing effort immediately plays a distinct animation for every level: sleep (`off`), coffee (`minimal`), walk (`low`), typing (`medium`), think (`high`), rocket (`xhigh`), and magic (`max`).
- **Context reactions** — the mascot starts searching at 50%, reads at 70%, panics at 85%, and tries to rocket out at 95%. Crossing each threshold triggers the reaction immediately.
- **A random color in every window** — each new Pi window gets its own mascot color from 18 presets (pin one with `PI_MASCOT_COLOR` if you want consistency). You can also choose a preset or any `#RRGGBB` color yourself, pick a one-off random color, or let the mascot occasionally change itself.
- **A "Hello NAME" greeting** in big block letters when you open a fresh session, cleared the moment you send your first message.
- **An effort meter** — a live bar of your current thinking level (`off → max`), colored from the active theme.
- **A context bar** — how full your context window is, right now, as a bar plus a percentage. Cyan when you're fine, amber past 70%, red past 85%.
- **A compaction counter** — how many times the session has auto-compacted, so you know when the conversation is getting long and it might be time to start fresh.
- **A quiet activity slot** — the otherwise-empty right side shows only one timely signal (`◉ 3 agents`, `↻ compacting`, `↳ follow-up queued`, or a brief success/failure). It stays completely blank when nothing needs attention. Subagent counts come from the current session's live run status, not a guess.
- **Work-aware reactions** — searches use the magnifying glass, edits type, writes paint, test runs peek and then cheer/panic, and subagent fan-outs wave the director flag. The animation carries secondary information without adding another dashboard row.
- **Smart, model-aware auto-compaction** — compaction that triggers at a percentage of *whatever model you're on*, instead of a fixed token count that means different things on a 200k vs a 1M window.
- **A synthwave theme** to tie it together.
- **A web version** (`web/pi-mascot.html`) — the same character rebuilt as smooth SVG + GSAP for the browser, if you want the polished vector version outside the terminal.

## The status line, up close

```
▄▄π▄▄
█π█   effort ▮▮▮▮▮▯▯ high
██    ctx    ▮▮▯▯▯▯▯▯▯▯ 19%      ◉ 3 agents
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
| `/mascot-color purple` | Set a preset: blue, cyan, pink, purple, green, orange, red, gold, white, lime, teal, indigo, coral, sky, mint, rose, magenta, or ice |
| `/mascot-color #7c3aed` | Set any custom hex color |
| `/mascot-color random` | Pick a different color once |
| `/mascot-color auto` | Enable occasional automatic color changes |
| `/mascot-color default` | Restore blue and turn auto-color off |
| `/mascot-auto-color [on\|off]` | Toggle automatic color changes, or set them explicitly |
| `/dance` | Dance marathon: the mascot performs all 218 routines once, in order (~6 min) |
| `/crazy` | Crazy mode: the same marathon at 2× frame speed with a new random color every ~0.3s (~3 min), ending in confetti |
| `/fx` | Toggle the custom footer (dir · branch · ctx% · cost · model) |
| `/compact-at 85` | Set the auto-compaction threshold to any percent (10–99) |

You can also set `PI_MASCOT_COLOR` (preset name or `#RRGGBB`) and `PI_MASCOT_AUTO_COLOR=1` before starting Pi. Without `PI_MASCOT_COLOR`, every new window starts with a random preset.

## The web version

`web/pi-mascot.html` is a standalone page — open it in any browser. It's the same π rebuilt from `<rect>`s and animated with GSAP, picking a new routine each loop. The web version has 42 routines (the original twelve plus thirty mirroring the third terminal wave: moonwalk, robot, salsa, headbang, dj, ballet, hula, disco, drums, sax, violin, conductor, tennis, dunk, soccer, boxing, kayak, surf, yoga, taichi, campfire, stargaze, gardener, butterfly, sneeze, selfie, beatbox, lullaby, limbo, parade) — the terminal's full set is much larger. Every window load gets a random palette from 16 options, the recolor 🎨 button shuffles it on demand, and the dance 💃 / crazy 🤪 buttons run the same marathon modes as the `/dance` and `/crazy` terminal commands (crazy plays at 2× speed with rapid recoloring). Inspired by the [Codrops breakdown of Claude's mascot animations](https://tympanus.net/codrops/2026/05/05/reverse-engineering-claude-ais-mascot-animations-with-svg-and-gsap/).

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
