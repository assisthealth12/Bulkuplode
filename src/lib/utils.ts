import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseExcelDate(val: unknown): string {
  if (!val) return ''
  if (val instanceof Date) return val.toLocaleDateString('en-IN')
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-IN')
  }
  if (typeof val === 'string' && /^\d{5}(\.\d+)?$/.test(val)) {
     const num = Number(val)
     const d = new Date(Math.round((num - 25569) * 86400 * 1000))
     if (!isNaN(d.getTime())) return d.toLocaleDateString('en-IN')
  }
  return String(val)
}
