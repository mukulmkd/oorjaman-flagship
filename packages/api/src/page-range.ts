/** Default page size for admin / vendor table UIs */
export const DEFAULT_TABLE_PAGE_SIZE = 10;

export type PagedParams = {
  /** 1-based page index */
  page: number;
  pageSize?: number;
};

export type PagedResult<T> = { rows: T[]; total: number };

export function clampTablePageSize(raw?: number, max = 100): number {
  return Math.min(max, Math.max(1, Math.floor(raw ?? DEFAULT_TABLE_PAGE_SIZE)));
}

/**
 * Inclusive PostgREST range for a 1-based page.
 * @see https://supabase.com/docs/reference/javascript/range
 */
export function offsetRangeForPage(page: number, pageSize?: number): { from: number; to: number; pageSize: number } {
  const ps = clampTablePageSize(pageSize);
  const p = Math.max(1, Math.floor(page));
  const from = (p - 1) * ps;
  const to = from + ps - 1;
  return { from, to, pageSize: ps };
}
