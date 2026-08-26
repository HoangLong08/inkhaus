"use client";

import { useEffect, useState } from "react";

/**
 * The order numbers this browser has placed.
 *
 * There is no customer login yet, and `GET /orders/:number` is the only way back
 * to an order, so without this a customer who closes the confirmation tab has
 * nothing but the email. Purely a convenience index: the order itself lives on
 * the server, and anyone can look one up by number.
 */

const KEY = "inkhaus-orders-v1";
const MAX = 12;

export type RecentOrder = {
  number: string;
  total: number;
  quantity: number;
  placedAt: number;
};

function read(): RecentOrder[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is RecentOrder => typeof o?.number === "string" && typeof o?.placedAt === "number",
    );
  } catch {
    return [];
  }
}

function write(orders: RecentOrder[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(orders.slice(0, MAX)));
  } catch {
    /* private mode / quota — the order still exists on the server */
  }
}

export function rememberOrder(order: RecentOrder) {
  write([order, ...read().filter((o) => o.number !== order.number)]);
  window.dispatchEvent(new Event("inkhaus:orders"));
}

/** Reads on mount only, so server and first client render agree. */
export function useRecentOrders() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);

  useEffect(() => {
    const sync = () => setOrders(read());
    sync();
    window.addEventListener("inkhaus:orders", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("inkhaus:orders", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return orders;
}
