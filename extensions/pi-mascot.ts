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
 *   /doublepi                  toggle a second π dancing in sync
 *   /ultracrazy                three πs at once, different routines, colors flying
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
  peach: { body: "255;178;132", shadow: "184;128;95" },
  lavender: { body: "196;165;255", shadow: "141;119;184" },
  aqua: { body: "64;224;208", shadow: "46;161;150" },
  emerald: { body: "16;185;129", shadow: "12;133;93" },
  ruby: { body: "224;17;95", shadow: "161;12;68" },
  amber: { body: "255;191;0", shadow: "184;138;0" },
  plum: { body: "221;160;221", shadow: "159;115;159" },
  orchid: { body: "218;112;214", shadow: "157;81;154" },
  lemon: { body: "250;237;85", shadow: "180;171;61" },
  pumpkin: { body: "255;117;24", shadow: "184;84;17" },
  forest: { body: "46;160;67", shadow: "33;115;48" },
  ocean: { body: "24;144;216", shadow: "17;104;156" },
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
  | "balloon" | "yoyo" | "mic" | "camera" | "fishing" | "skate"
  | "drums" | "sax" | "violin" | "racket" | "paddle" | "campfire" | "flower";
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

  // Twenty-three tiny props power the extra routines without changing canvas size.
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
  } else if (p.prop === "drums") {
    b(3, 5, 6, 7, "O"); b(8, 10, 6, 7, "O");
    s(6, 5, "Y"); s(7, 5, "Y");
    s(phase % 2 ? 8 : 4, 4, "W");
  } else if (p.prop === "sax") {
    s(9, 4, "Y"); s(10, 5, "Y"); s(10, 6, "Y"); b(9, 11, 7, 7, "Y"); s(9, 5, "W");
  } else if (p.prop === "violin") {
    b(10, 13, 3, 3, "O"); s(11, 4, "O"); s(13, 2, "W");
    const bx = 8 + (phase % 2); b(bx, bx, 0, 2, "W");
  } else if (p.prop === "racket") {
    b(11, 13, 1, 2, "G"); b(12, 12, 3, 4, "W");
  } else if (p.prop === "paddle") {
    b(2, 11, 5, 5, "W");
    if (phase % 2) { b(1, 2, 4, 5, "O"); b(11, 12, 5, 7, "O"); }
    else { b(1, 2, 5, 7, "O"); b(11, 12, 4, 5, "O"); }
  } else if (p.prop === "campfire") {
    b(4, 9, 9, 9, "W"); b(5, 8, 8, 8, "O");
    if (phase % 2) { s(6, 7, "Y"); s(8, 7, "O"); }
    else { s(5, 7, "O"); s(7, 7, "Y"); }
  } else if (p.prop === "flower") {
    b(11, 13, 8, 8, "O"); b(12, 12, 6, 7, "G"); s(11, 7, "G"); s(12, 5, "Y");
    if (phase % 2) { s(11, 4, "N"); s(12, 3, "N"); s(13, 4, "N"); }
    else { s(11, 5, "N"); s(13, 5, "N"); s(12, 4, "N"); }
  }

  return render(g.map((r) => r.join("")), color);
}

// Side-by-side canvases for /doublepi and /ultracrazy (same five rows).
const joinArts = (arts: string[][]): string[] =>
  [0, 1, 2, 3, 4].map((row) => arts.map((a) => a[row] ?? "").join("   "));

// Original twelve + fourteen prop routines + eight more + thirty new + 154 more = 218 total.
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
  moonwalk: [{ step: 1, ox: 1, look: -1 }, { step: 0, oy: -1 }, { step: 1, ox: -1, look: -1 }, { step: 0, oy: -1, blink: true }],
  robot: [{ armL: "up", armR: "down", look: -1 }, { armR: "mid", blink: true }, { armL: "up", armR: "up", look: 1 }, { armR: "mid", oy: -1 }],
  salsa: [{ ox: -1, armL: "up", smile: true }, { ox: 1, armR: "up", oy: -1, smile: true }, { ox: -1, armR: "up", smile: true }, { ox: 1, armL: "up", oy: -1, smile: true }],
  headbang: [{ prop: "guitar", phase: 0, oy: 1, armR: "mid" }, { prop: "guitar", phase: 1, oy: -1, armL: "up" }, { prop: "guitar", phase: 0, oy: 1, blink: true }, { prop: "guitar", phase: 1, oy: -1, armL: "up", smile: true }],
  dj: [{ prop: "keyboard", phase: 0, armR: "up", notes: 0 }, { prop: "keyboard", phase: 1, armR: "mid", look: 1 }, { prop: "keyboard", phase: 0, armR: "up", notes: 2, smile: true }, { prop: "keyboard", phase: 1, armL: "up", look: -1 }],
  ballet: [{ oy: -2, armL: "up", armR: "up", smile: true }, { oy: -1, armL: "up", armR: "up", look: 1 }, { oy: -2, armL: "up", armR: "up", look: -1 }, { blink: true, smile: true }],
  hula: [{ ox: -1, armL: "up", armR: "mid", smile: true }, { armL: "up", armR: "up" }, { ox: 1, armL: "up", armR: "mid", smile: true }, { blink: true }],
  disco: [{ armR: "up", ox: 1, confetti: 0, smile: true }, { armL: "up", ox: -1, confetti: 1 }, { armR: "up", ox: 1, confetti: 2, oy: -1, smile: true }, { armL: "up", ox: -1, confetti: 3 }],
  drums: [{ prop: "drums", phase: 0, armL: "up" }, { prop: "drums", phase: 1, armR: "mid" }, { prop: "drums", phase: 0, armL: "up", blink: true }, { prop: "drums", phase: 1, oy: -1, armR: "mid", smile: true }],
  sax: [{ prop: "sax", phase: 0, notes: 0, look: 1 }, { prop: "sax", phase: 1, notes: 1, oy: -1 }, { prop: "sax", phase: 0, notes: 2, blink: true }, { prop: "sax", phase: 1, notes: 1, smile: true }],
  violin: [{ prop: "violin", phase: 0, armR: "mid", look: -1 }, { prop: "violin", phase: 1, armR: "up", look: 1 }, { prop: "violin", phase: 0, armR: "mid", notes: 0, blink: true }, { prop: "violin", phase: 1, armR: "mid", smile: true }],
  conductor: [{ prop: "wand", phase: 0, armR: "up", armL: "up", look: -1 }, { prop: "wand", phase: 1, armR: "mid" }, { prop: "wand", phase: 0, armR: "up", look: 1, notes: 1 }, { prop: "wand", phase: 1, armR: "mid", blink: true }],
  tennis: [{ prop: "racket", ball: 2, armR: "up", look: 1 }, { prop: "racket", ball: 5, oy: -1, armR: "up" }, { prop: "racket", ball: 7, armR: "mid", sweat: true, phase: 0 }, { prop: "racket", ball: 5, blink: true }],
  dunk: [{ ball: 8, armR: "down" }, { ball: 5, oy: -1, armR: "mid" }, { ball: 2, oy: -3, armL: "up", armR: "up", smile: true }, { ball: 8, blink: true }],
  soccer: [{ ball: 8, step: 0, look: 1 }, { ball: 7, step: 1, oy: -1, armR: "mid" }, { ball: 8, step: 0, sweat: true, phase: 1 }, { ball: 7, blink: true, smile: true }],
  boxing: [{ armR: "mid", ox: -1, sweat: true, phase: 0 }, { armR: "up", ox: 1, look: 1 }, { armL: "up", ox: -1, sweat: true, phase: 1 }, { armR: "mid", ox: 1, blink: true }],
  kayak: [{ prop: "paddle", phase: 0, sit: true, look: -1 }, { prop: "paddle", phase: 1, sit: true }, { prop: "paddle", phase: 0, sit: true, blink: true }, { prop: "paddle", phase: 1, sit: true, look: 1, smile: true }],
  surf: [{ prop: "skate", phase: 0, ox: -1, oy: -1, armL: "up" }, { prop: "skate", phase: 1, ox: 1, armR: "up" }, { prop: "skate", phase: 0, ox: -1, oy: -1, armL: "up", armR: "up", smile: true }, { prop: "skate", phase: 1, ox: 1, blink: true }],
  yoga: [{ armL: "up", armR: "up", oy: -1, blink: true }, { armL: "up", armR: "up", oy: -2, step: 1 }, { armL: "up", armR: "up", oy: -1, look: 1 }, { sit: true, blink: true, smile: true }],
  taichi: [{ armL: "up", armR: "mid", look: -1 }, { armL: "up", armR: "up" }, { armR: "up", look: 1, oy: -1 }, { armR: "mid", look: 1 }, { armL: "up", blink: true }, { smile: true }],
  campfire: [{ prop: "campfire", phase: 0, armR: "mid", smile: true }, { prop: "campfire", phase: 1, armR: "mid", blink: true }, { prop: "campfire", phase: 0, armL: "up", armR: "mid", look: 1 }, { prop: "campfire", phase: 1, smile: true }],
  stargaze: [{ prop: "search", phase: 0, armR: "up", look: 1 }, { prop: "search", phase: 1, armR: "up", look: 1, blink: true }, { prop: "search", phase: 0, armR: "up", look: 1, oy: -1 }, { prop: "search", phase: 1, armR: "up", look: 1, smile: true }],
  gardener: [{ prop: "flower", phase: 0, armR: "mid", look: 1 }, { prop: "flower", phase: 1, armR: "mid", smile: true }, { prop: "flower", phase: 0, blink: true }, { prop: "flower", phase: 1, armR: "up", smile: true }],
  butterfly: [{ look: -1, armR: "up", oy: -1 }, { look: 1, oy: -2, armL: "up", armR: "up" }, { look: 1, oy: -1, armR: "up", sweat: true, phase: 1 }, { look: -1, blink: true, smile: true }],
  sneeze: [{ blink: true, armL: "up" }, { oy: 1, blink: true, sweat: true, phase: 0 }, { oy: -1, armR: "up", confetti: 2 }, { blink: true, smile: true }],
  selfie: [{ prop: "camera", phase: 1, armL: "up", armR: "up", look: -1, smile: true }, { prop: "camera", phase: 0, armL: "up", armR: "up", smile: true }, { prop: "camera", phase: 1, armL: "up", oy: -1, smile: true }, { prop: "camera", phase: 0, armL: "up", blink: true }],
  beatbox: [{ prop: "mic", notes: 0, armL: "up", oy: -1 }, { prop: "mic", notes: 2, blink: true }, { prop: "mic", notes: 1, armL: "up", smile: true }, { prop: "mic", notes: 2, oy: -1, look: 1 }],
  lullaby: [{ sit: true, zzz: 0, notes: 0, blink: true }, { sit: true, zzz: 1, notes: 1, blink: true }, { sit: true, zzz: 2, notes: 2, blink: true }, { sit: true, zzz: 1, notes: 1, blink: true }],
  limbo: [{ sit: true, armL: "up", armR: "up", smile: true }, { sit: true, oy: 1, armL: "up", armR: "up", look: 1 }, { sit: true, armL: "up", armR: "up", sweat: true, phase: 0 }, { sit: true, oy: 1, armL: "up", armR: "up", blink: true }],
  parade: [{ flag: 0, step: 0, confetti: 1, smile: true }, { flag: 1, step: 1, oy: -1 }, { flag: 2, step: 0, confetti: 3 }, { flag: 1, step: 1, oy: -1, blink: true }],
  // ── 40 more dance styles ──
  tango: [{ ox: -1, armR: "mid", look: 1 }, { ox: 1, armL: "up", look: -1, oy: -1 }, { ox: -1, armR: "up", look: 1 }, { ox: 1, look: -1, blink: true }],
  waltz: [{ armL: "up", armR: "mid", ox: -1 }, { oy: -1, armL: "up", armR: "mid" }, { ox: 1, armL: "up", armR: "mid" }, { blink: true, armL: "up", armR: "mid" }],
  breakdance: [{ sit: true, look: -1 }, { sit: true, ox: -1, oy: -1, armL: "up" }, { sit: true, ox: 1, look: 1 }, { oy: -2, armL: "up", armR: "up", smile: true }],
  krump: [{ armL: "up", armR: "mid", ox: -1, sweat: true, phase: 0 }, { armR: "up", ox: 1, sweat: true, phase: 1 }, { armL: "up", armR: "up", oy: -1 }, { armR: "mid", blink: true }],
  vogue: [{ armR: "up", look: 1, smile: true }, { armL: "up", look: -1 }, { armR: "mid", armL: "up", look: 1 }, { blink: true, smile: true }],
  swing: [{ step: 0, ox: -1, armL: "up" }, { step: 1, oy: -1, armR: "mid" }, { step: 0, ox: 1, armR: "up" }, { step: 1, oy: -1, blink: true }],
  charleston: [{ step: 0, ox: -1, armR: "mid" }, { step: 1, armL: "up" }, { step: 0, ox: 1, armR: "mid" }, { step: 1, blink: true }],
  floss: [{ armL: "up", ox: -1, look: 1 }, { armR: "up", ox: 1, look: -1 }, { armL: "up", ox: -1 }, { armR: "up", ox: 1, blink: true }],
  dab: [{ armR: "up", look: -1, oy: -1 }, { armR: "up", look: -1, blink: true }, { armL: "up", look: 1, oy: -1 }, { blink: true, smile: true }],
  twist: [{ ox: -1, look: 1, armR: "mid" }, { ox: 1, look: -1, armL: "up" }, { ox: -1, look: 1 }, { ox: 1, blink: true }],
  macarena: [{ armR: "mid" }, { armL: "up" }, { armR: "up", armL: "up", smile: true }, { oy: -1, blink: true }],
  runningman: [{ step: 0, oy: -1, armR: "mid" }, { step: 1, ox: -1, armL: "up" }, { step: 0, oy: -1 }, { step: 1, ox: 1, blink: true }],
  polka: [{ step: 0, oy: -1, armL: "up", armR: "up" }, { step: 1, ox: 1, smile: true }, { step: 0, oy: -1 }, { step: 1, ox: -1, blink: true }],
  jig: [{ oy: -1, step: 0 }, { oy: -1, step: 1, ox: 1 }, { oy: -1, step: 0, smile: true }, { blink: true }],
  tapdance: [{ step: 0, armR: "mid", smile: true }, { step: 1, armL: "up" }, { step: 0, oy: -1 }, { step: 1, blink: true, smile: true }],
  flamenco: [{ armR: "up", look: 1, step: 0 }, { armL: "up", look: -1, step: 1, oy: -1 }, { armR: "up", armL: "up", smile: true }, { blink: true, look: 1 }],
  bhangra: [{ armL: "up", armR: "up", oy: -1, smile: true }, { armL: "up", armR: "up", ox: 1 }, { armL: "up", armR: "up", oy: -2 }, { armL: "up", armR: "up", blink: true }],
  cossack: [{ sit: true, step: 0, ox: -1, armL: "up", armR: "up" }, { sit: true, step: 1, ox: 1 }, { sit: true, oy: -1, smile: true }, { sit: true, blink: true }],
  cancan: [{ step: 1, oy: -2, armL: "up", armR: "up", smile: true }, { step: 0, armL: "up", armR: "up" }, { step: 1, oy: -2 }, { step: 0, blink: true, smile: true }],
  mambo: [{ ox: -1, step: 0, armR: "mid", smile: true }, { ox: 1, step: 1, oy: -1 }, { ox: -1, armL: "up" }, { ox: 1, blink: true }],
  chacha: [{ step: 0, ox: -1, smile: true }, { step: 1 }, { step: 0, ox: 1, armR: "mid" }, { step: 1, blink: true }],
  rumba: [{ ox: -1, armR: "up", look: 1 }, { oy: -1, armL: "up" }, { ox: 1, armR: "mid" }, { blink: true, smile: true }],
  quickstep: [{ step: 0, ox: 1, oy: -1 }, { step: 1, ox: -1, armL: "up" }, { step: 0, ox: 1 }, { step: 1, blink: true }],
  twostep: [{ step: 0, ox: -1, armR: "mid" }, { step: 1, ox: -1 }, { step: 0, ox: 1, armL: "up" }, { step: 1, blink: true }],
  linedance: [{ step: 0, armL: "up" }, { step: 1, armR: "up" }, { step: 0, oy: -1, smile: true }, { step: 1, blink: true }],
  squaredance: [{ ox: -1, armR: "mid", step: 0 }, { oy: -1, armL: "up", armR: "up" }, { ox: 1, step: 1 }, { blink: true, smile: true }],
  cumbia: [{ ox: -1, armR: "up", smile: true }, { ox: 1, armL: "up", oy: -1 }, { ox: -1, armR: "mid" }, { ox: 1, blink: true }],
  reggaeton: [{ oy: -1, armR: "mid", ox: -1 }, { oy: -2, armR: "up", smile: true }, { oy: -1, ox: 1 }, { blink: true, armL: "up" }],
  house: [{ step: 0, oy: -1, armR: "up" }, { step: 1, ox: 1 }, { step: 0, oy: -1, armL: "up" }, { step: 1, blink: true, smile: true }],
  locking: [{ armR: "up", look: 1, smile: true }, { armR: "mid", blink: true }, { armL: "up", look: -1 }, { blink: true, smile: true }],
  popping: [{ armR: "mid", blink: true }, { oy: -1, armL: "up" }, { armR: "up", look: 1 }, { blink: true }],
  waacking: [{ armR: "up", oy: -1, look: 1 }, { armL: "up", look: -1 }, { armR: "up", armL: "up" }, { blink: true, smile: true }],
  tutting: [{ armR: "mid", armL: "up", look: 1 }, { armR: "up" }, { armR: "mid", look: -1 }, { blink: true }],
  shuffle: [{ step: 0, ox: -1, oy: -1 }, { step: 1, ox: 1, armR: "mid" }, { step: 0, ox: -1 }, { step: 1, blink: true, smile: true }],
  jumpstyle: [{ oy: -2, step: 0, armL: "up", armR: "up" }, { oy: -1, step: 1 }, { oy: -2, ox: 1, smile: true }, { blink: true }],
  skank: [{ step: 0, armR: "mid", look: 1 }, { step: 1, armL: "up" }, { step: 0, armR: "mid", oy: -1 }, { step: 1, blink: true }],
  moshpit: [{ ox: -1, oy: -1, sweat: true, phase: 0, armL: "up", armR: "up" }, { ox: 1, oy: -2, sweat: true, phase: 1 }, { ox: -1, armL: "up", armR: "up" }, { blink: true, sweat: true, phase: 0 }],
  slowdance: [{ ox: -1, armL: "up", armR: "mid", blink: true }, { oy: -1, armL: "up", armR: "mid" }, { ox: 1, armL: "up", armR: "mid" }, { blink: true, smile: true }],
  conga: [{ step: 0, ox: -1, armR: "up", smile: true }, { step: 1, confetti: 1, oy: -1 }, { step: 0, ox: 1, armL: "up" }, { step: 1, blink: true }],
  bollywood: [{ armR: "up", oy: -1, look: 1, smile: true }, { armL: "up", ox: -1 }, { armR: "up", armL: "up", oy: -2, smile: true }, { blink: true, look: -1 }],
  // ── 40 sports ──
  golf: [{ armR: "mid", look: 1 }, { armR: "up", oy: -1 }, { armR: "mid", look: 1, blink: true }, { smile: true, look: 1 }],
  baseball: [{ armR: "up", oy: -1, look: 1 }, { armR: "mid", ox: 1 }, { armR: "up", blink: true }, { smile: true }],
  cricket: [{ armL: "up", armR: "mid", look: 1 }, { armR: "up", oy: -1 }, { armL: "up", blink: true }, { smile: true, armR: "mid" }],
  archery: [{ armL: "up", armR: "mid", look: 1 }, { armR: "mid", look: 1, blink: true }, { armL: "up", oy: -1 }, { smile: true, look: 1 }],
  bowling: [{ armR: "mid", ox: -1, step: 0 }, { step: 1, oy: -1 }, { armR: "mid", look: 1 }, { blink: true, smile: true }],
  fencing: [{ armR: "mid", ox: 1, oy: -1, look: 1 }, { armR: "up", ox: -1 }, { armR: "mid", ox: 1, blink: true }, { look: 1 }],
  javelin: [{ armR: "up", oy: -1, look: 1 }, { armR: "mid", oy: -2, smile: true }, { armR: "up", blink: true }, { look: 1 }],
  shotput: [{ lift: "down", oy: 1 }, { lift: "up", oy: -1, smile: true }, { lift: "mid" }, { blink: true }],
  discus: [{ look: -1, ox: -1, armR: "mid" }, { look: 1, ox: 1, armR: "up" }, { oy: -1, armR: "up", smile: true }, { blink: true }],
  highjump: [{ oy: -1 }, { oy: -3, armL: "up", armR: "up" }, { oy: -2, blink: true }, { oy: -1, smile: true }],
  hurdles: [{ step: 0, oy: -1 }, { step: 1, oy: -2, armR: "mid" }, { step: 0, oy: -1 }, { step: 1, blink: true }],
  sprint: [{ step: 0, ox: 1, sweat: true, phase: 0 }, { step: 1, ox: -1, armR: "mid" }, { step: 0, ox: 1, sweat: true, phase: 1 }, { step: 1, blink: true }],
  swim: [{ armL: "up", oy: -1 }, { armR: "up", blink: true }, { armL: "up", oy: -1, look: 1 }, { armR: "up", smile: true }],
  dive: [{ oy: -3, armL: "up", armR: "up" }, { oy: -2, blink: true }, { oy: -1 }, { smile: true }],
  rowing: [{ prop: "paddle", phase: 0, sit: true, armR: "mid" }, { prop: "paddle", phase: 1, sit: true }, { prop: "paddle", phase: 0, sit: true, blink: true }, { prop: "paddle", phase: 1, sit: true, smile: true }],
  cycling: [{ sit: true, step: 0, armR: "mid" }, { sit: true, step: 1, sweat: true, phase: 1 }, { sit: true, oy: -1 }, { sit: true, blink: true }],
  bmx: [{ prop: "skate", phase: 0, oy: -2, armL: "up" }, { prop: "skate", phase: 1, oy: -3, smile: true }, { prop: "skate", phase: 0, oy: -1 }, { prop: "skate", phase: 1, blink: true }],
  scooter: [{ prop: "skate", phase: 0, step: 0, ox: 1 }, { prop: "skate", phase: 1, step: 1, oy: -1 }, { prop: "skate", phase: 0, ox: -1 }, { prop: "skate", phase: 1, blink: true }],
  rollerskate: [{ prop: "skate", phase: 0, ox: -1, armL: "up", armR: "up" }, { prop: "skate", phase: 1, ox: 1, oy: -1 }, { prop: "skate", phase: 0, armL: "up", armR: "up", smile: true }, { prop: "skate", phase: 1, blink: true }],
  iceskate: [{ prop: "skate", phase: 0, oy: -1, armL: "up", armR: "mid" }, { prop: "skate", phase: 1, ox: 1, armR: "up" }, { prop: "skate", phase: 0, oy: -2, smile: true }, { prop: "skate", phase: 1, blink: true }],
  ski: [{ oy: -1, armL: "up", armR: "mid", ox: -1 }, { ox: 1 }, { oy: -1, armR: "mid", smile: true }, { blink: true, oy: -1 }],
  snowboard: [{ prop: "skate", phase: 0, ox: -1, armR: "up" }, { prop: "skate", phase: 1, oy: -2, armL: "up" }, { prop: "skate", phase: 0, ox: 1, smile: true }, { prop: "skate", phase: 1, blink: true }],
  sled: [{ sit: true, oy: -1, armL: "up", armR: "up", smile: true }, { sit: true, oy: -2 }, { sit: true, oy: -1, blink: true }, { sit: true, smile: true }],
  climb: [{ armR: "up", oy: -1, look: 1 }, { armL: "up", oy: -2 }, { armR: "up", oy: -1, blink: true }, { armL: "up", smile: true }],
  volleyball: [{ armL: "up", armR: "up", ball: 2 }, { ball: 5, oy: -1, armL: "up", armR: "up" }, { ball: 7, blink: true }, { ball: 4, smile: true, oy: -2 }],
  pingpong: [{ prop: "racket", armR: "mid", look: 1, ball: 5 }, { prop: "racket", armR: "up", oy: -1, ball: 4 }, { prop: "racket", armR: "mid", blink: true, ball: 6 }, { prop: "racket", smile: true, ball: 5 }],
  badminton: [{ prop: "racket", armR: "up", ball: 1, look: 1 }, { prop: "racket", oy: -2, armR: "up", ball: 3 }, { prop: "racket", armR: "mid", blink: true }, { prop: "racket", smile: true }],
  squash: [{ prop: "racket", armR: "mid", ox: -1, ball: 6 }, { prop: "racket", ox: 1, oy: -1, ball: 5 }, { prop: "racket", armR: "up", blink: true }, { prop: "racket", sweat: true, phase: 1 }],
  handball: [{ ball: 5, armR: "up", oy: -1 }, { ball: 2, armR: "mid", ox: 1 }, { ball: 7, blink: true }, { ball: 5, smile: true }],
  rugby: [{ ball: 6, step: 0, ox: -1, sweat: true, phase: 0 }, { ball: 6, step: 1, ox: 1 }, { ball: 6, step: 0, oy: -1 }, { ball: 6, blink: true }],
  quarterback: [{ ball: 4, armR: "up", oy: -1, look: 1 }, { ball: 1, armR: "mid", smile: true }, { ball: 6, blink: true }, { ball: 4, look: 1 }],
  cheerlead: [{ armL: "up", armR: "up", confetti: 0, smile: true }, { confetti: 2, oy: -1, armL: "up", armR: "up" }, { confetti: 1, armL: "up", armR: "up" }, { confetti: 3, blink: true, smile: true }],
  sumo: [{ step: 0, armL: "up", armR: "up", oy: -1 }, { step: 1, oy: 1, sweat: true, phase: 0 }, { step: 0, armL: "up", armR: "up" }, { step: 1, blink: true }],
  karate: [{ armR: "up", oy: -1, look: 1 }, { armR: "mid", ox: 1 }, { armL: "up", blink: true }, { armR: "up", smile: true }],
  judo: [{ ox: -1, armL: "up", armR: "mid" }, { oy: -1, armR: "up" }, { ox: 1, blink: true }, { smile: true }],
  kungfu: [{ ox: -1, armR: "mid", look: 1, oy: -1 }, { ox: 1, armL: "up", oy: -1 }, { ox: -1, armR: "up" }, { blink: true }],
  capoeira: [{ sit: true, ox: -1, armR: "up" }, { oy: -2, armL: "up", armR: "up" }, { sit: true, ox: 1, look: 1 }, { blink: true, smile: true }],
  kickbox: [{ step: 1, oy: -1, armR: "mid", sweat: true, phase: 0 }, { armR: "up", ox: 1 }, { step: 0, armL: "up" }, { blink: true }],
  darts: [{ armR: "mid", look: 1, blink: true }, { armR: "up", look: 1 }, { armR: "mid", smile: true }, { look: 1, blink: true }],
  billiards: [{ oy: 1, armR: "mid", look: 1 }, { oy: 1, blink: true }, { oy: -1, armR: "mid", smile: true }, { look: 1 }],
  // ── 25 music ──
  piano: [{ prop: "keyboard", phase: 0, armL: "up", armR: "mid", look: -1 }, { prop: "keyboard", phase: 1, ox: -1 }, { prop: "keyboard", phase: 0, ox: 1, blink: true }, { prop: "keyboard", phase: 1, smile: true }],
  cello: [{ prop: "violin", phase: 0, sit: true, armR: "mid", look: -1 }, { prop: "violin", phase: 1, sit: true, blink: true }, { prop: "violin", phase: 0, sit: true, notes: 1 }, { prop: "violin", phase: 1, sit: true, smile: true }],
  harp: [{ armL: "up", notes: 0, smile: true }, { armR: "up", notes: 1 }, { armL: "up", notes: 2, blink: true }, { armR: "up", notes: 1 }],
  trumpet: [{ notes: 0, armR: "mid", oy: -1 }, { notes: 1, armL: "up", blink: true }, { notes: 2, armR: "mid", smile: true }, { notes: 1 }],
  flute: [{ armL: "up", armR: "up", notes: 0, look: 1 }, { notes: 1, blink: true }, { armL: "up", armR: "up", notes: 2 }, { notes: 1, smile: true }],
  banjo: [{ prop: "guitar", phase: 0, armR: "mid", ox: -1, smile: true }, { prop: "guitar", phase: 1, step: 0 }, { prop: "guitar", phase: 0, oy: -1 }, { prop: "guitar", phase: 1, blink: true }],
  ukulele: [{ prop: "guitar", phase: 0, oy: -1, smile: true }, { prop: "guitar", phase: 1, ox: 1 }, { prop: "guitar", phase: 0, oy: -1, blink: true }, { prop: "guitar", phase: 1, armL: "up" }],
  harmonica: [{ armL: "up", armR: "mid", notes: 0, ox: -1 }, { notes: 1, ox: 1 }, { armL: "up", notes: 2, blink: true }, { notes: 1, smile: true }],
  accordion: [{ armL: "up", armR: "up", ox: -1, notes: 0 }, { armR: "mid", ox: 1, notes: 1 }, { armL: "up", armR: "up", notes: 2 }, { blink: true, notes: 1 }],
  tuba: [{ notes: 0, oy: 1, armR: "mid" }, { notes: 2, oy: -1, armL: "up" }, { notes: 1, blink: true }, { notes: 0, smile: true }],
  bongo: [{ prop: "drums", phase: 0, sit: true, armL: "up" }, { prop: "drums", phase: 1, sit: true, armR: "mid" }, { prop: "drums", phase: 0, sit: true, blink: true }, { prop: "drums", phase: 1, sit: true, smile: true }],
  triangle: [{ armR: "up", look: 1, smile: true }, { armR: "up", blink: true }, { armR: "mid", notes: 0 }, { armR: "up", notes: 1 }],
  cowbell: [{ armR: "mid", notes: 0, smile: true }, { armR: "up", notes: 1 }, { armR: "mid", oy: -1 }, { blink: true, notes: 2 }],
  karaoke: [{ prop: "mic", notes: 0, armL: "up", smile: true }, { prop: "mic", notes: 1, confetti: 1 }, { prop: "mic", notes: 2, blink: true }, { prop: "mic", notes: 1, oy: -1, smile: true }],
  opera: [{ armL: "up", armR: "up", notes: 0, oy: -1 }, { notes: 2, blink: true }, { armL: "up", armR: "up", notes: 1, smile: true }, { notes: 2, oy: -1 }],
  choir: [{ prop: "book", ox: -1, blink: true }, { prop: "book", notes: 1 }, { prop: "book", ox: 1, smile: true }, { prop: "book", blink: true }],
  bagpipes: [{ notes: 0, step: 0, armR: "mid", ox: -1 }, { notes: 1, step: 1, oy: -1 }, { notes: 2, step: 0, ox: 1 }, { notes: 1, blink: true }],
  sitar: [{ prop: "guitar", phase: 0, sit: true, look: 1 }, { prop: "guitar", phase: 1, sit: true, notes: 1 }, { prop: "guitar", phase: 0, sit: true, blink: true }, { prop: "guitar", phase: 1, sit: true, smile: true }],
  keytar: [{ prop: "keyboard", phase: 0, step: 0, ox: -1, smile: true }, { prop: "keyboard", phase: 1, step: 1, oy: -1 }, { prop: "keyboard", phase: 0, ox: 1 }, { prop: "keyboard", phase: 1, blink: true }],
  turntable: [{ prop: "keyboard", phase: 0, armR: "mid", look: 1 }, { prop: "keyboard", phase: 1, armR: "up" }, { prop: "keyboard", phase: 0, blink: true }, { prop: "keyboard", phase: 1, notes: 2, smile: true }],
  drumroll: [{ prop: "drums", phase: 0, armL: "up", armR: "mid" }, { prop: "drums", phase: 1, armR: "mid" }, { prop: "drums", phase: 0, armL: "up" }, { prop: "drums", phase: 1, oy: -1, blink: true }],
  airguitar: [{ oy: -1, armR: "mid", look: -1, smile: true }, { oy: -2, armL: "up" }, { oy: -1, armR: "up" }, { blink: true, smile: true }],
  humming: [{ notes: 0, ox: -1, blink: true }, { notes: 1, ox: 1 }, { notes: 2, blink: true, smile: true }, { notes: 1 }],
  whistling: [{ notes: 0, step: 0, ox: -1 }, { notes: 1, step: 1, oy: -1 }, { notes: 2, step: 0, ox: 1 }, { notes: 1, step: 1, blink: true }],
  rapbattle: [{ prop: "mic", notes: 2, armR: "up", ox: -1 }, { prop: "mic", notes: 0, armL: "up", ox: 1 }, { prop: "mic", notes: 1, oy: -1 }, { prop: "mic", blink: true, smile: true }],
  // ── 25 jobs & characters ──
  chef: [{ armR: "up", oy: -1, smile: true }, { armR: "mid", blink: true }, { armL: "up", oy: -1 }, { armR: "mid", smile: true }],
  baker: [{ oy: 1, armR: "mid" }, { blink: true }, { oy: 1, armL: "up" }, { smile: true }],
  barista: [{ prop: "coffee", phase: 0, armR: "up", look: 1 }, { prop: "coffee", phase: 1, armR: "mid" }, { prop: "coffee", phase: 0, blink: true }, { prop: "coffee", phase: 1, smile: true }],
  farmer: [{ prop: "flower", phase: 0, oy: 1, armR: "mid" }, { prop: "flower", phase: 1, oy: -1 }, { prop: "flower", phase: 0, blink: true }, { prop: "flower", phase: 1, smile: true }],
  carpenter: [{ armR: "up", oy: -1 }, { armR: "mid" }, { armR: "up", blink: true }, { armR: "mid", smile: true }],
  mechanic: [{ oy: 1, armR: "mid", look: 1 }, { oy: 1, blink: true }, { armR: "up" }, { smile: true }],
  welder: [{ oy: 1, confetti: 1, armR: "mid" }, { oy: 1, confetti: 2, blink: true }, { armR: "mid" }, { smile: true }],
  tailor: [{ armR: "mid", look: 1, blink: true }, { armL: "up", look: -1 }, { armR: "mid" }, { blink: true, smile: true }],
  barber: [{ armR: "mid", look: 1 }, { armR: "up", blink: true }, { armL: "up", look: -1 }, { smile: true }],
  doctor: [{ prop: "book", look: 1, armR: "mid" }, { prop: "book", blink: true }, { prop: "book", look: -1 }, { prop: "book", smile: true }],
  teacher: [{ prop: "book", armR: "up", look: 1 }, { prop: "book", armR: "mid", blink: true }, { prop: "book", armR: "up", smile: true }, { prop: "book", look: -1 }],
  scientist: [{ prop: "search", phase: 0, think: true, look: 1 }, { prop: "search", phase: 1, blink: true }, { prop: "search", phase: 0, think: true, smile: true }, { prop: "search", phase: 1 }],
  detective: [{ prop: "search", phase: 0, oy: 1, look: -1 }, { prop: "search", phase: 1, oy: 1, look: 1 }, { prop: "search", phase: 0, blink: true }, { prop: "search", phase: 1, smile: true }],
  spy: [{ oy: 2, look: -1 }, { oy: 1, step: 0, ox: -1 }, { oy: 2, look: 1 }, { oy: 1, blink: true }],
  ninja: [{ ox: -1, oy: -2, armR: "up" }, { ox: 1, armL: "up" }, { ox: -1, oy: -1, blink: true }, { ox: 1, smile: true }],
  pirate: [{ flag: 0, armR: "mid", look: 1 }, { flag: 1, oy: -1 }, { flag: 2, blink: true }, { flag: 1, smile: true }],
  cowboy: [{ armR: "up", step: 0, ox: -1 }, { armR: "up", step: 1, oy: -1 }, { armR: "up", ox: 1 }, { armR: "mid", blink: true, smile: true }],
  knight: [{ lift: "mid", flag: 1 }, { lift: "up", oy: -1 }, { lift: "mid", blink: true }, { lift: "up", smile: true }],
  witch: [{ prop: "wand", phase: 0, bubble: 0 }, { prop: "wand", phase: 1, bubble: 1 }, { prop: "wand", phase: 0, bubble: 2, blink: true }, { prop: "wand", phase: 1, smile: true }],
  vampire: [{ armL: "up", armR: "up", look: 1, oy: -1 }, { blink: true, armL: "up", armR: "up" }, { oy: -2, armL: "up", armR: "up" }, { smile: true }],
  zombie: [{ armR: "mid", step: 0, ox: -1, look: -1 }, { armR: "mid", step: 1, ox: 1 }, { armR: "mid", blink: true }, { armR: "mid", oy: -1 }],
  ghost: [{ oy: -1, blink: true }, { oy: -2, armL: "up", armR: "up" }, { oy: -3, blink: true }, { oy: -1, smile: true }],
  superhero: [{ oy: -2, armR: "up", look: 1, smile: true }, { oy: -3, armR: "up" }, { oy: -2, armR: "up", blink: true }, { oy: -1, armR: "up", smile: true }],
  clown: [{ juggle: 0, armL: "up", armR: "up", confetti: 0, smile: true }, { juggle: 2, armL: "up", armR: "up", confetti: 1 }, { juggle: 1, blink: true }, { juggle: 3, smile: true }],
  mime: [{ armL: "up", armR: "up", ox: -1, look: 1 }, { armL: "up", armR: "up", ox: 1, look: -1 }, { armL: "up", armR: "up", blink: true }, { armL: "up", armR: "up", oy: -1 }],
  acrobat: [{ oy: -3, armL: "up", armR: "up" }, { oy: -2, look: 1 }, { oy: -3, blink: true }, { oy: -1, smile: true }],
  unicycle: [{ sit: true, oy: -1, armL: "up", armR: "up" }, { sit: true, ox: -1, armL: "up", armR: "up" }, { sit: true, ox: 1, blink: true }, { sit: true, smile: true }],
  stilts: [{ oy: -2, ox: -1, armL: "up", armR: "up" }, { oy: -2, ox: 1 }, { oy: -2, blink: true }, { oy: -1, smile: true }],
  firebreather: [{ armR: "up", confetti: 0, oy: -1 }, { confetti: 2, blink: true }, { armR: "up", confetti: 3 }, { smile: true }],
  // ── 20 misc / games / food / weather ──
  chess: [{ think: true, look: 1 }, { think: true, armR: "mid", blink: true }, { think: true }, { think: true, smile: true }],
  cards: [{ armR: "mid", look: -1 }, { armR: "mid", look: 1, blink: true }, { armR: "mid", smile: true }, { blink: true }],
  dice: [{ armR: "mid", oy: -1 }, { armR: "up", confetti: 1 }, { armR: "mid", blink: true }, { smile: true, confetti: 2 }],
  rubiks: [{ look: -1, armR: "mid" }, { look: 1, blink: true }, { armL: "up" }, { smile: true }],
  videogame: [{ prop: "keyboard", phase: 0, look: 1, oy: -1 }, { prop: "keyboard", phase: 1, ox: -1 }, { prop: "keyboard", phase: 0, blink: true }, { prop: "keyboard", phase: 1, smile: true }],
  pinball: [{ ox: -1, oy: -1, confetti: 0 }, { ox: 1, oy: -2, confetti: 1 }, { ox: -1, oy: -1, blink: true }, { ox: 1, smile: true }],
  trampoline: [{ oy: -1 }, { oy: -3, armL: "up", armR: "up", smile: true }, { oy: -1 }, { oy: 1, blink: true }],
  swings: [{ sit: true, ox: -1, oy: -1 }, { sit: true, ox: 1, oy: -2 }, { sit: true, ox: -1, blink: true }, { sit: true, ox: 1, smile: true }],
  snowball: [{ armR: "up", oy: -1 }, { armR: "mid", confetti: 3 }, { blink: true }, { smile: true }],
  snowman: [{ oy: 1, armR: "mid" }, { blink: true }, { oy: -1, armL: "up", armR: "up" }, { smile: true }],
  rainbow: [{ confetti: 0, armL: "up", armR: "up", smile: true }, { confetti: 1 }, { confetti: 2, blink: true }, { confetti: 3, smile: true }],
  tornado: [{ look: -1, oy: -1, ox: -1 }, { look: 1, oy: -2, ox: 1 }, { look: -1, oy: -1, blink: true }, { look: 1, smile: true }],
  autumn: [{ confetti: 2, ox: -1, armR: "up" }, { confetti: 3, ox: 1 }, { confetti: 1, blink: true }, { confetti: 0, smile: true }],
  pizza: [{ armR: "up", oy: -1, smile: true }, { armL: "up", oy: -2 }, { armR: "up", blink: true }, { smile: true }],
  sushi: [{ armR: "mid", look: 1, blink: true }, { armL: "up", look: -1 }, { armR: "mid" }, { smile: true }],
  pancake: [{ armR: "mid" }, { armR: "up", oy: -2, blink: true }, { armR: "mid", oy: -1 }, { smile: true }],
  popcorn: [{ confetti: 0, oy: -1 }, { confetti: 2, oy: -2, blink: true }, { confetti: 1, oy: -1 }, { confetti: 3, smile: true }],
  icecream: [{ prop: "heart", phase: 0, smile: true, look: 1 }, { prop: "heart", phase: 1, blink: true }, { prop: "heart", phase: 0, oy: -1 }, { prop: "heart", phase: 1, smile: true }],
  birthday: [{ prop: "balloon", phase: 0, confetti: 1, smile: true }, { prop: "balloon", phase: 1, confetti: 2, oy: -1 }, { prop: "balloon", phase: 0, blink: true }, { prop: "balloon", phase: 1, confetti: 3, smile: true }],
  toast: [{ prop: "coffee", phase: 0, armR: "up", smile: true }, { prop: "coffee", phase: 1, oy: -1 }, { prop: "coffee", phase: 0, armR: "up", blink: true }, { prop: "coffee", phase: 1, smile: true }],
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
  let ultra: { remaining: number; nextSwitchAt: number; nextColorAt: number; triple: RoutineName[] } | undefined;
  let ultraColors: string[] = [];
  let doublePi = false;
  let doubleColor = "pink";
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
    if (party || ultra) return; // a marathon owns the stage until it ends
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

  const pickDistinctColors = (n: number): string[] => {
    const pool = COLOR_NAMES.filter((name) => name !== colorName);
    const out: string[] = [];
    while (out.length < n && pool.length > 0) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
    return out;
  };
  const startUltra = () => {
    party = undefined;
    ultra = { remaining: NAMES.length, nextSwitchAt: 0, nextColorAt: 0, triple: NAMES.slice(0, 3) };
    ultraColors = pickDistinctColors(3);
    forcedUntil = 0;
    tick();
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
    let art: string[];
    if (ultra) {
      art = joinArts(ultra.triple.map((name, i) => {
        const up = ROUTINES[name] ?? IDLE;
        const upose = up[frameIndex % up.length] ?? {};
        return frame({ ...upose, look: upose.look ?? ctxLook(ctx) }, COLOR_PRESETS[ultraColors[i] ?? "blue"] ?? mascotColor);
      }));
      frameIndex++;
    } else {
      const poses = routine === "idle" ? IDLE : ROUTINES[routine];
      const pose = poses[frameIndex++ % poses.length];
      const single = frame({ ...pose, look: pose.look ?? ctxLook(ctx) }, mascotColor);
      art = doublePi ? joinArts([single, frame({ ...pose, look: pose.look ?? ctxLook(ctx) }, COLOR_PRESETS[doubleColor] ?? mascotColor)]) : single;
    }
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

    if (ultra) {
      if (now >= ultra.nextSwitchAt) {
        if (ultra.remaining <= 0) {
          ultra = undefined;
          activate(contextRoutine(pct));
          force("confetti", 1_600);
        } else {
          const base = NAMES.length - ultra.remaining;
          ultra.triple = [0, 1, 2].map((i) => NAMES[(base + i) % NAMES.length] ?? "dance");
          ultra.remaining -= 3;
          ultra.nextSwitchAt = now + 800;
        }
      }
      if (ultra && now >= ultra.nextColorAt) {
        ultraColors = pickDistinctColors(3);
        ultra.nextColorAt = now + 250 + Math.random() * 300;
      }
    } else if (party) {
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
          if (doublePi) doubleColor = pickDistinctColors(1)[0] ?? "pink"; // partner gets a fresh color each new routine
        }
      } else {
        const wanted = contextRoutine(pct);
        if (routine !== wanted) activate(wanted);
      }
    }

    if (now < nextFrameAt) return;
    paint(ctx);
    nextFrameAt = now + (routine === "idle" ? 1_200 : party?.crazy || ultra ? 90 : 160);
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
    ultra = undefined;
    ultraColors = [];
    doublePi = false;
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

  pi.registerCommand("doublepi", {
    description: "Toggle a second π mascot dancing in sync alongside the first",
    handler: async (_args, ctx) => {
      currentCtx = ctx;
      if (!enabled) {
        ctx.ui.notify("mascot is off — toggle it back on with /mascot", "warning");
        return;
      }
      doublePi = !doublePi;
      if (doublePi) doubleColor = pickDistinctColors(1)[0] ?? "pink";
      nextFrameAt = 0;
      tick();
      ctx.ui.notify(doublePi ? "ππ double pi — dancing together" : "back to one π", "info");
    },
  });

  pi.registerCommand("ultracrazy", {
    description: "Ultra crazy: three πs at once, each on its own routine, colors flying",
    handler: async (_args, ctx) => {
      currentCtx = ctx;
      if (!enabled) {
        ctx.ui.notify("mascot is off — toggle it back on with /mascot", "warning");
        return;
      }
      startUltra();
      ctx.ui.notify("🤪🤪🤪 ULTRA CRAZY — three πs at once", "info");
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
