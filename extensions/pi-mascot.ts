/**
 * pi-mascot — greeting banner + an always-on pixel π mascot.
 *
 * The mascot lives in a fixed 14×10 pixel canvas (five terminal rows), so no
 * animation can reflow the editor/footer below it. It reacts to effort and
 * context changes, rotates through work routines, and gets a random body
 * color in every new window (pin one with PI_MASCOT_COLOR) with support for
 * manual or occasional automatic color changes too.
 *
 * Commands:
 *   /mascot                    toggle greeting + mascot
 *   /mascot-color <color>      set a preset, #RRGGBB, random, default, or auto
 *   /mascot-auto-color [on|off] toggle occasional color changes
 *   /dance                     dance marathon: every routine once, in order
 *   /crazy                     dance marathon, but faster with rapid color changes
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, ThinkingLevel } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

const RESET = "\x1b[0m";
const fg = (rgb: string) => `\x1b[38;2;${rgb}m`;
const both = (t: string, b: string) => `\x1b[38;2;${t}m\x1b[48;2;${b}m`;

interface MascotColor { body: string; shadow: string }

const COLOR_PRESETS: Record<string, MascotColor> = {
  blue: { body: "46;127;255", shadow: "31;111;255" },
  cyan: { body: "0;214;235", shadow: "0;151;184" },
  pink: { body: "255;65;177", shadow: "204;38;137" },
  purple: { body: "174;96;255", shadow: "125;62;214" },
  green: { body: "43;220;128", shadow: "24;157;87" },
  orange: { body: "255;145;52", shadow: "210;91;28" },
  red: { body: "255;76;91", shadow: "199;43;58" },
  gold: { body: "255;201;54", shadow: "210;145;25" },
  white: { body: "230;235;245", shadow: "155;168;190" },
  lime: { body: "163;230;53", shadow: "117;166;38" },
  teal: { body: "20;200;180", shadow: "14;144;130" },
  indigo: { body: "99;102;241", shadow: "71;73;173" },
  coral: { body: "255;111;97", shadow: "214;80;69" },
  sky: { body: "56;189;248", shadow: "29;134;196" },
  mint: { body: "52;211;153", shadow: "37;152;110" },
  rose: { body: "251;113;133", shadow: "181;81;96" },
  magenta: { body: "232;80;220", shadow: "170;55;160" },
  ice: { body: "180;220;255", shadow: "130;160;190" },
};
const COLOR_NAMES = Object.keys(COLOR_PRESETS);

const PROP_COLORS: Record<string, string | undefined> = {
  ".": undefined,
  E: "244;239;255", P: "10;16;48", C: "0;234;255", O: "235;150;60",
  N: "255;47;176", G: "43;255;136", Y: "255;207;58", V: "178;107;255", W: "170;180;200",
};

function pixelColor(ch: string, color: MascotColor): string | undefined {
  if (ch === "B") return color.body;
  if (ch === "b") return color.shadow;
  return PROP_COLORS[ch];
}

function render(grid: string[], color: MascotColor): string[] {
  const lines: string[] = [];
  for (let y = 0; y < grid.length; y += 2) {
    const top = grid[y], bot = grid[y + 1] ?? "";
    let line = "";
    for (let x = 0; x < top.length; x++) {
      const t = pixelColor(top[x], color), b = pixelColor(bot[x] ?? ".", color);
      if (t && b) line += both(t, b) + "▀" + RESET;
      else if (t) line += fg(t) + "▀" + RESET;
      else if (b) line += fg(b) + "▄" + RESET;
      else line += " ";
    }
    lines.push(line);
  }
  return lines;
}

// ── fixed-size π mascot: 14×10 px (always exactly five terminal rows) ───────
const W = 14, H = 10;
const blank = (): string[][] => Array.from({ length: H }, () => Array(W).fill("."));
const set = (g: string[][], x: number, y: number, ch: string) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = ch; };

type Prop = "keyboard" | "coffee" | "book" | "rocket" | "wand" | "guitar" | "umbrella" | "heart" | "search" | "paint"
  | "balloon" | "yoyo" | "mic" | "camera" | "fishing" | "skate";
interface Pose {
  look?: number; blink?: boolean; smile?: boolean; armR?: "down" | "up" | "mid"; armL?: "down" | "up";
  think?: boolean; ox?: number; oy?: number; ball?: number; step?: number; flag?: number; confetti?: number;
  lift?: "down" | "mid" | "up"; zzz?: number; prop?: Prop; phase?: number; sit?: boolean; sweat?: boolean;
  juggle?: number; bubble?: number; notes?: number;
}

function frame(p: Pose = {}, color: MascotColor): string[] {
  const g = blank();
  const ox = p.ox ?? 0, oy = p.oy ?? 0, phase = p.phase ?? 0;
  const b = (x0: number, x1: number, y0: number, y1: number, ch: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x + ox, y + oy, ch);
  };
  const s = (x: number, y: number, ch: string) => set(g, x, y, ch);

  if (p.armL === "up") b(1, 2, 0, 1, "b"); else b(1, 1, 2, 4, "b");
  if (p.armR === "up") b(11, 12, 0, 1, "b");
  else if (p.armR === "mid") b(11, 12, 2, 3, "b");
  else b(12, 12, 2, 4, "b");
  b(2, 11, 1, 4, "B");

  if (p.blink) { b(4, 6, 3, 3, "P"); b(8, 10, 3, 3, "P"); }
  else {
    b(4, 6, 2, 3, "E"); b(8, 10, 2, 3, "E");
    const dx = p.look ?? 0;
    b(5 + dx, 5 + dx, 2, 3, "P"); b(9 + dx, 9 + dx, 2, 3, "P");
  }
  if (p.smile) b(5, 8, 4, 4, "P"); else b(6, 7, 4, 4, "P");

  if (p.sit) {
    b(3, 6, 6, 7, "b"); b(7, 10, 6, 7, "b");
  } else {
    b(4, 5, 5, 8, "b"); b(8, 9, 5, 8, "b");
    if (p.step === 1) b(3, 5, 7, 8, "b"); else b(8, 11, 7, 8, "b");
  }

  if (p.ball !== undefined) b(11, 12, p.ball, p.ball + 1, "O");
  if (p.think) { s(12, 1, "C"); s(13, 0, "C"); }
  if (p.sweat) { s(12, 2 + (phase % 2), "C"); s(13, 0, phase % 2 ? "N" : "Y"); }

  if (p.confetti !== undefined) {
    const sets = [
      [[2, 0, "N"], [5, 0, "Y"], [9, 1, "C"], [12, 0, "V"]],
      [[3, 1, "G"], [6, 0, "N"], [10, 0, "Y"], [12, 1, "C"]],
      [[2, 1, "V"], [5, 1, "C"], [8, 0, "N"], [11, 0, "G"]],
      [[4, 0, "Y"], [7, 1, "V"], [9, 0, "G"], [12, 0, "N"]],
    ][p.confetti % 4];
    for (const [x, y, ch] of sets as [number, number, string][]) s(x, y, ch);
  }
  if (p.lift) {
    const row = p.lift === "up" ? 0 : p.lift === "mid" ? 1 : 5;
    b(2, 3, row, row, "W"); b(10, 11, row, row, "W"); b(4, 9, row, row, "C");
    if (p.lift === "up") { b(1, 2, 0, 1, "b"); b(11, 12, 0, 1, "b"); }
    else if (p.lift === "mid") { b(1, 1, 1, 2, "b"); b(12, 12, 1, 2, "b"); }
  }
  if (p.flag !== undefined) {
    b(11, 12, 0, 1, "b"); b(12, 12, 0, 4, "W");
    const shapes = [
      [[13, 0, "N"], [13, 1, "N"]],
      [[13, 0, "N"], [12, 1, "N"], [13, 2, "Y"]],
      [[13, 1, "N"], [13, 2, "Y"]],
    ][p.flag % 3];
    for (const [x, y, ch] of shapes as [number, number, string][]) s(x, y, ch);
  }
  if (p.zzz !== undefined) {
    const pts = [[[11, 1]], [[11, 1], [12, 0]], [[12, 0], [13, 0]]][p.zzz % 3];
    for (const [x, y] of pts as [number, number][]) s(x, y, "C");
  }

  if (p.juggle !== undefined) {
    const [ly, ry] = ([[1, 3], [0, 2], [1, 1], [2, 0]][p.juggle % 4] as [number, number]);
    s(1, ly, "O"); s(12, ry, "O");
  }
  if (p.bubble !== undefined) {
    const size = p.bubble % 3;
    if (size === 0) s(9, 4, "N");
    else if (size === 1) b(9, 10, 4, 5, "N");
    else b(9, 11, 3, 5, "N");
  }
  if (p.notes !== undefined) {
    const sets = [
      [[1, 1, "G"]],
      [[0, 0, "G"], [2, 1, "Y"]],
      [[1, 0, "Y"], [2, 1, "C"]],
    ][p.notes % 3];
    for (const [x, y, ch] of sets as [number, number, string][]) s(x, y, ch);
  }

  // Sixteen tiny props power twenty-two additional routines without changing canvas size.
  if (p.prop === "keyboard") {
    b(3, 10, 6, 7, "W"); for (let x = 4 + (phase % 2); x <= 9; x += 2) b(x, x, 6, 6, "C");
  } else if (p.prop === "coffee") {
    b(10, 12, 6, 8, "O"); b(13, 13, 7, 7, "O"); s(11 + (phase % 2), 5, "W"); s(12 - (phase % 2), 4, "W");
  } else if (p.prop === "book") {
    b(3, 6, 5, 7, "V"); b(7, 10, 5, 7, "N"); b(6, 7, 5, 7, "W");
  } else if (p.prop === "rocket") {
    b(4, 5, 9, 9, phase % 2 ? "Y" : "O"); b(8, 9, 9, 9, phase % 2 ? "O" : "N");
  } else if (p.prop === "wand") {
    b(10, 10, 5, 7, "W"); b(11, 11, 4, 5, "V"); s(12, phase % 2, "Y"); s(13, 2 - (phase % 2), "C");
  } else if (p.prop === "guitar") {
    b(5, 9, 5, 8, "O"); b(9, 12, 4, 5, "Y"); s(6 + (phase % 2), 6, "P");
  } else if (p.prop === "umbrella") {
    b(2, 11, 0, 0, "C"); b(4, 9, 1, 1, "C"); b(7, 7, 0, 5, "W");
    s(phase % 2 ? 1 : 12, 6, "C"); s(phase % 2 ? 12 : 2, 8, "C");
  } else if (p.prop === "heart") {
    s(11, 5, "N"); s(13, 5, "N"); b(11, 13, 6, 6, "N"); s(12, 7, "N");
  } else if (p.prop === "search") {
    b(10, 12, 5, 7, "C"); b(11, 11, 6, 6, "."); b(8, 10, 7, 8, "W");
  } else if (p.prop === "paint") {
    b(3, 8, 6, 8, "O"); s(4, 7, "N"); s(6, 7, "C"); s(8, 7, "G"); b(9, 12, 5, 5, phase % 2 ? "V" : "Y");
  } else if (p.prop === "balloon") {
    const d = phase % 2;
    b(10 + d, 12 + d, 0, 1, "N"); s(11 + d, 2, "N");
    s(11 + d, 3, "W"); s(12, 4, "W");
  } else if (p.prop === "yoyo") {
    const drop = ([2, 4, 3][phase % 3] as number);
    b(12, 12, 4, 4 + drop, "W");
    b(11, 13, 5 + drop, 5 + drop, "Y");
  } else if (p.prop === "mic") {
    b(11, 13, 2, 3, "P"); s(12, 2, "C"); b(12, 12, 4, 5, "W");
  } else if (p.prop === "camera") {
    b(10, 12, 4, 6, "P"); s(11, 5, "C"); s(10, 3, "W");
    if (phase % 2) s(13, 3, "Y");
  } else if (p.prop === "fishing") {
    s(11, 4, "W"); s(12, 3, "W"); s(13, 2, "W");
    const len = 3 + (phase % 3);
    b(13, 13, 3, 2 + len, "W");
    if (len === 5) s(12, 8, "O");
  } else if (p.prop === "skate") {
    b(3, 10, 9, 9, "V");
    s(phase % 2 ? 0 : 1, 6, "C"); s(phase % 2 ? 1 : 0, 8, "C");
  }

  return render(g.map((r) => r.join("")), color);
}

// Original twelve + fourteen prop routines + eight more = thirty-four total.
const ROUTINES = {
  dance: [{ ox: -1, armL: "up", smile: true }, { smile: true }, { ox: 1, armR: "up", smile: true }, { smile: true }],
  dribble: [{ ball: 5, armR: "mid" }, { ball: 7, armR: "mid" }, { ball: 8, armR: "down" }, { ball: 7, armR: "mid" }],
  jump: [{ smile: true }, { oy: -2, armL: "up", armR: "up", smile: true }, { oy: -3, armL: "up", armR: "up", smile: true }, { oy: -1, smile: true }],
  wave: [{ armR: "up", smile: true }, { armR: "mid", smile: true }, { armR: "up", smile: true }, { armR: "mid", smile: true }],
  think: [{ think: true }, { think: true, look: 1 }, { think: true }, { think: true, blink: true }],
  cheer: [{ armL: "up", armR: "up", smile: true }, { smile: true }, { armL: "up", armR: "up", smile: true }, { blink: true, smile: true }],
  walk: [{ step: 0, ox: -1 }, { step: 1, oy: -1 }, { step: 0, ox: 1 }, { step: 1, oy: -1 }],
  flag: [{ flag: 0 }, { flag: 1 }, { flag: 2 }, { flag: 1 }],
  confetti: [{ confetti: 0, armL: "up", armR: "up", smile: true }, { confetti: 1, smile: true }, { confetti: 2, armL: "up", armR: "up", smile: true }, { confetti: 3, smile: true }],
  gym: [{ lift: "down" }, { lift: "mid" }, { lift: "up", smile: true }, { lift: "up", smile: true }, { lift: "mid" }],
  sleep: [{ zzz: 0, blink: true }, { zzz: 1, blink: true }, { zzz: 2, blink: true }, { zzz: 1, blink: true }],
  spin: [{ look: -1 }, { look: 0 }, { look: 1 }, { look: 0, blink: true }],
  typing: [{ prop: "keyboard", phase: 0, armL: "up", armR: "mid" }, { prop: "keyboard", phase: 1, armL: "up", armR: "mid", look: 1 }, { prop: "keyboard", phase: 0, armR: "mid" }, { prop: "keyboard", phase: 1, armL: "up", armR: "mid" }],
  coffee: [{ prop: "coffee", phase: 0, armR: "mid" }, { prop: "coffee", phase: 1, armR: "mid", blink: true }, { prop: "coffee", phase: 0, armR: "up", smile: true }, { prop: "coffee", phase: 1, armR: "mid" }],
  reading: [{ prop: "book", look: -1 }, { prop: "book", look: 1 }, { prop: "book", blink: true }, { prop: "book", look: -1 }],
  rocket: [{ prop: "rocket", phase: 0, oy: 0, smile: true }, { prop: "rocket", phase: 1, oy: -1, armL: "up", armR: "up", smile: true }, { prop: "rocket", phase: 0, oy: -2, armL: "up", armR: "up", smile: true }, { prop: "rocket", phase: 1, oy: -1, smile: true }],
  magic: [{ prop: "wand", phase: 0, armR: "mid" }, { prop: "wand", phase: 1, armR: "up", smile: true }, { prop: "wand", phase: 0, armR: "mid", blink: true }, { prop: "wand", phase: 1, armR: "up", smile: true }],
  guitar: [{ prop: "guitar", phase: 0, armL: "up", armR: "mid", smile: true }, { prop: "guitar", phase: 1, armR: "mid", smile: true }, { prop: "guitar", phase: 0, armL: "up", armR: "mid" }, { prop: "guitar", phase: 1, armR: "mid", blink: true }],
  rain: [{ prop: "umbrella", phase: 0 }, { prop: "umbrella", phase: 1, look: -1 }, { prop: "umbrella", phase: 0, blink: true }, { prop: "umbrella", phase: 1, look: 1 }],
  meditate: [{ sit: true, blink: true, armL: "up", armR: "mid" }, { sit: true, blink: true }, { sit: true, blink: true, oy: -1 }, { sit: true, blink: true }],
  peek: [{ oy: 2, look: -1 }, { oy: 1, look: 0 }, { oy: 2, look: 1 }, { oy: 1, blink: true }],
  shrug: [{ armL: "up", armR: "up", look: -1 }, { armL: "down", armR: "mid", look: 1 }, { armL: "up", armR: "up", blink: true }, { armL: "down", armR: "mid" }],
  heart: [{ prop: "heart", phase: 0, smile: true }, { prop: "heart", phase: 1, armR: "mid", smile: true }, { prop: "heart", phase: 0, blink: true, smile: true }, { prop: "heart", phase: 1, armR: "up", smile: true }],
  search: [{ prop: "search", phase: 0, look: 1, armR: "mid" }, { prop: "search", phase: 1, look: -1, armR: "mid" }, { prop: "search", phase: 0, look: 1 }, { prop: "search", phase: 1, blink: true }],
  paint: [{ prop: "paint", phase: 0, armR: "mid", smile: true }, { prop: "paint", phase: 1, armR: "up", smile: true }, { prop: "paint", phase: 0, armR: "mid" }, { prop: "paint", phase: 1, armR: "up", blink: true }],
  panic: [{ sweat: true, phase: 0, ox: -1, look: 1 }, { sweat: true, phase: 1, ox: 1, look: -1 }, { sweat: true, phase: 0, armL: "up", armR: "up" }, { sweat: true, phase: 1, blink: true }],
  juggle: [{ juggle: 0, armL: "up", armR: "up", look: -1 }, { juggle: 1, armL: "up", armR: "up" }, { juggle: 2, armL: "up", armR: "up", look: 1 }, { juggle: 3, armL: "up", armR: "up", smile: true }],
  bubble: [{ bubble: 0 }, { bubble: 1 }, { bubble: 2, smile: true }, { bubble: 0, blink: true }],
  sing: [{ prop: "mic", notes: 0, armR: "mid", smile: true }, { prop: "mic", notes: 1, armR: "mid", look: -1, smile: true }, { prop: "mic", notes: 2, armR: "mid", blink: true }, { prop: "mic", notes: 1, armR: "mid", look: 1, smile: true }],
  photo: [{ prop: "camera", phase: 0, armR: "up" }, { prop: "camera", phase: 1, armR: "up", smile: true }, { prop: "camera", phase: 0, armR: "up", blink: true }, { prop: "camera", phase: 1, armR: "up" }],
  fishing: [{ prop: "fishing", phase: 0, sit: true }, { prop: "fishing", phase: 1, sit: true, blink: true }, { prop: "fishing", phase: 2, sit: true, smile: true }, { prop: "fishing", phase: 1, sit: true }],
  skate: [{ prop: "skate", phase: 0, ox: -1, step: 0 }, { prop: "skate", phase: 1, ox: 1, oy: -1, armL: "up", smile: true }, { prop: "skate", phase: 0, ox: 1, step: 1 }, { prop: "skate", phase: 1, ox: -1, oy: -1, armR: "up", smile: true }],
  balloon: [{ prop: "balloon", phase: 0, armR: "mid", look: 1 }, { prop: "balloon", phase: 1, armR: "mid", look: 1, smile: true }, { prop: "balloon", phase: 0, armR: "mid", oy: -1, armL: "up" }, { prop: "balloon", phase: 1, armR: "mid", blink: true }],
  yoyo: [{ prop: "yoyo", phase: 0, armR: "mid" }, { prop: "yoyo", phase: 1, armR: "mid", look: 1 }, { prop: "yoyo", phase: 2, armR: "mid" }, { prop: "yoyo", phase: 1, armR: "mid", blink: true }],
} satisfies Record<string, Pose[]>;

type RoutineName = keyof typeof ROUTINES;
const NAMES = Object.keys(ROUTINES) as RoutineName[];
const WORK_NAMES = NAMES.filter((name) => name !== "sleep" && name !== "panic");
const IDLE: Pose[] = [{}, {}, {}, {}, {}, { blink: true }];
const EFFORT_ROUTINES: Record<ThinkingLevel, RoutineName> = {
  off: "sleep", minimal: "coffee", low: "walk", medium: "typing", high: "think", xhigh: "rocket", max: "magic",
};

// ── greeting block font ─────────────────────────────────────────────────────
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
const NAME = (process.env.PI_MASCOT_NAME || (process.env.USER || "").split(/[^A-Za-z]/)[0] || "there").toUpperCase();

// ── fixed-width status lines ────────────────────────────────────────────────
const LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
const THINK_TOK = ["thinkingOff", "thinkingMinimal", "thinkingLow", "thinkingMedium", "thinkingHigh", "thinkingXhigh", "thinkingMax"];
type Theme = { fg: (token: string, text: string) => string };

function contextPercent(ctx: ExtensionContext): number {
  return Math.max(0, Math.min(100, Math.round(ctx.getContextUsage?.()?.percent ?? 0)));
}
function statusLines(theme: Theme, ctx: ExtensionContext, compactions: number): string[] {
  const lvl = ctx.thinkingLevel ?? "off";
  const li = Math.max(0, LEVELS.indexOf(lvl));
  const tok = THINK_TOK[li] ?? "muted";
  const label = lvl.padEnd(7, " ");
  const effort = theme.fg("muted", "effort ") + theme.fg(tok, "▮".repeat(li + 1)) + theme.fg("dim", "▯".repeat(LEVELS.length - li - 1)) + theme.fg(tok, ` ${label}`);

  const pct = contextPercent(ctx), fill = Math.round(pct / 10);
  const ctok = pct >= 85 ? "error" : pct >= 70 ? "warning" : "borderAccent";
  const ctxLine = theme.fg("muted", "ctx    ") + theme.fg(ctok, "▮".repeat(fill)) + theme.fg("dim", "▯".repeat(10 - fill)) + theme.fg(ctok, ` ${String(pct).padStart(3, " ")}%`);

  const warn = compactions >= 3;
  const compLine = theme.fg(warn ? "warning" : "muted", `⟳ compacted ×${compactions}${warn ? "  — /new soon" : ""}`);
  return [effort, ctxLine, compLine];
}

function parseHexColor(value: string): MascotColor | undefined {
  const match = value.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return undefined;
  const nums = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16));
  const shadow = nums.map((n) => Math.max(0, Math.round(n * 0.72)));
  return { body: nums.join(";"), shadow: shadow.join(";") };
}

type ActivityToken = "borderAccent" | "warning" | "error" | "success" | "muted";
interface ActivityFlash { text: string; token: ActivityToken; until: number }
interface LiveSubagentTask { agent?: string; state?: string }
interface LiveSubagentStatus {
  state?: string;
  cwd?: string;
  parentSessionId?: string;
  tasks?: LiveSubagentTask[];
}

const SUBAGENT_RUN_ROOT = path.join(os.homedir(), ".pi", "subagent-runs");
const SUBAGENT_RUN_ID = /^\d{8}T\d{6}Z-[0-9a-z]{8,}$/;

export default function (pi: ExtensionAPI) {
  let enabled = true;
  let timer: ReturnType<typeof setInterval> | undefined;
  let currentCtx: ExtensionContext | undefined;
  let greeted = false;
  let compactions = 0;
  let working = false;
  let routine: RoutineName | "idle" = "idle";
  let frameIndex = 0;
  let nextFrameAt = 0;
  let forcedUntil = 0;
  let nextWorkRoutineAt = 0;
  let lastContextBand = 0;
  let colorName = "blue";
  let mascotColor = COLOR_PRESETS.blue;
  let party: { crazy: boolean; remaining: number; nextSwitchAt: number; nextColorAt: number } | undefined;
  let autoColor = /^(1|true|on)$/i.test(process.env.PI_MASCOT_AUTO_COLOR ?? "");
  let nextColorAt = 0;
  let compactingUntil = 0;
  let activityFlash: ActivityFlash | undefined;
  let subagentToolActive = false;
  let liveSubagent: LiveSubagentStatus | undefined;
  let nextSubagentReadAt = 0;
  const testToolCalls = new Set<string>();

  const envColor = process.env.PI_MASCOT_COLOR;
  if (envColor && COLOR_PRESETS[envColor.toLowerCase()]) {
    colorName = envColor.toLowerCase();
    mascotColor = COLOR_PRESETS[colorName];
  } else if (envColor && parseHexColor(envColor)) {
    colorName = envColor.toUpperCase();
    mascotColor = parseHexColor(envColor)!;
  } else {
    // Every new window gets its own random color unless one is pinned above.
    colorName = COLOR_NAMES[Math.floor(Math.random() * COLOR_NAMES.length)] ?? "blue";
    mascotColor = COLOR_PRESETS[colorName];
  }

  const contextBand = (pct: number) => pct >= 95 ? 4 : pct >= 85 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0;
  const contextRoutine = (pct: number): RoutineName | "idle" => pct >= 95 ? "rocket" : pct >= 85 ? "panic" : pct >= 70 ? "reading" : pct >= 50 ? "search" : "idle";
  const ctxLook = (ctx: ExtensionContext) => { const p = contextPercent(ctx); return p < 33 ? -1 : p < 66 ? 0 : 1; };

  const activate = (name: RoutineName | "idle") => {
    routine = name;
    frameIndex = 0;
    nextFrameAt = 0;
  };
  const force = (name: RoutineName, durationMs: number) => {
    if (party) return; // the dance marathon owns the stage until it ends
    activate(name);
    forcedUntil = Date.now() + durationMs;
  };
  const startParty = (crazyMode: boolean) => {
    party = { crazy: crazyMode, remaining: NAMES.length, nextSwitchAt: 0, nextColorAt: 0 };
    forcedUntil = 0;
    tick();
  };
  const randomWorkRoutine = (): RoutineName => {
    const choices = WORK_NAMES.filter((name) => name !== routine);
    return choices[Math.floor(Math.random() * choices.length)] ?? "dance";
  };
  const pickRandomColor = () => {
    const choices = COLOR_NAMES.filter((name) => name !== colorName);
    colorName = choices[Math.floor(Math.random() * choices.length)] ?? "blue";
    mascotColor = COLOR_PRESETS[colorName];
    nextFrameAt = 0;
  };
  const scheduleColor = (now: number) => {
    const min = working ? 8_000 : 20_000, spread = working ? 10_000 : 20_000;
    nextColorAt = now + min + Math.random() * spread;
  };

  const flashActivity = (text: string, token: ActivityToken, durationMs: number) => {
    activityFlash = { text, token, until: Date.now() + durationMs };
    nextFrameAt = 0;
  };

  const parentSessionId = (ctx: ExtensionContext): string | undefined => {
    try {
      const value = ctx.sessionManager.getSessionId?.();
      return typeof value === "string" && value.trim() ? value : undefined;
    } catch { return undefined; }
  };

  const readLiveSubagent = (ctx: ExtensionContext): LiveSubagentStatus | undefined => {
    try {
      const sessionId = parentSessionId(ctx);
      const runIds = fs.readdirSync(SUBAGENT_RUN_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && SUBAGENT_RUN_ID.test(entry.name))
        .map((entry) => entry.name)
        .sort()
        .reverse()
        .slice(0, 24);
      for (const runId of runIds) {
        try {
          const status = JSON.parse(fs.readFileSync(path.join(SUBAGENT_RUN_ROOT, runId, "status.json"), "utf8")) as LiveSubagentStatus;
          if (status.state !== "running") continue;
          if (sessionId ? status.parentSessionId === sessionId : path.resolve(status.cwd ?? "") === path.resolve(ctx.cwd)) return status;
        } catch { /* A status may be replaced while we scan; try the next one. */ }
      }
    } catch { /* The subagent extension/run store is optional. */ }
    return undefined;
  };

  const refreshSubagent = (ctx: ExtensionContext, now: number) => {
    if ((!subagentToolActive && !liveSubagent) || now < nextSubagentReadAt) return;
    nextSubagentReadAt = now + 500;
    liveSubagent = readLiveSubagent(ctx);
  };

  const hasPendingMessages = (ctx: ExtensionContext): boolean => {
    try { return ctx.hasPendingMessages(); } catch { return false; }
  };

  const activityBadge = (theme: Theme, ctx: ExtensionContext, now: number): string | undefined => {
    if (activityFlash && now >= activityFlash.until) activityFlash = undefined;
    if (activityFlash?.token === "error") return theme.fg("error", activityFlash.text);

    const tasks = liveSubagent?.tasks ?? [];
    const active = tasks.filter((task) => task.state === "running" || task.state === "pending");
    if (liveSubagent?.state === "running" || subagentToolActive) {
      const pulse = Math.floor(now / 600) % 2 === 0 ? "●" : "◉";
      const label = active.length === 1 && active[0]?.agent
        ? active[0].agent!
        : active.length > 0 ? `${active.length} agents` : "agent starting";
      return theme.fg("borderAccent", `${pulse} ${label}`);
    }
    if (now < compactingUntil) return theme.fg("warning", "↻ compacting");
    if (hasPendingMessages(ctx)) return theme.fg("muted", "↳ follow-up queued");
    if (activityFlash) return theme.fg(activityFlash.token, activityFlash.text);
    return undefined;
  };

  const isSubagentRun = (args: unknown): boolean => {
    const action = args && typeof args === "object" ? (args as { action?: unknown }).action : undefined;
    return action === undefined || action === "run";
  };
  const isTestCommand = (toolName: string, args: unknown): boolean => {
    if (toolName !== "bash" || !args || typeof args !== "object") return false;
    const command = String((args as { command?: unknown }).command ?? "");
    return /(?:^|[\s;&|])(pytest|rspec|vitest|jest|bun test|npm test|pnpm test|yarn test|go test|cargo test|bundle exec rake test)(?:\s|$)/i.test(command);
  };

  const stableWidget = (ctx: ExtensionContext, lines: string[]) => {
    // A width-aware component prevents terminal wrapping; five returned rows
    // remain five rows even during jump/peek/shake animations.
    ctx.ui.setWidget("mascot", () => ({
      render: (width: number) => lines.map((line) => truncateToWidth(line, Math.max(0, width), "")),
      invalidate() {},
    }), { placement: "belowEditor" });
  };

  const paint = (ctx: ExtensionContext) => {
    const theme = (ctx.ui as unknown as { theme: Theme }).theme;
    const poses = routine === "idle" ? IDLE : ROUTINES[routine];
    const pose = poses[frameIndex++ % poses.length];
    const art = frame({ ...pose, look: pose.look ?? ctxLook(ctx) }, mascotColor);
    const status = statusLines(theme, ctx, compactions);
    const activity = activityBadge(theme, ctx, Date.now());
    stableWidget(ctx, art.map((row, i) => {
      if (i < 1 || i > 3) return row;
      const badge = i === 2 && activity ? "      " + activity : "";
      return row + "   " + status[i - 1] + badge;
    }));
  };

  const tick = () => {
    const ctx = currentCtx;
    if (!enabled || !ctx) return;
    const now = Date.now(), pct = contextPercent(ctx), band = contextBand(pct);
    refreshSubagent(ctx, now);

    if (band > lastContextBand) {
      force(contextRoutine(pct) as RoutineName, 1_600);
      nextWorkRoutineAt = forcedUntil + 2_000;
    }
    lastContextBand = band;

    if (autoColor && (nextColorAt === 0 || now >= nextColorAt)) {
      pickRandomColor();
      scheduleColor(now);
    }

    if (party) {
      if (now >= party.nextSwitchAt) {
        if (party.remaining <= 0) {
          const wasCrazy = party.crazy;
          party = undefined;
          activate(contextRoutine(pct));
          if (wasCrazy) force("confetti", 1_600);
        } else {
          activate(NAMES[NAMES.length - party.remaining] ?? "dance");
          party.remaining--;
          party.nextSwitchAt = now + (party.crazy ? 800 : 1_600);
        }
      }
      if (party?.crazy && now >= party.nextColorAt) {
        pickRandomColor();
        party.nextColorAt = now + 250 + Math.random() * 300;
      }
    } else if (now >= forcedUntil) {
      if (working) {
        if (nextWorkRoutineAt === 0) nextWorkRoutineAt = now + 3_500;
        if (now >= nextWorkRoutineAt) {
          activate(randomWorkRoutine());
          nextWorkRoutineAt = now + 3_500 + Math.random() * 2_500;
        }
      } else {
        const wanted = contextRoutine(pct);
        if (routine !== wanted) activate(wanted);
      }
    }

    if (now < nextFrameAt) return;
    paint(ctx);
    nextFrameAt = now + (routine === "idle" ? 1_200 : party?.crazy ? 90 : 160);
  };

  const startLoop = (ctx: ExtensionContext) => {
    currentCtx = ctx;
    if (timer) clearInterval(timer);
    tick();
    timer = setInterval(tick, 80);
  };
  const stopLoop = () => { if (timer) clearInterval(timer); timer = undefined; };

  const greet = (ctx: ExtensionContext) => {
    greeted = false;
    ctx.ui.setWidget("greeting", [
      ...banner("HELLO", "255;47;176"), ...banner(NAME, "0;234;255"),
      fg("138;127;176") + "  what can I help you with today?" + RESET,
    ], { placement: "aboveEditor" });
  };
  const ungreet = (ctx: ExtensionContext) => { if (greeted) return; greeted = true; ctx.ui.setWidget("greeting", undefined); };

  pi.on("session_start", async (_e, ctx) => {
    compactions = 0;
    working = false;
    forcedUntil = 0;
    nextWorkRoutineAt = 0;
    compactingUntil = 0;
    activityFlash = undefined;
    party = undefined;
    subagentToolActive = false;
    liveSubagent = undefined;
    nextSubagentReadAt = 0;
    testToolCalls.clear();
    lastContextBand = contextBand(contextPercent(ctx));
    activate(contextRoutine(contextPercent(ctx)));
    if (enabled) { greet(ctx); startLoop(ctx); }
  });
  pi.on("agent_start", async (_e, ctx) => {
    currentCtx = ctx;
    working = true;
    ungreet(ctx);
    force(EFFORT_ROUTINES[ctx.thinkingLevel ?? "off"], 1_600);
    nextWorkRoutineAt = forcedUntil + 2_000;
  });
  pi.on("agent_settled", async (_e, ctx) => {
    currentCtx = ctx;
    working = false;
    forcedUntil = 0;
    nextWorkRoutineAt = 0;
    activate(contextRoutine(contextPercent(ctx)));
  });
  pi.on("thinking_level_select", async (event, ctx) => {
    currentCtx = ctx;
    force(EFFORT_ROUTINES[event.level], 1_400);
    nextWorkRoutineAt = forcedUntil + 2_000;
  });
  pi.on("session_before_compact", async (_e, ctx) => {
    currentCtx = ctx;
    compactingUntil = Date.now() + 60_000;
    force("magic", 1_200);
  });
  pi.on("session_compact", async (_e, ctx) => {
    currentCtx = ctx;
    compactingUntil = 0;
    compactions++;
    lastContextBand = contextBand(contextPercent(ctx));
    force("confetti", 1_400);
  });
  pi.on("tool_execution_start", async (event, ctx) => {
    currentCtx = ctx;
    if (event.toolName === "subagent" && isSubagentRun(event.args)) {
      subagentToolActive = true;
      liveSubagent = undefined;
      nextSubagentReadAt = 0;
      force("flag", 1_200);
      return;
    }
    if (isTestCommand(event.toolName, event.args)) {
      testToolCalls.add(event.toolCallId);
      force("peek", 1_200);
    } else if (event.toolName === "edit" || event.toolName === "write") {
      force(event.toolName === "edit" ? "typing" : "paint", 800);
    } else if (/search|fetch|grokt|perplexity|query_bigquery|get_entry_metadata/.test(event.toolName)) {
      force("search", 800);
    }
  });
  pi.on("tool_execution_end", async (event, ctx) => {
    currentCtx = ctx;
    if (event.toolName === "subagent" && subagentToolActive) {
      subagentToolActive = false;
      liveSubagent = undefined;
      nextSubagentReadAt = 0;
      if (event.isError) {
        flashActivity("! agent failed", "error", 4_000);
        force("panic", 1_400);
      } else {
        flashActivity("✓ agents finished", "success", 2_000);
        force("cheer", 1_400);
      }
    }
    if (testToolCalls.delete(event.toolCallId)) {
      if (event.isError) {
        flashActivity("! tests failed", "error", 3_500);
        force("panic", 1_400);
      } else {
        force("cheer", 1_200);
      }
    }
  });
  pi.on("session_shutdown", async () => stopLoop());

  pi.registerCommand("mascot", {
    description: "Toggle the pixel π mascot + greeting",
    handler: async (_args, ctx) => {
      enabled = !enabled;
      currentCtx = ctx;
      if (!enabled) {
        stopLoop();
        ctx.ui.setWidget("mascot", undefined);
        ctx.ui.setWidget("greeting", undefined);
      } else {
        greet(ctx);
        activate(contextRoutine(contextPercent(ctx)));
        startLoop(ctx);
      }
      ctx.ui.notify(`mascot ${enabled ? "on" : "off"}`, "info");
    },
  });

  pi.registerCommand("mascot-color", {
    description: "Set mascot color: preset, #RRGGBB, random, default, or auto",
    getArgumentCompletions: (prefix) => {
      const values = [...COLOR_NAMES, "random", "auto", "default"];
      const matches = values.filter((value) => value.startsWith(prefix.toLowerCase())).map((value) => ({ value, label: value }));
      return matches.length ? matches : null;
    },
    handler: async (args, ctx) => {
      currentCtx = ctx;
      const value = args.trim().toLowerCase();
      if (!value) {
        ctx.ui.notify(`mascot color: ${colorName}${autoColor ? " (auto)" : ""}`, "info");
        return;
      }
      if (value === "auto") {
        autoColor = true;
        pickRandomColor();
        scheduleColor(Date.now());
      } else if (value === "random") {
        autoColor = false;
        pickRandomColor();
      } else if (value === "default") {
        autoColor = false;
        colorName = "blue";
        mascotColor = COLOR_PRESETS.blue;
      } else if (COLOR_PRESETS[value]) {
        autoColor = false;
        colorName = value;
        mascotColor = COLOR_PRESETS[value];
      } else {
        const custom = parseHexColor(value);
        if (!custom) {
          ctx.ui.notify(`unknown color; use ${COLOR_NAMES.join(", ")}, #RRGGBB, random, or auto`, "warning");
          return;
        }
        autoColor = false;
        colorName = value.toUpperCase();
        mascotColor = custom;
      }
      nextFrameAt = 0;
      tick();
      ctx.ui.notify(`mascot color: ${colorName}${autoColor ? " (auto)" : ""}`, "info");
    },
  });

  pi.registerCommand("dance", {
    description: "Dance marathon: mascot performs every routine once, in order",
    handler: async (_args, ctx) => {
      currentCtx = ctx;
      if (!enabled) {
        ctx.ui.notify("mascot is off — toggle it back on with /mascot", "warning");
        return;
      }
      startParty(false);
      ctx.ui.notify(`🕺 dance marathon — all ${NAMES.length} routines`, "info");
    },
  });

  pi.registerCommand("crazy", {
    description: "Crazy mode: fast dance marathon with rapid color changes",
    handler: async (_args, ctx) => {
      currentCtx = ctx;
      if (!enabled) {
        ctx.ui.notify("mascot is off — toggle it back on with /mascot", "warning");
        return;
      }
      startParty(true);
      ctx.ui.notify("🤪 CRAZY MODE", "info");
    },
  });

  pi.registerCommand("mascot-auto-color", {
    description: "Toggle occasional mascot color changes (or pass on/off)",
    getArgumentCompletions: (prefix) => {
      const matches = ["on", "off"].filter((value) => value.startsWith(prefix.toLowerCase())).map((value) => ({ value, label: value }));
      return matches.length ? matches : null;
    },
    handler: async (args, ctx) => {
      currentCtx = ctx;
      const value = args.trim().toLowerCase();
      if (value && value !== "on" && value !== "off") {
        ctx.ui.notify("usage: /mascot-auto-color [on|off]", "warning");
        return;
      }
      autoColor = value ? value === "on" : !autoColor;
      if (autoColor) { pickRandomColor(); scheduleColor(Date.now()); }
      else nextColorAt = 0;
      tick();
      ctx.ui.notify(`mascot auto-color ${autoColor ? "on" : "off"}`, "info");
    },
  });
}
