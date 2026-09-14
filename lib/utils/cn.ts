import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names.
 *
 * `clsx` handles the conditional logic (`isActive && "bg-white"`), and
 * `twMerge` resolves conflicts so a class passed in by a caller wins over the
 * component's default — `cn("p-4", "p-6")` gives `p-6`, not both.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
