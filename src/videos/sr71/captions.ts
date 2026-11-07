// Word-by-word captions in the reference "documentary-cartoon" style: 1-3 words centred in the lower
// third, heavy white caps with a black halo, the word being spoken in yellow; every word pops in on the
// frame it is spoken. Timing lives in two pure functions (wordsFromLine, captionAt) so a given t always
// renders the same pixels: no clocks, no randomness, no animation state carried between frames.
// The component is a plain absolutely-positioned div rather than Remotion's AbsoluteFill, so this module
// imports nothing but React and its timing functions stay runnable in node without a Remotion runtime.
// It is built with React.createElement, not JSX: this module's path is captions.ts and .ts may not
// contain JSX syntax (tsc rejects it outright).
import React from "react";

export interface Word { text: string; start: number; end: number; } // seconds

// ---------------------------------------------------------------- timing

/** Pop length (s): the new word swells 1.0 -> 1.08 -> 1.0 inside this window, then holds at 1.0. */
const POP = 0.12;
/** At most three words on screen; the oldest scrolls off as the fourth arrives. */
const MAX_WORDS = 3;
/** A gap longer than this between one word's end and the next word's start starts a new run (a new
 *  spoken line). wordsFromLine tiles a line with zero gaps, so anything this wide is a beat break and
 *  the caption window must not reach back across it ("PURPOSE. THIS" is not a phrase). */
const RUN_GAP = 0.05;

/** Speech weight: letters and digits only, so "3.2" weighs ~two characters rather than four. */
const letters = (s: string) => (s.match(/[\p{L}\p{N}]/gu) ?? []).length;

/** Extra weight for the pause that follows a word: a full stop holds the highlight ~3x longer than a
 *  comma, which is what makes the caption read at sentence rhythm instead of ticking. */
const pauseAfter = (w: string): number => {
  const t = w.replace(/["'”’»)\]]+$/, ""); // a quoted full stop (drips.") still ends the sentence
  if (/[.!?…]$/.test(t)) return 1.6;
  if (/[,;:—–-]$/.test(t)) return 0.8;
  return 0;
};

/**
 * Split a spoken line into words with proportional timings across [start, end].
 *
 * A word's slot is `1 + 0.55 * letters`, so "thousand" is held ~3.5x longer than "a", plus the pause
 * bonus above. The final word gets no pause bonus: the tail of the line is silence, not a longer word,
 * and stretching it would squeeze the words that are actually spoken. Slots tile [start, end] exactly —
 * the last word's end is `end` to the float, so `captionAt` never sees a phantom gap mid-line.
 */
export function wordsFromLine(line: string, start: number, end: number): Word[] {
  const toks = line.split(/\s+/).filter((s) => s.length > 0 && letters(s) > 0); // drop lone dashes/quotes
  if (toks.length === 0) return [];
  const span = Math.max(0, end - start);
  const w = toks.map((s, i) => 1 + 0.55 * letters(s) + (i < toks.length - 1 ? pauseAfter(s) : 0));
  const total = w.reduce((a, b) => a + b, 0);

  const out: Word[] = [];
  let cur = start;
  let cum = 0;
  for (let i = 0; i < toks.length; i++) {
    cum += w[i];
    // the last word lands on `end` exactly; the rest are pinned to the running sum so the line tiles
    const e = i === toks.length - 1 ? start + span : start + (span * cum) / total;
    out.push({ text: toks[i], start: cur, end: e });
    cur = e;
  }
  return out;
}

/**
 * For a time t, which words are visible (max 3) and which one is active.
 *
 * `activeIndex` indexes into `visible`, not into `words` (it is the slot the component colours).
 * The active word is the last one that has started, and it stays active until the next word starts:
 * in a hold (a pause, or the gap between two spoken lines) the finished line keeps its last words on
 * screen rather than blanking for half a second, which is what the reference format does. Before the
 * first word of the array nothing is shown, and the window never reaches back across a beat break.
 */
export function captionAt(words: Word[], t: number): { visible: Word[]; activeIndex: number } {
  if (words.length === 0 || t < words[0].start) return { visible: [], activeIndex: -1 };

  let a = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i].start <= t) a = i;
    else break; // words are in start order
  }

  // first word of the contiguous run that contains `a`
  let run = a;
  while (run > 0 && words[run].start - words[run - 1].end <= RUN_GAP) run--;

  const from = Math.max(run, a - (MAX_WORDS - 1));
  return { visible: words.slice(from, a + 1), activeIndex: a - from };
}

// ---------------------------------------------------------------- look

const WHITE = "#FFFFFF";
const YELLOW = "#FFD400";
const BLACK = "#000000";

/** Heavy condensed stack. Inter = the look we designed against (800/900); Helvetica Neue / Arial for
 *  machines that have them; `sans-serif` for a bare headless Chromium, which falls back to its
 *  fontconfig default. The halo, not the typeface, is what carries legibility, so the fallback still
 *  reads the same. */
const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

/** A black halo as a ring of zero-blur text-shadows. Chromium does not honour `paint-order` on HTML
 *  text (only on SVG <text>), so `-webkit-text-stroke` would eat into the fill and thin the letters;
 *  shadows are drawn behind the glyph, so the white fill stays full weight and the outline stays black
 *  on both a pale sky and a dark hangar. 12 points on the circle leave a scallop of r*(1-cos15deg) =
 *  0.19 px at r = 5.5, i.e. invisible; two rings fill the corners. */
const halo = (r: number): string =>
  Array.from({ length: 12 }, (_, i) => {
    const a = (2 * Math.PI * i) / 12;
    return `${(r * Math.cos(a)).toFixed(2)}px ${(r * Math.sin(a)).toFixed(2)}px 0 ${BLACK}`;
  }).join(", ");
const OUTLINE = `${halo(5.5)}, ${halo(3.2)}`;

/** 1080x1920 frame; 68 px caps at line-height 1.05 = 71 px a line, so two lines fill the 78-86 % band
 *  and one line sits on its baseline at 86 %. Bottom-anchored: the block grows upward, never sideways. */
const BOX: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 268, // 1920 * 0.14
  display: "flex",
  justifyContent: "center",
  padding: "0 72px",
  pointerEvents: "none",
};

const LINE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "baseline",
  columnGap: "0.24em",
  rowGap: "0.02em",
  width: "100%",
  maxWidth: 936, // 1080 - 2 * 72: a long word breaks instead of leaving the frame
  fontFamily: FONT,
  fontWeight: 900,
  fontSize: 68,
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  textAlign: "center",
  // caps: at three words max the block then reads as one solid bar, and a two-letter "AT" gets the
  // same cap height as "THOUSAND" instead of disappearing between taller words
  textTransform: "uppercase",
  color: WHITE,
  textShadow: OUTLINE,
  WebkitFontSmoothing: "antialiased",
};

/** Scale of the pop, from t only: 1 -> 1.08 -> 1 over POP seconds, then flat. sin(t) is symmetric, so
 *  attack and release are equal and the frame that starts the word renders at exactly 1.0. */
const popScale = (t: number, w: Word | undefined): number => {
  if (!w) return 1;
  const p = (t - w.start) / POP;
  return p > 0 && p < 1 ? 1 + 0.08 * Math.sin(Math.PI * p) : 1;
};

/** One word: the active one is yellow and pops, the rest are white and flat. transformOrigin is the
 *  baseline centre, so the swell grows upward and a wrapped second line never shifts. */
const wordStyle = (w: Word, on: boolean, t: number): React.CSSProperties => ({
  display: "inline-block",
  transformOrigin: "50% 100%",
  transform: `scale(${popScale(t, on ? w : undefined).toFixed(4)})`,
  color: on ? YELLOW : WHITE,
  overflowWrap: "break-word",
});

/** The caption block: 1-3 words, lower third, active word yellow. `t` is seconds (frame / fps).
 *  Written with createElement because this module's path is captions.ts — .ts may not contain JSX. */
export const Captions: React.FC<{ words: Word[]; t: number }> = ({ words, t }) => {
  const { visible, activeIndex } = captionAt(words, t);
  if (visible.length === 0) return null;
  return React.createElement(
    "div",
    { style: BOX },
    React.createElement(
      "div",
      { style: LINE },
      visible.map((w, i) =>
        React.createElement("span", { key: `${w.start}-${w.text}`, style: wordStyle(w, i === activeIndex, t) }, w.text),
      ),
    ),
  );
};