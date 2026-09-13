/** Keeps API-generated and previously stored copy consistent with Pore's voice. */
export function removeEmDashes(value: string): string {
  return value.replace(/\s*(?:\u2014|\u00e2\u20ac\u201d)\s*/g, ", ");
}

/** Recursively cleans JSON-shaped data without mutating the source object. */
export function sanitizeAppCopy<T>(value: T): T {
  if (typeof value === "string") return removeEmDashes(value) as T;
  if (Array.isArray(value)) return value.map(sanitizeAppCopy) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        sanitizeAppCopy(child),
      ]),
    ) as T;
  }
  return value;
}
