import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return "0";
  const n = typeof num === "string" ? parseFloat(num) : num;
  return isNaN(n) ? "0" : n.toLocaleString("en-US");
}
