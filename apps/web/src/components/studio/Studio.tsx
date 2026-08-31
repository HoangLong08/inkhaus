"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as FabricNS from "fabric";
import {
  Upload, Type as TypeIcon, Shapes, Sparkles, Layers, Shirt, Undo2, Redo2,
  Trash2, Copy, AlignCenter, ArrowUp, ArrowDown, Download, ShoppingBag,
  Loader2, RotateCw, Info, Check, Eraser,
} from "lucide-react";
import Link from "next/link";
import Garment from "@/components/Garment";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import SizeGrid from "@/components/cart/SizeGrid";
import { PRODUCTS, quote, sizesFor, type Product } from "@/lib/catalog";
import { CLIPART, FONTS, INK_COLORS } from "@/lib/clipart";
import { api } from "@/lib/api";
import { colorSlug, useCart, type CartDesign } from "@/lib/cart";
import { putPendingDesign } from "@/lib/cart-designs";
import {
  ASSET_PROP, assetIdsIn, clearAll, getAsset, loadDraft, putAsset,
  requestPersistence, saveDraft, sweepAssets, type Side,
} from "@/lib/studio-store";

/** The figure the artwork spec on /how-it-works already promises. Uploads were
 *  previously unbounded; past this the Blob, the decoded bitmap and the
 *  IndexedDB copy together are enough to wedge a phone. */
const MAX_UPLOAD_MB = 25;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
type Tool = "product" | "upload" | "text" | "art" | "ai" | "layers";

/** how many objects a stored side carries, without deserialising it into fabric */
function sceneObjectCount(json: string | null) {
  if (!json) return 0;
  try {
    return (JSON.parse(json).objects ?? []).length as number;
  } catch {
    return 0;
  }
}

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const TOOLS: { id: Tool; label: string; icon: typeof Upload }[] = [
  { id: "product", label: "Product", icon: Shirt },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "text", label: "Text", icon: TypeIcon },
  { id: "art", label: "Clip art", icon: Shapes },
  { id: "ai", label: "AI art", icon: Sparkles },
  { id: "layers", label: "Layers", icon: Layers },
];

export default function Studio() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<typeof FabricNS | null>(null);
  const canvasRef = useRef<FabricNS.Canvas | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const sideStore = useRef<Record<Side, string | null>>({ front: null, back: null });
  /** the active side, readable from canvas callbacks that were bound once on mount */
  const sideRef = useRef<Side>("front");
  /** undo/redo is per side - a front snapshot must never be restored onto the back */
  const histories = useRef<Record<Side, { stack: string[]; index: number }>>({
    front: { stack: [], index: -1 },
    back: { stack: [], index: -1 },
  });
  const historyLock = useRef(false);
  /** blob: URLs minted for restored uploads, revoked on unmount */
  const objectUrls = useRef<string[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** suppresses autosave until the initial restore has finished, so an empty
   *  canvas cannot overwrite the draft it is about to load */
  const restored = useRef(false);
  /** sides whose stored JSON still points at a previous document's blob: URLs */
  const staleSides = useRef<Set<Side>>(new Set());

  const [product, setProduct] = useState<Product>(PRODUCTS[0]);
  const [colorIdx, setColorIdx] = useState(0);
  const [method, setMethod] = useState<string>(PRODUCTS[0].method[0]);
  const [side, setSide] = useState<Side>("front");
  const [tool, setTool] = useState<Tool>("upload");
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<FabricNS.FabricObject | null>(null);
  const [objects, setObjects] = useState<FabricNS.FabricObject[]>([]);
  /** which sides actually carry artwork - drives the print-location count */
  const [sideHasArt, setSideHasArt] = useState<Record<Side, boolean>>({
    front: false,
    back: false,
  });
  const [showGuide, setShowGuide] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [dpiWarn, setDpiWarn] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [qtyBySize, setQtyBySize] = useState<Record<string, number>>({ M: 1 });
  const sizeRun = sizesFor(product);
  const defaultSize = sizeRun.includes("M") ? "M" : sizeRun[0];
  /** bumped by every canvas mutation; the autosave effect keys off it */
  const [revision, setRevision] = useState(0);

  const addToCartLine = useCart((s) => s.add);
  const openCart = useCart((s) => s.openDrawer);

  const color = product.colors[Math.min(colorIdx, product.colors.length - 1)];

  /**
   * Switching blanks can change the size run under the quantities — 6xM on a
   * tee means nothing on a one-size mug, and the cart would drop those units on
   * the next load. Reconciled on read rather than synced through an effect, so
   * there is no render where the panel and the price disagree.
   */
  const sizeQty = useMemo(() => {
    const stray = Object.keys(qtyBySize).filter((s) => !sizeRun.includes(s));
    if (stray.length === 0) return qtyBySize;
    const next = Object.fromEntries(
      Object.entries(qtyBySize).filter(([s]) => sizeRun.includes(s)),
    );
    const moved = stray.reduce((n, s) => n + (qtyBySize[s] || 0), 0);
    next[defaultSize] = (next[defaultSize] ?? 0) + moved;
    return next;
  }, [qtyBySize, sizeRun, defaultSize]);

  const totalQty = useMemo(
    () => Object.values(sizeQty).reduce((a, b) => a + (b || 0), 0),
    [sizeQty]
  );
  // the same maths the cart and the API run, so the three numbers cannot disagree
  const priced = useMemo(
    () =>
      quote(
        product,
        Object.entries(sizeQty)
          .filter(([, q]) => q > 0)
          .map(([size, qty]) => ({ size, qty })),
      ),
    [product, sizeQty],
  );
  const total = priced.subtotal;

  const printBox = product.printArea;
  const boxStyle = {
    left: `${(printBox.x / 600) * 100}%`,
    top: `${(printBox.y / 700) * 100}%`,
    width: `${(printBox.w / 600) * 100}%`,
    height: `${(printBox.h / 700) * 100}%`,
  };

  /* ---------------- canvas -> react ---------------- */
  /** Mirrors the canvas into state. Never read the canvas ref while rendering. */
  const sync = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const objs = c.getObjects();
    setSelected(c.getActiveObject() ?? null);
    // always a fresh array: fabric hands back the same reference it mutates, and a
    // property edit has to re-render the panel even when the selection is unchanged
    setObjects([...objs]);
    setSideHasArt((m) => {
      const has = objs.length > 0;
      return m[sideRef.current] === has ? m : { ...m, [sideRef.current]: has };
    });
  }, []);

  /* ---------------- serialisation ---------------- */
  /**
   * fabric v6's toJSON() takes no arguments, so custom properties are dropped.
   * Every snapshot goes through toObject() instead to keep the asset id that
   * links an image back to its Blob in IndexedDB.
   */
  const serializeScene = useCallback(
    (c: FabricNS.Canvas) => JSON.stringify(c.toObject([ASSET_PROP])),
    [],
  );

  /**
   * Re-points every stored asset id at a live blob: URL before fabric sees the
   * scene. Uploads whose Blob is gone - iOS evicts origin storage LRU - are
   * dropped rather than restored as a broken image.
   *
   * @returns how many objects were dropped
   */
  const hydrateScene = useCallback(async (c: FabricNS.StaticCanvas, json: string) => {
    const scene = JSON.parse(json);
    const objects: Record<string, unknown>[] = scene.objects ?? [];
    let dropped = 0;

    const kept: Record<string, unknown>[] = [];
    for (const obj of objects) {
      const id = obj[ASSET_PROP];
      if (typeof id !== "string") {
        kept.push(obj);
        continue;
      }
      const blob = await getAsset(id);
      if (!blob) {
        dropped += 1;
        continue;
      }
      const url = URL.createObjectURL(blob);
      objectUrls.current.push(url);
      kept.push({ ...obj, src: url });
    }

    scene.objects = kept;
    await c.loadFromJSON(scene);
    return dropped;
  }, []);

  /* ---------------- history ---------------- */
  const snapshot = useCallback(() => {
    const c = canvasRef.current;
    if (!c || historyLock.current) return;
    const json = serializeScene(c);
    const h = histories.current[sideRef.current];
    // delete/duplicate snapshot twice - once from the canvas event, once from act().
    // Collapsing identical states keeps one undo press equal to one user action.
    if (h.stack[h.index] === json) return;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(json);
    if (h.stack.length > 40) h.stack.shift();
    h.index = h.stack.length - 1;
  }, [serializeScene]);

  const restore = useCallback(
    async (json: string) => {
      const c = canvasRef.current;
      if (!c) return;
      historyLock.current = true;
      // within a session the blob: URLs in these snapshots are still live, so
      // undo/redo needs no IndexedDB round trip
      await c.loadFromJSON(JSON.parse(json));
      c.renderAll();
      historyLock.current = false;
      sync();
    },
    [sync],
  );

  const undo = () => {
    const h = histories.current[sideRef.current];
    if (h.index <= 0) return;
    h.index -= 1;
    restore(h.stack[h.index]);
  };
  const redo = () => {
    const h = histories.current[sideRef.current];
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    restore(h.stack[h.index]);
  };

  /* ---------------- init fabric ---------------- */
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      const fabric = await import("fabric");
      if (disposed || !canvasElRef.current) return;
      fabricRef.current = fabric;

      const c = new fabric.Canvas(canvasElRef.current, {
        backgroundColor: "transparent",
        preserveObjectStacking: true,
        selection: true,
      });
      canvasRef.current = c;

      fabric.FabricObject.ownDefaults.borderColor = "#D8FF3E";
      fabric.FabricObject.ownDefaults.cornerColor = "#D8FF3E";
      fabric.FabricObject.ownDefaults.cornerStrokeColor = "#16171b";
      fabric.FabricObject.ownDefaults.cornerStyle = "circle";
      fabric.FabricObject.ownDefaults.cornerSize = 11;
      fabric.FabricObject.ownDefaults.transparentCorners = false;
      fabric.FabricObject.ownDefaults.padding = 2;

      c.on("selection:created", sync);
      c.on("selection:updated", sync);
      c.on("selection:cleared", sync);
      // scheduleSave is read through a ref: it changes identity whenever the
      // draft metadata does, and these handlers must not be rebound (that would
      // mean tearing down and re-creating the fabric canvas on every edit)
      // bumping a counter rather than calling the debouncer directly: these
      // handlers are bound once and must not close over an autosave callback
      // that changes identity with the draft metadata
      const touched = () => { snapshot(); sync(); setRevision((r) => r + 1); };
      c.on("object:modified", touched);
      c.on("object:added", touched);
      c.on("object:removed", touched);

      const fit = () => {
        const el = wrapRef.current?.querySelector<HTMLElement>("[data-printbox]");
        if (!el) return;
        const r = el.getBoundingClientRect();
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        if (!w || !h) return;
        const prev = sizeRef.current;
        c.setDimensions({ width: w, height: h });
        if (prev.w && prev.w !== w) {
          const k = w / prev.w;
          c.getObjects().forEach((o) => {
            o.set({
              left: (o.left ?? 0) * k,
              top: (o.top ?? 0) * k,
              scaleX: (o.scaleX ?? 1) * k,
              scaleY: (o.scaleY ?? 1) * k,
            });
            o.setCoords();
          });
        }
        sizeRef.current = { w, h };
        c.renderAll();
      };

      fit();

      // ---- restore last session ----
      // Auto-restore rather than prompt: this is a canvas tool, and Excalidraw,
      // tldraw and Figma all just put the work back. "Start over" is one click.
      const draft = await loadDraft();
      if (draft && !disposed) {
        const saved = PRODUCTS.find((p) => p.slug === draft.productSlug);
        if (saved) setProduct(saved);
        if (draft.method) setMethod(draft.method);
        setColorIdx(draft.colorIdx);
        setQtyBySize(draft.qtyBySize);
        sideStore.current = draft.scenes;
        sideRef.current = draft.side;
        setSide(draft.side);
        staleSides.current = new Set(["front", "back"] as Side[]);

        const scene = draft.scenes[draft.side];
        if (scene) {
          historyLock.current = true;
          const dropped = await hydrateScene(c, scene);
          staleSides.current.delete(draft.side);
          c.renderAll();
          historyLock.current = false;
          if (dropped > 0) {
            setDpiWarn(
              `${dropped} uploaded image${dropped > 1 ? "s" : ""} could not be restored — ` +
                `your browser reclaimed the file${dropped > 1 ? "s" : ""} to free up space. ` +
                `Everything else is as you left it.`,
            );
          }
        }
      }
      // "Put art on it" from a product page names the blank and the colourway.
      // Read off the URL directly rather than with useSearchParams: this
      // component is server-rendered inside an otherwise static route, and that
      // hook would drag the whole page into a Suspense-or-bail-out dance for
      // two optional parameters.
      const params = new URLSearchParams(window.location.search);
      const wanted = PRODUCTS.find((p) => p.slug === params.get("product"));
      if (wanted && !disposed) {
        const previous = draft?.productSlug ?? PRODUCTS[0].slug;
        const changed = wanted.slug !== previous;
        setProduct(wanted);
        if (changed || !draft?.method) setMethod(wanted.method[0]);
        const idx = wanted.colors.findIndex((c) => colorSlug(c) === params.get("color"));
        if (idx >= 0) setColorIdx(idx);
        else if (changed) setColorIdx(0);
      }

      restored.current = true;
      requestPersistence();

      setReady(true);
      snapshot();
      sync();

      ro = new ResizeObserver(fit);
      if (wrapRef.current) ro.observe(wrapRef.current);
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      canvasRef.current?.dispose();
      canvasRef.current = null;
      objectUrls.current.forEach(URL.revokeObjectURL);
      objectUrls.current = [];
    };
  }, [snapshot, sync, hydrateScene]);

  /* ---------------- autosave ---------------- */
  // canvas callbacks are bound once, so anything they need at save time has to
  // be readable from a ref rather than captured from a render
  // the reconciled quantities, so a draft saved after a blank switch comes back
  // with codes the new blank actually stocks
  const metaRef = useRef({ productSlug: product.slug, colorIdx, side, qtyBySize: sizeQty, method });
  useEffect(() => {
    metaRef.current = { productSlug: product.slug, colorIdx, side, qtyBySize: sizeQty, method };
  }, [product, colorIdx, side, sizeQty, method]);

  const persist = useCallback(async () => {
    const c = canvasRef.current;
    // before the restore lands, the canvas is empty - saving here would wipe
    // the very draft that is about to be read back
    if (!c || !restored.current) return;
    const scenes = { ...sideStore.current, [sideRef.current]: serializeScene(c) };
    await saveDraft({ schema: 1, ...metaRef.current, scenes, savedAt: Date.now() });
    // deleting a layer does not delete its upload; without this every image the
    // user ever placed would sit in IndexedDB forever
    await sweepAssets(assetIdsIn(scenes));
  }, [serializeScene]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(), 800);
  }, [persist]);

  // No restored.current guard: persist() already refuses to run before the
  // restore lands, and a debounced call that fires afterwards saves the
  // restored state, which is what we want anyway.
  useEffect(() => {
    scheduleSave();
  }, [revision, side, product, colorIdx, sizeQty, method, scheduleSave]);

  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      void persist();
    };
    // beforeunload never fires reliably on mobile - a backgrounded iOS tab is
    // killed without it. visibilitychange is the one that actually lands.
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [persist]);

  const startOver = async () => {
    const c = canvasRef.current;
    if (!c) return;
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    historyLock.current = true;
    c.clear();
    c.backgroundColor = "transparent";
    c.renderAll();
    historyLock.current = false;

    sideStore.current = { front: null, back: null };
    histories.current = { front: { stack: [], index: -1 }, back: { stack: [], index: -1 } };
    objectUrls.current.forEach(URL.revokeObjectURL);
    objectUrls.current = [];

    setSideHasArt({ front: false, back: false });
    setDpiWarn(null);
    await clearAll();
    snapshot();
    sync();
  };

  /* ------------- switch sides (persist each) ------------- */
  const switchSide = async (next: Side) => {
    const c = canvasRef.current;
    if (!c || next === side) return;
    sideStore.current[side] = serializeScene(c);

    historyLock.current = true;
    sideRef.current = next;
    c.clear();
    c.backgroundColor = "transparent";
    const saved = sideStore.current[next];
    if (saved) {
      // A restored draft only hydrates the side it opens on; the other side's
      // JSON still carries blob: URLs minted by the previous document, which
      // are dead. Route it through hydrateScene the first time it is opened.
      if (staleSides.current.has(next)) {
        await hydrateScene(c, saved);
        staleSides.current.delete(next);
      } else {
        await c.loadFromJSON(JSON.parse(saved));
      }
    }
    c.renderAll();
    historyLock.current = false;

    setSide(next);
    sync();
    // first visit to a side: seed its own undo stack with the state it starts in
    if (histories.current[next].index < 0) snapshot();
  };

  /* ---------------- add helpers ---------------- */
  const center = () => {
    const c = canvasRef.current!;
    return { x: c.getWidth() / 2, y: c.getHeight() / 2 };
  };

  const addText = (value = "YOUR TEXT") => {
    const fabric = fabricRef.current;
    const c = canvasRef.current;
    if (!fabric || !c) return;
    const t = new fabric.Textbox(value, {
      left: center().x,
      top: center().y,
      originX: "center",
      originY: "center",
      width: c.getWidth() * 0.8,
      fontSize: Math.max(22, c.getWidth() * 0.13),
      fontFamily: "Anton",
      fill: color.dark ? "#F7F5F0" : "#151517",
      textAlign: "center",
      charSpacing: 20,
    });
    c.add(t);
    c.setActiveObject(t);
    c.renderAll();
    setTool("text");
  };

  const addClip = async (svg: string) => {
    const fabric = fabricRef.current;
    const c = canvasRef.current;
    if (!fabric || !c) return;
    const fill = color.dark ? "#F7F5F0" : "#151517";
    const res = await fabric.loadSVGFromString(svg.replaceAll("currentColor", fill));
    const obj = fabric.util.groupSVGElements(res.objects.filter(Boolean) as FabricNS.FabricObject[], res.options);
    const target = c.getWidth() * 0.45;
    obj.scaleToWidth(target);
    obj.set({ left: center().x, top: center().y, originX: "center", originY: "center" });
    c.add(obj);
    c.setActiveObject(obj);
    c.renderAll();
  };

  const onUpload = async (file: File) => {
    const fabric = fabricRef.current;
    const c = canvasRef.current;
    if (!fabric || !c) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setDpiWarn(
        `That file is ${(file.size / 1024 / 1024).toFixed(0)} MB. The studio caps uploads at ` +
          `${MAX_UPLOAD_MB} MB — export a flattened PNG or JPG and try again.`,
      );
      return;
    }

    // Stored before the object URL is handed to fabric. fabric serialises the
    // blob: URL into `src`, and that URL dies with this document — the id is
    // what survives a reload, and hydrateScene() trades it back for a Blob.
    const assetId = crypto.randomUUID();
    const stored = await putAsset(assetId, file);

    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    const img = await fabric.FabricImage.fromURL(url);
    const target = c.getWidth() * 0.7;
    img.scaleToWidth(target);
    img.set({
      left: center().x,
      top: center().y,
      originX: "center",
      originY: "center",
      [ASSET_PROP]: assetId,
    });
    c.add(img);
    c.setActiveObject(img);
    c.renderAll();

    // DPI check against the real print size
    const printedW = (img.width ?? 0) * (img.scaleX ?? 1) / c.getWidth() * product.printInches.w;
    const dpi = Math.round((img.width ?? 0) / Math.max(printedW, 0.01));
    if (dpi < 150) {
      setDpiWarn(
        `Low resolution — about ${dpi} DPI at this size. Scale it down or upload a bigger file (300 DPI recommended).`
      );
    } else if (!stored) {
      // the canvas is fine either way; the user just has no safety net now
      setDpiWarn("This image couldn't be saved to your device — it won't survive a page reload.");
    } else {
      setDpiWarn(null);
    }
  };

  const generateAi = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    const words = aiPrompt.toUpperCase().split(/\s+/).filter(Boolean).slice(0, 4);
    const ink = color.dark ? "#F7F5F0" : "#151517";
    const accent = "#FF4A1C";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <circle cx="200" cy="180" r="120" fill="none" stroke="${ink}" stroke-width="10"/>
      <circle cx="200" cy="180" r="96" fill="none" stroke="${accent}" stroke-width="4" stroke-dasharray="10 8"/>
      ${Array.from({ length: 16 }).map((_, i) => {
        const a = (i * 22.5 * Math.PI) / 180;
        return `<line x1="${200 + Math.cos(a) * 124}" y1="${180 + Math.sin(a) * 124}" x2="${200 + Math.cos(a) * 146}" y2="${180 + Math.sin(a) * 146}" stroke="${ink}" stroke-width="7" stroke-linecap="round"/>`;
      }).join("")}
      ${words.map((w, i) => `<text x="200" y="${140 + i * 46}" text-anchor="middle" font-family="Anton, Arial Black" font-size="${Math.max(20, 54 - w.length * 2)}" fill="${ink}">${w}</text>`).join("")}
      <text x="200" y="336" text-anchor="middle" font-family="Anton, Arial Black" font-size="20" letter-spacing="6" fill="${accent}">EST. 2026</text>
    </svg>`;
    await addClip(svg);
    setAiBusy(false);
  };

  /* ---------------- object ops ---------------- */
  const act = (fn: (o: FabricNS.FabricObject, c: FabricNS.Canvas) => void) => {
    const c = canvasRef.current;
    const o = c?.getActiveObject();
    if (!c || !o) return;
    fn(o, c);
    c.renderAll();
    snapshot();
  };

  const setProp = (patch: Record<string, unknown>) => {
    const c = canvasRef.current;
    const o = c?.getActiveObject();
    if (!c || !o) return;
    o.set(patch);
    c.renderAll();
    sync();
  };

  /**
   * Browser canvas area caps (jhildenbiddle.github.io/canvas-size):
   *   iOS Safari      4096 x 4096 = 16,777,216 px
   *   Chrome Android5 11180^2     = 124,992,400 px
   *   desktop         16384^2     = 268,435,456 px
   * A 12x16" @300 DPI file is 3600x4800 = 17,280,000 px — 3% OVER iOS.
   * Over the cap the browser does not throw: toDataURL silently returns a
   * blank image. So probe the real limit, clamp, and never ship a blank file.
   */
  const maxCanvasArea = () => {
    const probe = (side: number) => {
      const el = document.createElement("canvas");
      el.width = el.height = side;
      const ctx = el.getContext("2d");
      if (!ctx) return false;
      ctx.fillStyle = "#fff";
      ctx.fillRect(side - 1, side - 1, 1, 1);
      const ok = ctx.getImageData(side - 1, side - 1, 1, 1).data[3] === 255;
      el.width = el.height = 0;
      return ok;
    };
    for (const s of [16384, 11180, 8192, 4096]) if (probe(s)) return s * s;
    return 4096 * 4096;
  };

  const exportPng = () => {
    const c = canvasRef.current;
    if (!c) return;
    const { w: inW, h: inH } = product.printInches;
    const area = maxCanvasArea();

    // highest DPI this device can actually render, capped at 300
    let dpi = 300;
    while (dpi > 150 && inW * dpi * (inH * dpi) > area) dpi -= 25;
    const fits = inW * dpi * (inH * dpi) <= area;

    if (!fits) {
      setDpiWarn(
        `This browser can't rasterise a ${inW}x${inH}" file at print resolution ` +
          `(canvas limit reached). The production file is generated on our servers — ` +
          `your design is saved either way.`
      );
      return;
    }
    if (dpi < 300) {
      setDpiWarn(
        `Your browser capped this preview file at ${dpi} DPI. We re-render every ` +
          `order at 300 DPI server-side before it reaches the press.`
      );
    }

    const link = document.createElement("a");
    link.download = `inkhaus-${product.slug}-${side}-${dpi}dpi.png`;
    link.href = c.toDataURL({ format: "png", multiplier: (inW * dpi) / c.getWidth() });
    link.click();
  };

  /**
   * The artwork for a side, rasterised at `multiplier`.
   *
   * The side on screen comes straight off the live canvas. The other one is
   * replayed onto a throwaway StaticCanvas of the same pixel size — the cart
   * thumbnail should show the front even while the back is being worked on.
   * Returns null for an empty side, so callers can tell "nothing there" from
   * "a transparent rectangle".
   */
  const artCanvasFor = useCallback(
    async (target: Side, multiplier: number) => {
      const live = canvasRef.current;
      const fabric = fabricRef.current;
      if (!live || !fabric) return null;

      if (target === sideRef.current) {
        return live.getObjects().length > 0 ? live.toCanvasElement(multiplier) : null;
      }

      const json = sideStore.current[target];
      if (!json) return null;

      const off = new fabric.StaticCanvas(undefined, {
        width: live.getWidth(),
        height: live.getHeight(),
      });
      try {
        // a restored draft's other side still carries the previous document's
        // blob: URLs, so it has to go the long way round through IndexedDB
        if (staleSides.current.has(target)) await hydrateScene(off, json);
        else await off.loadFromJSON(JSON.parse(json));
        off.renderAll();
        return off.getObjects().length > 0 ? off.toCanvasElement(multiplier) : null;
      } catch {
        return null;
      } finally {
        void off.dispose();
      }
    },
    [hydrateScene],
  );

  /**
   * The print file carries artwork only — the press does not want a picture of a
   * shirt. This is the customer-facing mockup, so it rasterises the live garment
   * SVG and composites the artwork into the print box on top of it.
   *
   * `background` matters for JPEG output: the garment is drawn onto transparency,
   * and a JPEG turns that black.
   */
  const renderMockup = useCallback(
    async (
      target: Side,
      width: number,
      { mime = "image/png", quality, background }: {
        mime?: string;
        quality?: number;
        background?: string;
      } = {},
    ): Promise<string | null> => {
      const c = canvasRef.current;
      const svgEl = wrapRef.current?.querySelector("svg");
      if (!c || !svgEl) return null;

      const W = width;
      const H = Math.round((W * 700) / 600);

      const clone = svgEl.cloneNode(true) as SVGSVGElement;
      // the tailwind utilities on it (the drop shadow) do not exist inside a
      // standalone svg document, and an unresolved class is better than none
      clone.removeAttribute("class");
      clone.setAttribute("width", String(W));
      clone.setAttribute("height", String(H));

      // useId() produces ids like "«r0»" — not valid XML names, and an svg loaded
      // through <img> is parsed as XML. Rename every id, then repoint url(#...).
      const renames = new Map<string, string>();
      clone.querySelectorAll("[id]").forEach((el, i) => {
        renames.set(el.id, `g${i}`);
        el.id = `g${i}`;
      });
      let markup = new XMLSerializer().serializeToString(clone);
      renames.forEach((to, from) => {
        markup = markup.replaceAll(`#${from}`, `#${to}`);
      });

      const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("garment did not rasterise"));
          img.src = url;
        });

        const out = document.createElement("canvas");
        out.width = W;
        out.height = H;
        const ctx = out.getContext("2d");
        if (!ctx) return null;
        if (background) {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.drawImage(img, 0, 0, W, H);

        // the canvas *is* the print box, so its bounds already clip the artwork —
        // it only has to be scaled from screen px into the 600x700 garment space
        const k = W / 600;
        const art = await artCanvasFor(target, (printBox.w * k) / c.getWidth());
        if (art) ctx.drawImage(art, printBox.x * k, printBox.y * k, printBox.w * k, printBox.h * k);

        return out.toDataURL(mime, quality);
      } catch {
        return null;
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [artCanvasFor, printBox],
  );

  const exportMockup = async () => {
    const data = await renderMockup(side, 1200);
    if (!data) {
      setDpiWarn("This browser couldn't render the mockup. The print file still exports fine.");
      return;
    }
    const link = document.createElement("a");
    link.download = `inkhaus-${product.slug}-${color.name.toLowerCase().replace(/\s+/g, "-")}-${side}-mockup.png`;
    link.href = data;
    link.click();
  };

  /**
   * Add to cart — the point of the whole screen.
   *
   * The artwork has to become a real design before it can be ordered, so this
   * flattens both sides, renders the mockups and posts them to `/designs`. If
   * that call cannot land (the storefront is built to work with the API down)
   * the payload is parked in IndexedDB and checkout retries it. Either way the
   * line goes into the cart, carrying the thumbnail it will be shown with.
   */
  const addToCart = async () => {
    const c = canvasRef.current;
    if (!c || totalQty === 0 || adding) return;
    setAdding(true);
    try {
      // capture the side on screen first — everything below reads sideStore
      sideStore.current[sideRef.current] = serializeScene(c);
      const scenes = { ...sideStore.current };
      const sides = (["front", "back"] as Side[]).filter((s) => sceneObjectCount(scenes[s]) > 0);

      let design: CartDesign | undefined;

      if (sides.length > 0) {
        const key = uid();
        const name = `${product.name} · ${color.name}`;
        const slugOfColor = colorSlug(color);

        // sequential on purpose: each render replays a side through the same
        // canvas machinery, and hydrating one twice at once would mint two sets
        // of blob: URLs for the same upload
        const thumb = await renderMockup(sides[0], 360, {
          mime: "image/jpeg",
          quality: 0.72,
          background: "#F2F3EF",
        });
        const previewFront = sides.includes("front")
          ? await renderMockup("front", 900)
          : null;
        const previewBack = sides.includes("back") ? await renderMockup("back", 900) : null;

        const scene: Record<string, unknown> = {};
        for (const s of ["front", "back"] as Side[]) {
          if (scenes[s]) scene[s] = JSON.parse(scenes[s]!);
        }

        design = { key, name, sides, preview: thumb ?? undefined };

        const payload = {
          productSlug: product.slug,
          colorSlug: slugOfColor,
          name,
          scene,
          previewFront: previewFront ?? undefined,
          previewBack: previewBack ?? undefined,
        };

        try {
          design.publicId = (await api.saveDesign(payload)).publicId;
        } catch {
          await putPendingDesign({ ...payload, key, savedAt: Date.now() });
        }
      }

      addToCartLine({
        productSlug: product.slug,
        colorSlug: colorSlug(color),
        method,
        sizes: sizeQty,
        design,
      });

      setAdded(true);
      setTimeout(() => setAdded(false), 2400);
      openCart();
    } finally {
      setAdding(false);
    }
  };

  const isText = !!selected && ["textbox", "i-text", "text"].includes(selected.type ?? "");
  /** a side only counts once it actually carries artwork - visiting it is not enough */
  const printLocations = Math.max(1, Number(sideHasArt.front) + Number(sideHasArt.back));

  /* ---------------- render ---------------- */
  return (
    <div className="min-h-[100svh] pt-[calc(var(--nav-h)+30px)]">
      <div className="grid lg:grid-cols-[92px_minmax(0,1fr)_360px] xl:grid-cols-[92px_minmax(0,1fr)_400px]">
        {/* ---- tool rail ---- */}
        <aside className="sticky top-[calc(var(--nav-h)+30px)] z-30 flex h-auto shrink-0 gap-1 overflow-x-auto border-b hairline bg-paper px-3 py-2 lg:h-[calc(100svh-var(--nav-h)-30px)] lg:flex-col lg:gap-2 lg:overflow-visible lg:border-b-0 lg:border-r lg:px-2 lg:py-5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] transition ${
                tool === t.id ? "bg-acid text-ink" : "text-ink/50 hover:bg-paper-3 hover:text-ink"
              }`}
            >
              <t.icon size={18} />
              {t.label}
            </button>
          ))}
          <div className="mx-1 h-auto w-px shrink-0 self-stretch bg-ink/10 lg:my-2 lg:h-px lg:w-auto" />
          <button onClick={undo} className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-[10px] uppercase tracking-[0.1em] text-ink/50 hover:bg-paper-3 hover:text-ink">
            <Undo2 size={18} /> Undo
          </button>
          <button onClick={redo} className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-[10px] uppercase tracking-[0.1em] text-ink/50 hover:bg-paper-3 hover:text-ink">
            <Redo2 size={18} /> Redo
          </button>
          <button
            onClick={startOver}
            title="Discard this design and the copy saved on this device"
            className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-[10px] uppercase tracking-[0.1em] text-ink/50 hover:bg-paper-3 hover:text-flame lg:mt-auto"
          >
            <Eraser size={18} /> Reset
          </button>
        </aside>

        {/* ---- canvas stage ---- */}
        <section className="relative flex min-h-[62svh] flex-col items-center justify-center bg-[radial-gradient(ellipse_at_50%_10%,#ffffff_0%,#e9eae4_70%)] px-4 py-8">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            {(["front", "back"] as Side[]).map((s) => (
              <button
                key={s}
                onClick={() => switchSide(s)}
                className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                  side === s ? "bg-ink text-paper" : "border hairline text-ink/60 hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setShowGuide((v) => !v)}
              className="rounded-full border hairline px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/60 hover:text-ink"
            >
              {showGuide ? "Hide" : "Show"} print area
            </button>
            <button
              onClick={exportMockup}
              title="PNG of the garment with your artwork on it"
              className="flex items-center gap-1.5 rounded-full border hairline px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/60 hover:text-ink"
            >
              <Download size={13} /> Mockup
            </button>
            <button
              onClick={exportPng}
              title="Artwork only, transparent background — the file that goes to the press"
              className="flex items-center gap-1.5 rounded-full border hairline px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/60 hover:text-ink"
            >
              <Download size={13} /> Print file
            </button>
          </div>

          <div ref={wrapRef} className="relative w-full max-w-[620px]" style={{ aspectRatio: "600/700" }}>
            <Garment
              type={product.type}
              color={color.hex}
              className="absolute inset-0 h-full w-full drop-shadow-[0_24px_48px_rgba(22,23,27,0.18)]"
            />
            <div data-printbox className="absolute" style={boxStyle}>
              {/* kept mounted and toggled by class: fabric moves the <canvas> into a
                  wrapper of its own, so a sibling React inserts/removes here would
                  reference a node that is no longer a child of this element */}
              <div
                className={`pointer-events-none absolute -inset-px border-2 border-dashed border-acid-2/70 ${
                  showGuide ? "" : "hidden"
                }`}
              >
                <span className="absolute -top-6 left-0 text-[10px] uppercase tracking-[0.14em] text-acid-2/80">
                  {product.printInches.w}&quot; × {product.printInches.h}&quot; · {side}
                </span>
              </div>
              {/* the canvas gets its own host so fabric's DOM surgery stays isolated */}
              <div>
                <canvas ref={canvasElRef} />
              </div>
            </div>
            {!ready && (
              <div className="absolute inset-0 grid place-items-center">
                <Loader2 className="animate-spin text-acid-2" />
              </div>
            )}
          </div>

          {dpiWarn && (
            <div className="mt-5 flex max-w-md items-start gap-2 rounded-xl border border-flame/40 bg-flame/10 px-4 py-3 text-[12px] text-flame">
              <Info size={15} className="mt-0.5 shrink-0" /> {dpiWarn}
            </div>
          )}

          {/* only once there is something worth coming back to */}
          <InstallPrompt active={sideHasArt.front || sideHasArt.back} />

          {/* selection toolbar */}
          {selected && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 rounded-full border hairline bg-paper/90 px-2 py-2 backdrop-blur">
              {[
                { icon: AlignCenter, label: "Center", fn: (o: FabricNS.FabricObject, c: FabricNS.Canvas) => { o.set({ left: c.getWidth() / 2, originX: "center" }); o.setCoords(); } },
                { icon: ArrowUp, label: "Forward", fn: (o: FabricNS.FabricObject, c: FabricNS.Canvas) => c.bringObjectForward(o) },
                { icon: ArrowDown, label: "Back", fn: (o: FabricNS.FabricObject, c: FabricNS.Canvas) => c.sendObjectBackwards(o) },
                { icon: RotateCw, label: "Rotate", fn: (o: FabricNS.FabricObject) => o.rotate(((o.angle ?? 0) + 15) % 360) },
                { icon: Copy, label: "Duplicate", fn: async (o: FabricNS.FabricObject, c: FabricNS.Canvas) => { const cl = await o.clone(); cl.set({ left: (o.left ?? 0) + 16, top: (o.top ?? 0) + 16 }); c.add(cl); c.setActiveObject(cl); } },
                { icon: Trash2, label: "Delete", fn: (o: FabricNS.FabricObject, c: FabricNS.Canvas) => { c.remove(o); c.discardActiveObject(); } },
              ].map((b) => (
                <button
                  key={b.label}
                  title={b.label}
                  onClick={() => act(b.fn)}
                  className="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition hover:bg-acid hover:text-ink"
                >
                  <b.icon size={15} />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ---- right panel ---- */}
        <aside className="border-t hairline bg-paper lg:sticky lg:top-[calc(var(--nav-h)+30px)] lg:h-[calc(100svh-var(--nav-h)-30px)] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="space-y-7 p-5 pb-24">
            {tool === "product" && (
              <Panel title="Choose a blank">
                <div className="grid grid-cols-2 gap-2">
                  {PRODUCTS.map((p) => (
                    <button
                      key={p.slug}
                      onClick={() => { setProduct(p); setColorIdx(0); setMethod(p.method[0]); }}
                      className={`rounded-xl border p-2 text-left transition ${
                        product.slug === p.slug ? "border-acid-2 bg-paper-2" : "hairline hover:bg-paper-3"
                      }`}
                    >
                      <Garment type={p.type} color={p.colors[0].hex} className="h-20 w-full" />
                      <p className="mt-1 text-[12px] font-semibold">{p.name}</p>
                      <p className="text-[11px] text-ink/40">from ${p.bulkPrice}</p>
                    </button>
                  ))}
                </div>
                <SubTitle>Garment color</SubTitle>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((c, i) => (
                    <button
                      key={c.name}
                      onClick={() => setColorIdx(i)}
                      title={c.name}
                      aria-label={c.name}
                      aria-pressed={i === colorIdx}
                      className={`h-9 w-9 rounded-full border-2 transition hover:scale-105 ${
                        i === colorIdx ? "border-acid-2" : "border-ink/15"
                      }`}
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
                <SubTitle>Print method</SubTitle>
                <div className="flex flex-wrap gap-1.5">
                  {product.method.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      aria-pressed={m === method}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                        m === method
                          ? "bg-ink text-paper"
                          : "border hairline text-ink/55 hover:text-ink"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-ink/45">{product.blurb}</p>
              </Panel>
            )}

            {tool === "upload" && (
              <Panel title="Upload your artwork">
                <label className="checker flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/20 p-10 text-center transition hover:border-acid-2">
                  <Upload size={22} className="text-acid-2" />
                  <span className="text-[13px] font-semibold">Drop a file or browse</span>
                  <span className="text-[11px] text-ink/50">PNG · JPG · SVG · up to {MAX_UPLOAD_MB} MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                  />
                </label>
                <ul className="space-y-2 text-[12px] text-ink/45">
                  <li>• Transparent PNG gives the cleanest DTG print.</li>
                  <li>• We flag anything under 150 DPI automatically.</li>
                  <li>• Vector (SVG/AI) is best for screen printing.</li>
                  <li>• Keep artwork fully opaque — on DTG the alpha channel drives the white underbase, so partial opacity bands or vanishes.</li>
                </ul>
              </Panel>
            )}

            {tool === "text" && (
              <Panel title="Text">
                <button
                  onClick={() => addText()}
                  className="w-full rounded-full bg-acid py-3 text-[12px] font-bold uppercase tracking-[0.14em] text-ink"
                >
                  + Add a text layer
                </button>
                {isText && selected ? (
                  <>
                    <SubTitle>Content</SubTitle>
                    <textarea
                      value={(selected as FabricNS.Textbox).text ?? ""}
                      onChange={(e) => setProp({ text: e.target.value })}
                      rows={2}
                      className="w-full rounded-xl border hairline bg-paper-2 p-3 text-sm outline-none focus:border-acid-2"
                    />
                    <SubTitle>Font</SubTitle>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FONTS.map((f) => (
                        <button
                          key={f.label}
                          onClick={() => setProp({ fontFamily: f.css })}
                          style={{ fontFamily: f.css }}
                          className={`rounded-lg border px-2 py-2 text-[13px] transition ${
                            (selected as FabricNS.Textbox).fontFamily === f.css
                              ? "border-acid-2 bg-paper-2"
                              : "hairline hover:bg-paper-3"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <SubTitle>Ink color</SubTitle>
                    <Swatches onPick={(hex) => setProp({ fill: hex })} />
                    <SubTitle>Letter spacing</SubTitle>
                    <input
                      type="range" min={-50} max={400}
                      value={(selected as FabricNS.Textbox).charSpacing ?? 0}
                      onChange={(e) => setProp({ charSpacing: +e.target.value })}
                      className="w-full accent-acid-2"
                    />
                    <SubTitle>Outline</SubTitle>
                    <div className="flex gap-2">
                      <button onClick={() => setProp({ stroke: "#151517", strokeWidth: 2 })} className="flex-1 rounded-lg border hairline py-2 text-[12px] hover:bg-paper-3">Dark</button>
                      <button onClick={() => setProp({ stroke: "#F7F5F0", strokeWidth: 2 })} className="flex-1 rounded-lg border hairline py-2 text-[12px] hover:bg-paper-3">Light</button>
                      <button onClick={() => setProp({ strokeWidth: 0 })} className="flex-1 rounded-lg border hairline py-2 text-[12px] hover:bg-paper-3">None</button>
                    </div>
                  </>
                ) : (
                  <p className="text-[12px] text-ink/45">Select a text layer on the garment to edit it.</p>
                )}
              </Panel>
            )}

            {tool === "art" && (
              <Panel title="Clip art library">
                <p className="text-[12px] text-ink/45">
                  {CLIPART.length} of 4,200 licensed graphics shown in this preview.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {CLIPART.map((c) => (
                    <button
                      key={c.name}
                      title={c.name}
                      onClick={() => addClip(c.svg)}
                      className="aspect-square rounded-xl border hairline p-2 text-ink/80 transition hover:border-acid-2 hover:bg-paper-3 hover:text-acid-2"
                      dangerouslySetInnerHTML={{ __html: c.svg }}
                    />
                  ))}
                </div>
              </Panel>
            )}

            {tool === "ai" && (
              <Panel title="Generate art with AI">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  placeholder="e.g. vintage sunset surf club badge"
                  className="w-full rounded-xl border hairline bg-paper-2 p-3 text-sm outline-none focus:border-acid-2"
                />
                <div className="flex flex-wrap gap-1.5">
                  {["Retro badge", "Skate punk", "Varsity", "Minimal line art"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setAiPrompt(p)}
                      className="rounded-full border hairline px-3 py-1.5 text-[11px] text-ink/60 hover:text-ink"
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  onClick={generateAi}
                  disabled={aiBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-acid py-3 text-[12px] font-bold uppercase tracking-[0.14em] text-ink disabled:opacity-60"
                >
                  {aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {aiBusy ? "Drawing…" : "Generate"}
                </button>
                <p className="rounded-xl bg-paper-2 p-3 text-[11px] leading-relaxed text-ink/45">
                  Preview build: this renders a local vector badge so you can see the flow. Swap in
                  an image model + background removal for production.
                </p>
              </Panel>
            )}

            {tool === "layers" && (
              <Panel title={`Layers · ${side}`}>
                {objects.length === 0 && (
                  <p className="text-[12px] text-ink/45">Nothing on this side yet.</p>
                )}
                <div className="space-y-1.5">
                  {[...objects].reverse().map((o, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const c = canvasRef.current;
                        if (!c) return;
                        c.setActiveObject(o);
                        c.renderAll();
                        sync();
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[12px] transition ${
                        selected === o ? "border-acid-2 bg-paper-2" : "hairline hover:bg-paper-3"
                      }`}
                    >
                      <span className="truncate">
                        {o.type === "textbox"
                          ? `“${((o as FabricNS.Textbox).text ?? "").slice(0, 20)}”`
                          : o.type === "image"
                          ? "Uploaded image"
                          : "Graphic"}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-ink/35">{o.type}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            )}

            {/* size grid + price — always visible */}
            <div className="rounded-2xl border hairline bg-paper-2 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
                Sizes &amp; quantity
              </p>
              <div className="mt-3">
                <SizeGrid
                  value={sizeQty}
                  onChange={setQtyBySize}
                  layout="panel"
                  idPrefix="studio"
                  sizes={sizeRun}
                />
              </div>

              <div className="mt-4 space-y-1.5 border-t hairline pt-4 text-[13px]">
                <Row l="Units" r={String(totalQty)} />
                <Row l="Per unit" r={`$${priced.baseUnitPrice.toFixed(2)}`} />
                {priced.tier.off > 0 && (
                  <Row
                    l={`${priced.tier.min}+ tier`}
                    r={`− $${priced.savings.toFixed(2)}`}
                  />
                )}
                <Row l="Print locations" r={String(printLocations)} />
                <Row l="Total" r={`$${total.toFixed(2)}`} strong />
              </div>

              <button
                onClick={addToCart}
                disabled={totalQty === 0 || adding || !ready}
                data-testid="studio-add-to-cart"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-acid py-3.5 text-[12px] font-bold uppercase tracking-[0.14em] text-ink transition disabled:opacity-40"
              >
                {adding ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : added ? (
                  <Check size={15} />
                ) : (
                  <ShoppingBag size={15} />
                )}
                {adding ? "Adding…" : added ? "Added to cart" : "Add to cart"}
              </button>
              {added ? (
                <p className="mt-2.5 text-center text-[11px] text-ink/50">
                  <Link href="/cart" className="font-semibold text-acid-2 hover:underline">
                    View cart
                  </Link>{" "}
                  ·{" "}
                  <Link href="/checkout" className="font-semibold text-acid-2 hover:underline">
                    checkout
                  </Link>
                </p>
              ) : (
                <p className="mt-2.5 text-center text-[10px] uppercase tracking-[0.14em] text-ink/35">
                  Free proof · ships in 3–5 days
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- small UI bits ---------------- */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="display text-[20px]">{title}</h2>
      {children}
    </div>
  );
}
function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">{children}</p>
  );
}
function Row({ l, r, strong }: { l: string; r: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink/50">{l}</span>
      <span className={strong ? "font-semibold text-acid-2" : ""}>{r}</span>
    </div>
  );
}
function Swatches({ onPick }: { onPick: (hex: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {INK_COLORS.map((hex) => (
        <button
          key={hex}
          onClick={() => onPick(hex)}
          className="h-7 w-7 rounded-full border border-ink/15 transition hover:scale-110"
          style={{ background: hex }}
        />
      ))}
    </div>
  );
}
