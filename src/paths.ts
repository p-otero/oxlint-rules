import path from "node:path";

export function projectPath(filename: string): string {
  return path
    .relative(process.cwd(), path.resolve(filename))
    .split(path.sep)
    .join("/");
}

export function compilePattern(source: string | undefined): RegExp | undefined {
  return source === undefined ? undefined : new RegExp(source, "u");
}

export function matchesPattern(
  pattern: RegExp | undefined,
  value: string,
): boolean {
  return pattern === undefined || pattern.test(value);
}
