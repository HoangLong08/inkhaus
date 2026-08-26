"use client";

import { openDB, type IDBPDatabase } from "idb";

/**
 * The artwork behind a customised cart line.
 *
 * `POST /designs` is what turns a canvas into something the press can be handed,
 * and it is attempted the moment the line is added. When the API is down —
 * which the storefront is built to survive — the payload is parked here instead,
 * and checkout retries it before placing the order.
 *
 * Why not localStorage, next to the cart itself: a scene with a few clip-art
 * groups in it is tens of kilobytes of path data and the two mockup data-urls
 * are far more than that. The cart carries only the small thumbnail it renders.
 *
 * Caveat worth knowing: a scene's uploaded images are stored by id against the
 * studio's own `assets` store, which "Start over" clears. The mockups saved here
 * are flattened data-urls and always survive; the scene may come back missing an
 * upload the user has since discarded.
 */

const DB_NAME = "inkhaus-cart";
const DB_VERSION = 1;
const DESIGNS = "designs";

export interface PendingDesign {
  /** the CartDesign.key it belongs to */
  key: string;
  productSlug: string;
  colorSlug: string;
  name?: string;
  scene: Record<string, unknown>;
  previewFront?: string;
  previewBack?: string;
  savedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (typeof indexedDB === "undefined") return null;
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(DESIGNS)) {
        database.createObjectStore(DESIGNS, { keyPath: "key" });
      }
    },
  });
  return dbPromise;
}

/** Every entry point swallows its own failure — see studio-store for the why. */
async function safely<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const handle = db();
    if (!handle) return fallback;
    return await work();
  } catch (err) {
    console.warn("[cart-designs]", err);
    return fallback;
  }
}

export async function putPendingDesign(design: PendingDesign): Promise<boolean> {
  return safely(async () => {
    await (await db())!.put(DESIGNS, design);
    return true;
  }, false);
}

export async function getPendingDesign(key: string): Promise<PendingDesign | null> {
  return safely(async () => {
    return ((await (await db())!.get(DESIGNS, key)) as PendingDesign | undefined) ?? null;
  }, null);
}

export async function dropPendingDesign(key: string): Promise<void> {
  await safely(async () => {
    await (await db())!.delete(DESIGNS, key);
  }, undefined);
}

/** drop everything the cart no longer references — called after a cart change */
export async function sweepPendingDesigns(keep: Iterable<string>): Promise<void> {
  await safely(async () => {
    const live = new Set(keep);
    const handle = (await db())!;
    const keys = (await handle.getAllKeys(DESIGNS)) as string[];
    await Promise.all(keys.filter((k) => !live.has(k)).map((k) => handle.delete(DESIGNS, k)));
  }, undefined);
}
