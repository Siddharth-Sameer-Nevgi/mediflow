import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatWaitTime(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} mins`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function generateTokenNumber(): number {
  return Math.floor(1 + Math.random() * 999);
}

export function sanitizeForAI(input: string): string {
  // Strip potential prompt injection characters
  return input
    .replace(/[<>{}]/g, "")
    .replace(/system:/gi, "")
    .replace(/assistant:/gi, "")
    .slice(0, 500);
}
