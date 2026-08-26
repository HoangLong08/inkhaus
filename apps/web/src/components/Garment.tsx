"use client";

import { useId } from "react";
import type { GarmentType } from "@/lib/catalog";

/** mix a hex colour toward black (t<0) or white (t>0) */
function shade(hex: string, t: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t)
  );
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

type Neck = { hole: string; collar: string };

type Shape = {
  /** drawn behind the body in garment colour — hood */
  hood?: string;
  body: string;
  /** drawn on top in garment colour — hood front, tote handle */
  over?: string;
  /** collar opening + ribbing */
  neck?: Neck;
  /** ribbing / trims in a darker tone */
  ribs?: string[];
  seams?: string[];
  strings?: string[];
};

const PATHS: Record<GarmentType, Shape> = {
  tee: {
    body:
      "M242,152 C222,146 190,146 164,154 C130,166 88,190 62,214 C54,222 52,232 57,242 L92,318 C97,330 110,335 121,330 L140,320 L140,596 C140,608 150,618 162,618 L438,618 C450,618 460,608 460,596 L460,320 L479,330 C490,335 503,330 508,318 L543,242 C548,232 546,222 538,214 C512,190 470,166 436,154 C410,146 378,146 358,152 C358,152 354,206 300,206 C246,206 242,152 242,152 Z",
    neck: {
      hole: "M242,150 L358,150 C356,206 300,208 300,208 C300,208 244,206 242,150 Z",
      collar:
        "M234,151 C236,218 300,222 300,222 C300,222 364,218 366,151 L358,150 C356,206 300,208 300,208 C300,208 244,206 242,150 Z",
    },
    seams: ["M140,320 L140,596", "M460,320 L460,596", "M121,330 L140,320", "M479,330 L460,320"],
  },

  longsleeve: {
    body:
      "M242,152 C222,146 190,146 164,154 C130,166 88,190 62,214 C54,222 52,232 57,242 L104,452 C107,466 120,473 133,469 L176,455 C189,451 194,438 190,426 L140,320 L140,596 C140,608 150,618 162,618 L438,618 C450,618 460,608 460,596 L460,320 L410,426 C406,438 411,451 424,455 L467,469 C480,473 493,466 496,452 L543,242 C548,232 546,222 538,214 C512,190 470,166 436,154 C410,146 378,146 358,152 C358,152 354,206 300,206 C246,206 242,152 242,152 Z",
    neck: {
      hole: "M242,150 L358,150 C356,206 300,208 300,208 C300,208 244,206 242,150 Z",
      collar:
        "M234,151 C236,218 300,222 300,222 C300,222 364,218 366,151 L358,150 C356,206 300,208 300,208 C300,208 244,206 242,150 Z",
    },
    ribs: ["M104,452 L190,426 L196,448 L110,474 Z", "M496,452 L410,426 L404,448 L490,474 Z"],
    seams: ["M140,320 L140,596", "M460,320 L460,596"],
  },

  tank: {
    body:
      "M262,168 C252,150 232,144 214,152 C186,164 168,186 160,208 L150,236 C146,246 151,256 161,258 L172,262 L172,596 C172,608 182,618 194,618 L406,618 C418,618 428,608 428,596 L428,262 L439,258 C449,256 454,246 450,236 L440,208 C432,186 414,164 386,152 C368,144 348,150 338,168 C338,168 348,240 300,240 C252,240 262,168 262,168 Z",
    neck: {
      hole: "M262,166 L338,166 C344,240 300,242 300,242 C300,242 256,240 262,166 Z",
      collar:
        "M255,167 C261,252 300,254 300,254 C300,254 339,252 345,167 L338,166 C344,240 300,242 300,242 C300,242 256,240 262,166 Z",
    },
    seams: ["M172,262 L172,596", "M428,262 L428,596"],
  },

  crewneck: {
    body:
      "M242,152 C222,146 190,146 164,154 C130,166 88,190 62,214 C54,222 52,232 57,242 L92,318 C97,330 110,335 121,330 L140,320 L140,556 L460,556 L460,320 L479,330 C490,335 503,330 508,318 L543,242 C548,232 546,222 538,214 C512,190 470,166 436,154 C410,146 378,146 358,152 C358,152 354,206 300,206 C246,206 242,152 242,152 Z",
    neck: {
      hole: "M242,150 L358,150 C356,206 300,208 300,208 C300,208 244,206 242,150 Z",
      collar:
        "M228,151 C231,230 300,234 300,234 C300,234 369,230 372,151 L358,150 C356,206 300,208 300,208 C300,208 244,206 242,150 Z",
    },
    ribs: [
      "M140,556 L460,556 L460,600 C460,612 450,620 438,620 L162,620 C150,620 140,612 140,600 Z",
      "M92,318 L140,320 L136,346 L88,344 Z",
      "M508,318 L460,320 L464,346 L512,344 Z",
    ],
    seams: ["M140,320 L140,556", "M460,320 L460,556"],
  },

  hoodie: {
    hood:
      "M300,66 C230,66 178,108 172,176 C168,208 182,224 200,228 L400,228 C418,224 432,208 428,176 C422,108 370,66 300,66 Z",
    body:
      "M238,178 C216,170 184,172 156,182 C118,196 78,220 52,244 C44,252 42,262 47,272 L86,356 C91,368 104,373 115,368 L130,358 L130,626 C130,640 141,650 155,650 L445,650 C459,650 470,640 470,626 L470,358 L485,368 C496,373 509,368 514,356 L553,272 C558,262 556,252 548,244 C522,220 482,196 444,182 C416,172 384,170 362,178 C362,178 356,244 300,244 C244,244 238,178 238,178 Z",
    over:
      "M238,178 C238,178 244,244 300,244 C356,244 362,178 362,178 C362,178 336,156 300,156 C264,156 238,178 238,178 Z",
    ribs: [
      "M198,470 L402,470 C410,470 416,476 416,484 L422,566 C423,576 416,584 406,584 L194,584 C184,584 177,576 178,566 L184,484 C184,476 190,470 198,470 Z",
      "M130,610 L470,610 L470,632 C470,642 460,650 450,650 L150,650 C140,650 130,642 130,632 Z",
      "M86,356 L130,358 L124,384 L80,382 Z",
      "M514,356 L470,358 L476,384 L520,382 Z",
    ],
    strings: ["M262,232 C256,272 253,302 252,332", "M338,232 C344,272 347,302 348,332"],
    seams: ["M130,358 L130,626", "M470,358 L470,626"],
  },

  cap: {
    body:
      "M300,150 C196,150 126,224 126,326 C126,362 132,390 140,410 L460,410 C468,390 474,362 474,326 C474,224 404,150 300,150 Z",
    over:
      "M138,410 C138,410 188,486 300,486 C420,486 534,452 556,422 C564,410 554,398 538,400 C514,404 490,410 460,410 Z",
    ribs: ["M136,394 L464,394 L468,414 L132,414 Z"],
    seams: ["M300,150 L300,396", "M216,170 L188,396", "M384,170 L412,396"],
  },

  tote: {
    body:
      "M158,206 L442,206 C452,206 460,214 460,224 L474,652 C475,666 464,678 450,678 L150,678 C136,678 125,666 126,652 L140,224 C140,214 148,206 158,206 Z",
    over:
      "M218,212 C218,212 210,74 300,74 C390,74 382,212 382,212 L356,212 C356,212 364,102 300,102 C236,102 244,212 244,212 Z",
    seams: ["M150,232 L450,232"],
  },
};

export default function Garment({
  type = "tee",
  color = "#F7F5F0",
  className = "",
  children,
  printArea,
  showPrintGuide = false,
}: {
  type?: GarmentType;
  color?: string;
  className?: string;
  children?: React.ReactNode;
  printArea?: { x: number; y: number; w: number; h: number };
  showPrintGuide?: boolean;
}) {
  const p = PATHS[type] ?? PATHS.tee;
  // per-instance: a grid renders several tees at once, and `url(#...)` resolves to
  // the FIRST matching id in the document - shared ids would cross-wire their clips
  const id = useId();
  const inner = shade(color, -0.28);
  const rib = shade(color, -0.13);

  return (
    <svg viewBox="0 0 600 700" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
          <stop offset="17%" stopColor="#000" stopOpacity="0.05" />
          <stop offset="44%" stopColor="#fff" stopOpacity="0.13" />
          <stop offset="76%" stopColor="#000" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.32" />
        </linearGradient>
        <linearGradient id={`${id}-vshade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="50%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
        <filter id={`${id}-fabric`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <clipPath id={`${id}-clip`}>
          <path d={p.body} />
        </clipPath>
        {printArea && (
          <clipPath id={`${id}-print`}>
            <rect x={printArea.x} y={printArea.y} width={printArea.w} height={printArea.h} />
          </clipPath>
        )}
      </defs>

      {/* hood behind the shoulders */}
      {p.hood && (
        <>
          <path d={p.hood} fill={color} />
          <path d={p.hood} fill={`url(#${id}-shade)`} />
          <path d={p.hood} fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="2.5" />
        </>
      )}

      {/* body */}
      <path d={p.body} fill={color} />
      {p.over && <path d={p.over} fill={color} />}

      {/* trims */}
      {p.ribs?.map((d, i) => (
        <path key={i} d={d} fill={rib} />
      ))}

      {/* collar */}
      {p.neck && (
        <>
          <path d={p.neck.hole} fill={inner} />
          <path d={p.neck.collar} fill={rib} />
        </>
      )}

      {/* shading + fabric grain */}
      <g clipPath={`url(#${id}-clip)`}>
        <path d={p.body} fill={`url(#${id}-shade)`} />
        <path d={p.body} fill={`url(#${id}-vshade)`} />
        <rect width="600" height="700" filter={`url(#${id}-fabric)`} opacity="0.13" />
      </g>
      {p.over && <path d={p.over} fill="#000" opacity="0.07" />}

      {/* drawstrings */}
      {p.strings && (
        <g stroke={rib} strokeWidth="8" strokeLinecap="round" fill="none">
          {p.strings.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      )}

      {/* stitching */}
      {p.seams?.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="2" />
      ))}
      <path d={p.body} fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="2.5" />
      {p.over && <path d={p.over} fill="none" stroke="#000" strokeOpacity="0.15" strokeWidth="2" />}

      {/* artwork */}
      {printArea && (
        <>
          <g clipPath={`url(#${id}-print)`}>{children}</g>
          {showPrintGuide && (
            <rect
              x={printArea.x}
              y={printArea.y}
              width={printArea.w}
              height={printArea.h}
              fill="none"
              stroke="#D8FF3E"
              strokeWidth="2"
              strokeDasharray="8 8"
              opacity="0.7"
            />
          )}
        </>
      )}
    </svg>
  );
}
