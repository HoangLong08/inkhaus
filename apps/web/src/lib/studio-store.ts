"use client";

import { openDB, type IDBPDatabase } from "idb";

/**
 * Local persistence for the design studio.
 *
 * The scene and the uploaded artwork are stored apart on purpose. fabric
 * serialises an image's `src` verbatim, and uploads enter the canvas as
 * `URL.createObjectURL(file)` - a blob: URL is scoped to the document that
 * minted it, so a scene saved with one in it restores pointing at nothing.
 *
 * So: the Blob goes into `assets` under a uuid, the fabric object carries only
 * that uuid (`inkhausAssetId`), and hydrate() mints fresh blob URLs on the way
 * back in. It also keeps the 40-deep undo stack cheap - those snapshots hold
 * short uuid-bearing JSON rather than megabytes of base64.
 */

const DB_NAME = "inkhaus-studio";
const DB_VERSION = 1;
const DRAFTS = "drafts";
const ASSETS = "assets";
const CURRENT = "current";

/** the custom fabric property that links a canvas object to an `assets` row */
export const ASSET_PROP = "inkhausAssetId";

export type Side = "front" | "back";

export interface StudioDraft {
  /** bump when the shape below changes; loadDraft() drops anything older */
  schema: 1;
  productSlug: string;
  colorIdx: number;
  side: Side;
  qtyBySize: Record<string, number>;
  scenes: Record<Side, string | null>;
  savedAt: number;
}

interface StoredAsset {
  id: string;
  blob: Blob;
  name: string;
  type: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (typeof indexedDB === "undefined") return null;
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(DRAFTS)) database.createObjectStore(DRAFTS);
      if (!database.objectStoreNames.contains(ASSETS)) {
        database.createObjectStore(ASSETS, { keyPath: "id" });
      }
    },
  });
  return dbPromise;
}

/**
 * Every entry point swallows its own failure. Private windows, disabled site
 * data and a full disk all throw here, and none of them are a reason for the
 * studio to stop working - the user just loses the safety net.
 */
async function safely<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const handle = db();
    if (!handle) return fallback;
    return await work();
  } catch (err) {
    console.warn("[studio-store]", err);
    return fallback;
  }
}

/* ---------------- assets ---------------- */

export async function putAsset(id: string, file: File): Promise<boolean> {
  return safely(async () => {
    const record: StoredAsset = { id, blob: file, name: file.name, type: file.type };
    await (await db())!.put(ASSETS, record);
    return true;
  }, false);
}

export async function getAsset(id: string): Promise<Blob | null> {
  return safely(async () => {
    const record = (await (await db())!.get(ASSETS, id)) as StoredAsset | undefined;
    return record?.blob ?? null;
  }, null);
}

/**
 * Mark and sweep. Deleting a layer from the canvas does not delete its upload,
 * and neither does starting a new design, so without this every image the user
 * ever placed accumulates forever - at up to 20 MB each.
 */
export async function sweepAssets(keep: Iterable<string>): Promise<void> {
  await safely(async () => {
    const live = new Set(keep);
    const handle = (await db())!;
    const keys = (await handle.getAllKeys(ASSETS)) as string[];
    await Promise.all(keys.filter((k) => !live.has(k)).map((k) => handle.delete(ASSETS, k)));
  }, undefined);
}

/* ---------------- draft ---------------- */

/** the asset ids referenced by a serialised scene, for sweeping */
export function assetIdsIn(scenes: Record<Side, string | null>): string[] {
  const ids: string[] = [];
  for (const json of Object.values(scenes)) {
    if (!json) continue;
    try {
      for (const obj of JSON.parse(json).objects ?? []) {
        if (typeof obj?.[ASSET_PROP] === "string") ids.push(obj[ASSET_PROP]);
      }
    } catch {
      /* a corrupt side should not stop the other one from being swept */
    }
  }
  return ids;
}

export async function saveDraft(draft: StudioDraft): Promise<boolean> {
  return safely(async () => {
    const handle = (await db())!;
    const write = () => handle.put(DRAFTS, draft, CURRENT);
    try {
      await write();
    } catch (err) {
      // out of quota: the orphaned uploads are the only thing worth reclaiming,
      // so sweep and give it exactly one more go rather than looping
      if ((err as DOMException)?.name !== "QuotaExceededError") throw err;
      await sweepAssets(assetIdsIn(draft.scenes));
      await write();
    }
    return true;
  }, false);
}

export async function loadDraft(): Promise<StudioDraft | null> {
  return safely(async () => {
    const draft = (await (await db())!.get(DRAFTS, CURRENT)) as StudioDraft | undefined;
    return draft?.schema === 1 ? draft : null;
  }, null);
}

export async function clearAll(): Promise<void> {
  await safely(async () => {
    const handle = (await db())!;
    await handle.delete(DRAFTS, CURRENT);
    await handle.clear(ASSETS);
  }, undefined);
}

/**
 * Ask the browser not to evict us under storage pressure. Best effort only:
 * Chrome grants it on engagement, Safari ties it to notification permission and
 * will simply answer false. Never prompt for anything on the back of it.
 */
export function requestPersistence(): void {
  void navigator.storage?.persist?.().catch(() => false);
}
