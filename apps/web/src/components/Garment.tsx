"use client";

import { useId } from "react";
import type { GarmentType } from "@/lib/catalog";
import { GENERIC, PATHS, shade } from "@/lib/garment-paths";

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
  // GENERIC, not PATHS.tee: a blank with no shape yet should read as an honest
  // rectangle rather than quietly claim to be a T-shirt
  const p = PATHS[type] ?? GENERIC;
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
