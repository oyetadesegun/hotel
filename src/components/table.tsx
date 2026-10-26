import type { ReactNode } from "react";

/** Simple data table. Pass headers and rows of cells. */
export function Table({
  heads,
  rows,
  highlight,
}: {
  heads: string[];
  rows: ReactNode[][];
  /** Row indexes to tint amber (needs action). */
  highlight?: number[];
}) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          {heads.map((h, i) => (
            <th key={h + i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className={highlight?.includes(ri) ? "bg-amber-50" : undefined}>
            {r.map((c, ci) => (
              <td key={ci}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
