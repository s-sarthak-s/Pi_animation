/**
 * pi-mascot — greeting banner + an always-on pixel π mascot.
 *
 * Layout: mascot on the left, status lines (effort / ctx / compacted) to its
 * right so it stays short and uses the empty horizontal space. Plain when idle,
 * animates a random routine while the agent works. Eyes drift with context fill.
 * Status colors come from the active pi theme.
 *
 * Commands:  /mascot   toggle greeting + mascot
 */

import type { ExtensionAPI, ExtensionContext, ThinkingLevel } from "@earendil-works/pi-coding-agent";

const RESET = "\x1b[0m";
const fg = (rgb: string) => `\x1b[38;2;${rgb}m`;
const both = (t: string, b: string) => `\x1b[38;2;${t}m\x1b[48;2;${b}m`;

const PAL: Record<string, string | undefined> = {
  ".": undefined,
  B: "46;127;255", b: "31;111;255", E: "244;239;255", P: "10;16;48", C: "0;234;255", O: "235;150;60",
  N: "255;47;176", G: "43;255;136", Y: "255;207;58", V: "178;107;255", W: "170;180;200",
};

function render(grid: string[]): string[] {
  const lines: string[] = [];
  for (let y = 0; y < grid.length; y += 2) {
    const top = grid[y], bot = grid[y + 1] ?? "";
    let line = "";
    for (let x = 0; x < top.length; x++) {
      const t = PAL[top[x]], b = PAL[bot[x] ?? "."];
      if (t && b) line += both(t, b) + "▀" + RESET;
      else if (t) line += fg(t) + "▀" + RESET;
      else if (b) line += fg(b) + "▄" + RESET;
      else line += " ";
    }
    lines.push(line);
  }
  return lines;
}

// ── compact π mascot: 14×10 px (5 text rows) ────────────────────────────────
const W = 14, H = 10;
const blank = (): string[][] => Array.from({ length: H }, () => Array(W).fill("."));
const set = (g: string[][], x: number, y: number, ch: string) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = ch; };

interface Pose {
  look?: number; blink?: boolean; smile?: boolean; armR?: "down" | "up" | "mid"; armL?: "down" | "up";
  think?: boolean; ox?: number; oy?: number; ball?: number;
  step?: number; flag?: number; confetti?: number; lift?: "down" | "mid" | "up"; zzz?: number;
}

function frame(p: Pose = {}): string[] {
  const g = blank();
  const ox = p.ox ?? 0, oy = p.oy ?? 0;
  const b = (x0: number, x1: number, y0: number, y1: number, ch: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x + ox, y + oy, ch);
  };
  if (p.armL === "up") b(1, 2, 0, 1, "b"); else b(1, 1, 2, 4, "b");
  if (p.armR === "up") b(11, 12, 0, 1, "b"); else if (p.armR === "mid") b(11, 12, 2, 3, "b"); else b(12, 12, 2, 4, "b");
  b(2, 11, 1, 4, "B"); // π bar
  // eyes: 3px wide, aligned to the rows 2-3 half-block pair (clean, no straddle)
  if (p.blink) { b(4, 6, 3, 3, "P"); b(8, 10, 3, 3, "P"); }
  else {
    b(4, 6, 2, 3, "E"); b(8, 10, 2, 3, "E");
    const dx = p.look ?? 0;
    b(5 + dx, 5 + dx, 2, 3, "P"); b(9 + dx, 9 + dx, 2, 3, "P");
  }
  if (p.smile) b(5, 8, 4, 4, "P"); else b(6, 7, 4, 4, "P");
  b(4, 5, 5, 8, "b"); b(8, 9, 5, 8, "b"); // legs
  if (p.step === 1) b(3, 5, 7, 8, "b"); else b(8, 11, 7, 8, "b"); // foot taps side while walking
  if (p.ball !== undefined) b(11, 12, p.ball, p.ball + 1, "O");
  if (p.think) { set(g, 12, 1, "C"); set(g, 13, 0, "C"); }
  // ── props ──
  if (p.confetti !== undefined) {
    const sets = [
      [[2, 0, "N"], [5, 0, "Y"], [9, 1, "C"], [12, 0, "V"]],
      [[3, 1, "G"], [6, 0, "N"], [10, 0, "Y"], [12, 1, "C"]],
      [[2, 1, "V"], [5, 1, "C"], [8, 0, "N"], [11, 0, "G"]],
      [[4, 0, "Y"], [7, 1, "V"], [9, 0, "G"], [12, 0, "N"]],
    ][p.confetti % 4];
    for (const [x, y, ch] of sets as [number, number, string][]) set(g, x, y, ch);
  }
  if (p.lift) {
    const row = p.lift === "up" ? 0 : p.lift === "mid" ? 1 : 5;
    b(2, 3, row, row, "W"); b(10, 11, row, row, "W"); b(4, 9, row, row, "C"); // dumbbell
    if (p.lift === "up") { b(1, 2, 0, 1, "b"); b(11, 12, 0, 1, "b"); }
    else if (p.lift === "mid") { b(1, 1, 1, 2, "b"); b(12, 12, 1, 2, "b"); }
  }
  if (p.flag !== undefined) {
    b(11, 12, 0, 1, "b"); b(12, 12, 0, 4, "W"); // raised arm + pole
    const shapes = [
      [[13, 0, "N"], [13, 1, "N"]],
      [[13, 0, "N"], [12, 1, "N"], [13, 2, "Y"]],
      [[13, 1, "N"], [13, 2, "Y"]],
    ][p.flag % 3];
    for (const [x, y, ch] of shapes as [number, number, string][]) set(g, x, y, ch);
  }
  if (p.zzz !== undefined) {
    const pts = [[[11, 1]], [[11, 1], [12, 0]], [[12, 0], [13, 0]]][p.zzz % 3];
    for (const [x, y] of pts as [number, number][]) set(g, x, y, "C");
  }
  return render(g.map((r) => r.join("")));
}

const ROUTINES: Record<string, Pose[]> = {
  dance: [{ ox: -1, armL: "up", smile: true }, { smile: true }, { ox: 1, armR: "up", smile: true }, { smile: true }],
  dribble: [{ ball: 5, armR: "mid" }, { ball: 7, armR: "mid" }, { ball: 8, armR: "down" }, { ball: 7, armR: "mid" }],
  jump: [{ oy: 0, smile: true }, { oy: -2, armL: "up", armR: "up", smile: true }, { oy: -3, armL: "up", armR: "up", smile: true }, { oy: -1, smile: true }],
  wave: [{ armR: "up", smile: true }, { armR: "mid", smile: true }, { armR: "up", smile: true }, { armR: "mid", smile: true }],
  think: [{ think: true }, { think: true, look: 1 }, { think: true }, { think: true, blink: true }],
  cheer: [{ armL: "up", armR: "up", smile: true }, { smile: true }, { armL: "up", armR: "up", smile: true }, { blink: true, smile: true }],
  walk: [{ step: 0, ox: -1 }, { step: 1, ox: 0, oy: -1 }, { step: 0, ox: 1 }, { step: 1, ox: 0, oy: -1 }],
  flag: [{ flag: 0 }, { flag: 1 }, { flag: 2 }, { flag: 1 }],
  confetti: [{ confetti: 0, armL: "up", armR: "up", smile: true }, { confetti: 1, smile: true }, { confetti: 2, armL: "up", armR: "up", smile: true }, { confetti: 3, smile: true }],
  gym: [{ lift: "down" }, { lift: "mid" }, { lift: "up", smile: true }, { lift: "up", smile: true }, { lift: "mid" }],
  sleep: [{ zzz: 0, blink: true }, { zzz: 1, blink: true }, { zzz: 2, blink: true }, { zzz: 1, blink: true }],
  spin: [{ look: -1 }, { look: 0 }, { look: 1 }, { look: 0, blink: true }],
};
const NAMES = Object.keys(ROUTINES);
const IDLE: Pose[] = [{}, {}, {}, {}, {}, { blink: true }];

// ── greeting block font ──────────────────────────────────────────────────────
const FONT: Record<string, string[]> = {
  A: [" ███ ", "█   █", "█████", "█   █", "█   █"], B: ["████ ", "█   █", "████ ", "█   █", "████ "],
  C: [" ████", "█    ", "█    ", "█    ", " ████"], D: ["████ ", "█   █", "█   █", "█   █", "████ "],
  E: ["█████", "█    ", "████ ", "█    ", "█████"], F: ["█████", "█    ", "████ ", "█    ", "█    "],
  G: [" ████", "█    ", "█  ██", "█   █", " ████"], H: ["█   █", "█   █", "█████", "█   █", "█   █"],
  I: ["█████", "  █  ", "  █  ", "  █  ", "█████"], J: ["█████", "   █ ", "   █ ", "█  █ ", " ██  "],
  K: ["█   █", "█  █ ", "███  ", "█  █ ", "█   █"], L: ["█    ", "█    ", "█    ", "█    ", "█████"],
  M: ["█   █", "██ ██", "█ █ █", "█   █", "█   █"], N: ["█   █", "██  █", "█ █ █", "█  ██", "█   █"],
  O: [" ███ ", "█   █", "█   █", "█   █", " ███ "], P: ["████ ", "█   █", "████ ", "█    ", "█    "],
  Q: [" ███ ", "█   █", "█ █ █", "█  █ ", " ██ █"], R: ["████ ", "█   █", "████ ", "█  █ ", "█   █"],
  S: [" ████", "█    ", " ███ ", "    █", "████ "], T: ["█████", "  █  ", "  █  ", "  █  ", "  █  "],
  U: ["█   █", "█   █", "█   █", "█   █", " ███ "], V: ["█   █", "█   █", "█   █", " █ █ ", "  █  "],
  W: ["█   █", "█   █", "█ █ █", "██ ██", "█   █"], X: ["█   █", " █ █ ", "  █  ", " █ █ ", "█   █"],
  Y: ["█   █", " █ █ ", "  █  ", "  █  ", "  █  "], Z: ["█████", "   █ ", "  █  ", " █   ", "█████"],
  " ": ["  ", "  ", "  ", "  ", "  "],
};
function banner(word: string, rgb: string): string[] {
  const rows = ["", "", "", "", ""];
  for (const ch of word.toUpperCase()) { const gl = FONT[ch] ?? FONT[" "]; for (let i = 0; i < 5; i++) rows[i] += gl[i] + " "; }
  return rows.map((r) => fg(rgb) + r + RESET);
}

// Name for the greeting: PI_MASCOT_NAME env wins, else first name from $USER, else "there".
const NAME = (process.env.PI_MASCOT_NAME || (process.env.USER || "").split(/[^A-Za-z]/)[0] || "there").toUpperCase();

// ── status (theme-colored), returned as 3 lines ──────────────────────────────
const LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
const THINK_TOK = ["thinkingOff", "thinkingMinimal", "thinkingLow", "thinkingMedium", "thinkingHigh", "thinkingXhigh", "thinkingMax"];

// theme.fg(token, text) wraps text in that theme color.
type Theme = { fg: (token: string, text: string) => string };

function statusLines(theme: Theme, ctx: ExtensionContext, compactions: number): string[] {
  const lvl = ctx.thinkingLevel ?? "off";
  const li = Math.max(0, LEVELS.indexOf(lvl));
  const tok = THINK_TOK[li] ?? "muted";
  const effort = theme.fg("muted", "effort ") + theme.fg(tok, "▮".repeat(li + 1)) + theme.fg("dim", "▯".repeat(LEVELS.length - li - 1)) + theme.fg(tok, ` ${lvl}`);

  const pct = Math.round(ctx.getContextUsage?.()?.percent ?? 0);
  const fill = Math.round(pct / 10);
  const ctok = pct >= 85 ? "error" : pct >= 70 ? "warning" : "borderAccent";
  const ctxLine = theme.fg("muted", "ctx    ") + theme.fg(ctok, "▮".repeat(fill)) + theme.fg("dim", "▯".repeat(10 - fill)) + theme.fg(ctok, ` ${pct}%`);

  const warn = compactions >= 3;
  const compLine = theme.fg(warn ? "warning" : "muted", `⟳ compacted ×${compactions}${warn ? "  — /new" : ""}`);
  return [effort, ctxLine, compLine];
}

export default function (pi: ExtensionAPI) {
  let enabled = true;
  let timer: ReturnType<typeof setInterval> | undefined;
  let greeted = false;
  let compactions = 0;

  // eyes follow the context bar: drift right as it fills
  const ctxLook = (ctx: ExtensionContext) => { const p = ctx.getContextUsage?.()?.percent ?? 0; return p < 33 ? -1 : p < 66 ? 0 : 1; };

  const paint = (ctx: ExtensionContext, poses: Pose[], intervalMs: number) => {
    if (timer) { clearInterval(timer); timer = undefined; }
    if (!enabled) return;
    const theme = (ctx.ui as unknown as { theme: Theme }).theme;
    let f = 0;
    const tick = () => {
      const pose = poses[f++ % poses.length];
      const art = frame({ ...pose, look: pose.look ?? ctxLook(ctx) });
      const status = statusLines(theme, ctx, compactions);
      // stitch status beside the mascot rows (rows 1..3)
      const out = art.map((row, i) => (i >= 1 && i <= 3 ? row + "   " + status[i - 1] : row));
      ctx.ui.setWidget("mascot", out, { placement: "belowEditor" });
    };
    tick();
    timer = setInterval(tick, intervalMs);
  };
  const idle = (ctx: ExtensionContext) => paint(ctx, IDLE, 2500);
  const work = (ctx: ExtensionContext) => paint(ctx, ROUTINES[NAMES[Math.floor(Math.random() * NAMES.length)]], 160);

  const greet = (ctx: ExtensionContext) => {
    greeted = false;
    ctx.ui.setWidget("greeting", [
      ...banner("HELLO", "255;47;176"), ...banner(NAME, "0;234;255"),
      fg("138;127;176") + "  what can I help you with today?" + RESET,
    ], { placement: "aboveEditor" });
  };
  const ungreet = (ctx: ExtensionContext) => { if (greeted) return; greeted = true; ctx.ui.setWidget("greeting", undefined); };

  pi.on("session_start", async (_e, ctx) => { compactions = 0; if (enabled) { greet(ctx); idle(ctx); } });
  pi.on("agent_start", async (_e, ctx) => { ungreet(ctx); work(ctx); });
  pi.on("agent_settled", async (_e, ctx) => idle(ctx));
  pi.on("session_compact", async (_e, ctx) => { compactions++; idle(ctx); });
  pi.on("session_shutdown", async () => { if (timer) clearInterval(timer); });

  pi.registerCommand("mascot", {
    description: "Toggle the pixel π mascot + greeting",
    handler: async (_args, ctx) => {
      enabled = !enabled;
      if (!enabled) { if (timer) clearInterval(timer); timer = undefined; ctx.ui.setWidget("mascot", undefined); ctx.ui.setWidget("greeting", undefined); }
      else { greet(ctx); idle(ctx); }
      ctx.ui.notify(`mascot ${enabled ? "on" : "off"}`, "info");
    },
  });
}
