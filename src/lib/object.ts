export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
export function hasOwn(record: Record<string, unknown>, key: string): boolean { return Object.prototype.hasOwnProperty.call(record, key); }
