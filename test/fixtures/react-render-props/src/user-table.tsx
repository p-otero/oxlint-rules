import type { ReactNode } from "react";

type Row = { id: string; label: string };

type Column = {
  key: string;
  cell: (row: Row) => ReactNode;
};

export function UserTable({ rows }: { rows: ReadonlyArray<Row> }) {
  const columns: ReadonlyArray<Column> = [
    { key: "label", cell: (row) => <span>{row.label}</span> },
    { key: "id", cell: (row) => <code>{row.id}</code> },
  ];

  return (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((column) => (
              <td key={column.key}>{column.cell(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
