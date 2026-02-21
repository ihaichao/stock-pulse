import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function importanceColor(importance: string) {
  switch (importance) {
    case "high":
      return "text-red-600 bg-red-50 border-red-200";
    case "medium":
      return "text-yellow-700 bg-yellow-50 border-yellow-200";
    default:
      return "text-green-700 bg-green-50 border-green-200";
  }
}

export function importanceEmoji(importance: string) {
  switch (importance) {
    case "high":
      return "🔴";
    case "medium":
      return "🟡";
    default:
      return "🟢";
  }
}

export function eventTypeIcon(type: string) {
  switch (type) {
    case "earnings":
      return "📊";
    case "macro":
      return "📅";
    case "insider":
      return "👤";
    case "analyst":
      return "📝";
    case "filing":
      return "📄";
    default:
      return "📌";
  }
}
