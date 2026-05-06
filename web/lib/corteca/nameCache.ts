// Server-side account name cache — shared between API routes.
// Keyed by MAC address; empty string means "looked up, no subscriber found".

const cache = new Map<string, string>();

export function getNameCache(): Map<string, string> { return cache; }

export function clearNameCache(): void { cache.clear(); }
