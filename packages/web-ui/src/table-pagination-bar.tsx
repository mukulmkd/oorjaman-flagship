import { DEFAULT_TABLE_PAGE_SIZE } from "@oorjaman/api";
import { Button } from "./button";

type Props = {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (nextPage: number) => void;
};

export function TablePaginationBar({ page, pageSize = DEFAULT_TABLE_PAGE_SIZE, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const from = total === 0 ? 0 : (p - 1) * pageSize + 1;
  const to = Math.min(total, p * pageSize);

  return (
    <div className="tbl-pager" role="navigation" aria-label="Pagination">
      <span className="tbl-pager-meta">
        {from}-{to} of {total}
      </span>
      <div className="tbl-pager-nav">
        <Button type="button" size="sm" variant="outline" disabled={p <= 1} onClick={() => onPageChange(p - 1)}>
          Previous
        </Button>
        <span className="tbl-pager-page">
          Page {p} / {totalPages}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={p >= totalPages || total === 0}
          onClick={() => onPageChange(p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
