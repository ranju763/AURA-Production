import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  return format(d, "h:mm a");
}

export function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return format(d, "MMM dd, yyyy");
}

export function formatDateWithDay(date) {
  if (!date) return "";
  const d = new Date(date);
  return format(d, "MMM dd, EEE");
}
