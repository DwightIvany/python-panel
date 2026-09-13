export const SEPARATOR_PREFIX = "---";

/** Returns true if a scripts entry is a group separator. */
export function isSeparator(entry: string): boolean {
	return entry.startsWith(SEPARATOR_PREFIX);
}

/** Parses a separator entry into an optional group label. */
export function parseSeparator(entry: string): { label: string | null } {
	const label = entry.slice(SEPARATOR_PREFIX.length).trim();
	return { label: label || null };
}
