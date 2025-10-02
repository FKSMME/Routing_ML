export type ClassValue = string | number | false | null | undefined | Record<string, boolean>;

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];
  for (const value of values) {
    if (!value && value !== 0) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number") {
      if (String(value).trim()) {
        classes.push(String(value).trim());
      }
      continue;
    }
    if (typeof value === "object") {
      for (const [key, active] of Object.entries(value)) {
        if (active) {
          classes.push(key);
        }
      }
    }
  }
  return classes.join(" ");
}
