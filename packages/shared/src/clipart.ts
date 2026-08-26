export type Clip = { name: string; tags: string; svg: string };

const wrap = (inner: string, vb = "0 0 100 100") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;

export const CLIPART: Clip[] = [
  {
    name: "Star burst",
    tags: "shape retro",
    svg: wrap(
      `<path fill="currentColor" d="M50 2 L59 36 L94 30 L66 51 L88 79 L54 68 L45 98 L38 66 L6 74 L28 48 L4 24 L40 33 Z"/>`
    ),
  },
  {
    name: "Bolt",
    tags: "energy sport",
    svg: wrap(`<path fill="currentColor" d="M58 2 L18 56 L44 56 L34 98 L82 40 L54 40 Z"/>`),
  },
  {
    name: "Flame",
    tags: "hot fire",
    svg: wrap(
      `<path fill="currentColor" d="M50 4c14 18 6 26 14 34 6 6 12-2 12-2 8 16 6 34-6 46-10 10-24 14-36 8C18 84 12 66 20 48c6-14 14-16 16-28 8 6 8 16 6 24 8-6 12-24 8-40Z"/>`
    ),
  },
  {
    name: "Skull",
    tags: "punk rock",
    svg: wrap(
      `<path fill="currentColor" d="M50 6c-22 0-36 15-36 34 0 12 5 19 10 24 3 3 4 6 4 10v8h8v-8h6v8h8v-8h6v8h8v-8c0-4 1-7 4-10 5-5 10-12 10-24C86 21 72 6 50 6Zm-15 38a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm30 0a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"/>`
    ),
  },
  {
    name: "Sun rays",
    tags: "retro nature",
    svg: wrap(
      `<circle cx="50" cy="50" r="20" fill="currentColor"/>` +
        Array.from({ length: 12 })
          .map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const x1 = 50 + Math.cos(a) * 28;
            const y1 = 50 + Math.sin(a) * 28;
            const x2 = 50 + Math.cos(a) * 44;
            const y2 = 50 + Math.sin(a) * 44;
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`;
          })
          .join("")
    ),
  },
  {
    name: "Mountains",
    tags: "outdoor nature",
    svg: wrap(
      `<path fill="currentColor" d="M4 84 L34 30 L52 58 L64 40 L96 84 Z"/><circle cx="76" cy="22" r="9" fill="currentColor"/>`
    ),
  },
  {
    name: "Wave",
    tags: "surf ocean",
    svg: wrap(
      `<path fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" d="M6 62c10-16 22-16 32 0s22 16 32 0 18-14 24-6"/><path fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" d="M6 40c10-16 22-16 32 0s22 16 32 0 18-14 24-6"/>`
    ),
  },
  {
    name: "Heart",
    tags: "love",
    svg: wrap(
      `<path fill="currentColor" d="M50 88C22 68 8 54 8 38 8 24 19 14 32 14c9 0 15 5 18 10 3-5 9-10 18-10 13 0 24 10 24 24 0 16-14 30-42 50Z"/>`
    ),
  },
  {
    name: "Crown",
    tags: "king royal",
    svg: wrap(`<path fill="currentColor" d="M10 78 L18 26 L36 46 L50 16 L64 46 L82 26 L90 78 Z"/>`),
  },
  {
    name: "Smiley",
    tags: "y2k fun",
    svg: wrap(
      `<circle cx="50" cy="50" r="44" fill="currentColor"/><circle cx="36" cy="40" r="7" fill="#fff"/><circle cx="64" cy="40" r="7" fill="#fff"/><path d="M30 60c6 12 34 12 40 0" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`
    ),
  },
  {
    name: "Banner",
    tags: "text ribbon",
    svg: wrap(
      `<path fill="currentColor" d="M6 34h88l-12 16 12 16H6l12-16Z"/>`,
      "0 0 100 100"
    ),
  },
  {
    name: "Laurel",
    tags: "award vintage",
    svg: wrap(
      `<path fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" d="M34 88C14 74 12 44 30 20"/><path fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" d="M66 88C86 74 88 44 70 20"/><circle cx="50" cy="30" r="8" fill="currentColor"/>`
    ),
  },
  {
    name: "Checker",
    tags: "race pattern",
    svg: wrap(
      Array.from({ length: 16 })
        .map((_, i) => {
          const r = Math.floor(i / 4);
          const c = i % 4;
          return (r + c) % 2 === 0
            ? `<rect x="${c * 25}" y="${r * 25}" width="25" height="25" fill="currentColor"/>`
            : "";
        })
        .join("")
    ),
  },
  {
    name: "Palm",
    tags: "summer beach",
    svg: wrap(
      `<path fill="currentColor" d="M46 92c0-30 4-46 8-56l8 2c-6 12-8 28-8 54Z"/><path fill="currentColor" d="M52 32c14-14 32-12 40-2-12-4-24 0-32 8Zm0 0C40 16 22 16 12 26c12-4 24 0 32 8Zm0 0c-4-18 6-30 20-32-8 8-12 18-12 30Z"/>`
    ),
  },
  {
    name: "Arrow",
    tags: "direction",
    svg: wrap(`<path fill="currentColor" d="M8 44h56V22l32 28-32 28V56H8Z"/>`),
  },
  {
    name: "Paw",
    tags: "animal dog",
    svg: wrap(
      `<ellipse cx="50" cy="66" rx="24" ry="20" fill="currentColor"/><circle cx="24" cy="42" r="10" fill="currentColor"/><circle cx="40" cy="26" r="10" fill="currentColor"/><circle cx="60" cy="26" r="10" fill="currentColor"/><circle cx="76" cy="42" r="10" fill="currentColor"/>`
    ),
  },
];

export const FONTS = [
  { label: "Anton", css: "Anton, Arial Black, sans-serif" },
  { label: "Inter Tight", css: "Inter Tight, sans-serif" },
  { label: "Instrument Serif", css: "Instrument Serif, Georgia, serif" },
  { label: "Impact", css: "Impact, Haettenschweiler, sans-serif" },
  { label: "Georgia", css: "Georgia, serif" },
  { label: "Courier", css: "Courier New, monospace" },
  { label: "Trebuchet", css: "Trebuchet MS, sans-serif" },
  { label: "Comic", css: "Comic Sans MS, cursive" },
  { label: "Times", css: "Times New Roman, serif" },
  { label: "Verdana", css: "Verdana, sans-serif" },
];

export const INK_COLORS = [
  "#F7F5F0", "#151517", "#D8FF3E", "#FF4A1C", "#6EA8FF", "#22392C",
  "#1D2A44", "#5A1F26", "#F2DC94", "#C9B79A", "#E23B7B", "#8B5CF6",
];
