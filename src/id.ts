import { createHash } from 'node:crypto';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function timestamp(): string {
  return new Date().toISOString();
}

export function stableId(prefix: string, parts: string[]): string {
  const hash = createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 8);
  return `${slugify(prefix)}-${hash}`;
}

export function nextId(prefix: string, existing: Iterable<{ id: string }>): string {
  const used = new Set([...existing].map((item) => item.id));
  let index = used.size + 1;
  let candidate = `${slugify(prefix)}-${String(index).padStart(3, '0')}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${slugify(prefix)}-${String(index).padStart(3, '0')}`;
  }
  return candidate;
}
