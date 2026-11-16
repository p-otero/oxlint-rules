import path from "node:path";
export function projectPath(filename) {
    return path
        .relative(process.cwd(), path.resolve(filename))
        .split(path.sep)
        .join("/");
}
export function compilePattern(source) {
    return source === undefined ? undefined : new RegExp(source, "u");
}
export function matchesPattern(pattern, value) {
    return pattern === undefined || pattern.test(value);
}
