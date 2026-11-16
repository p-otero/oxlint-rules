import { formatLabel } from "./app.ts";

export function UserCard({ label }: { label: string }) {
  return <div>{formatLabel(label)}</div>;
}
