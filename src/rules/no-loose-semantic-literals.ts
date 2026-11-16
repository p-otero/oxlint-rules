import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { defineRule, type ESTree } from "@oxlint/plugins";
import { parseSync, visitorKeys } from "oxc-parser";

import { projectPath } from "../paths.ts";

const SOURCE_FILE = /\.[cm]?[jt]sx?$/u;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/u;
const COMPARISON_OPERATORS = new Set(["==", "===", "!=", "!=="]);
const DEFAULT_SKIP_DIRECTORIES = [
  "node_modules",
  "dist",
  "out",
  "coverage",
  "fixtures",
  "e2e",
];
const DEFAULT_TEST_DIRECTORIES = ["test"];

type OxcNode = { type: string } & Record<string, unknown>;

type SemanticOptions = {
  roots?: string[];
  skipDirectories?: string[];
  testDirectories?: string[];
};

type NormalizedOptions = {
  roots: string[];
  skipDirectories: string[];
  testDirectories: string[];
};

const isNode = (value: unknown): value is OxcNode => {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
};

const isStringLiteral = (
  node: OxcNode | undefined,
): node is OxcNode & { value: string } =>
  node?.type === "Literal" && typeof node.value === "string";

const normalizeOptions = (options: SemanticOptions): NormalizedOptions => ({
  roots: options.roots ?? ["."],
  skipDirectories: options.skipDirectories ?? DEFAULT_SKIP_DIRECTORIES,
  testDirectories: options.testDirectories ?? DEFAULT_TEST_DIRECTORIES,
});

const normalizeRoot = (root: string) =>
  root.replace(/^\.\//u, "").replace(/\/$/u, "");

function inScope(relativePath: string, options: NormalizedOptions): boolean {
  const matching = options.roots
    .map(normalizeRoot)
    .find(
      (root) =>
        root === "." ||
        root === "" ||
        relativePath === root ||
        relativePath.startsWith(`${root}/`),
    );
  if (matching === undefined) return false;
  const nested =
    matching === "." || matching === ""
      ? relativePath
      : relativePath.slice(matching.length + 1);
  const segments = nested.split("/");
  const fileName = segments.pop();
  if (fileName === undefined || !SOURCE_FILE.test(fileName)) return false;
  if (segments.some((segment) => options.skipDirectories.includes(segment))) {
    return false;
  }
  const inTestDirectory = segments.some((segment) =>
    options.testDirectories.includes(segment),
  );
  return !inTestDirectory || TEST_FILE.test(fileName);
}

function walk(node: unknown, visit: (node: OxcNode) => void): void {
  if (!isNode(node)) return;
  visit(node);
  for (const key of visitorKeys[node.type] ?? []) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) walk(item, visit);
    } else {
      walk(child, visit);
    }
  }
}

function exportedConstInitializers(program: OxcNode): OxcNode[] {
  const initializers: OxcNode[] = [];
  if (!Array.isArray(program.body)) return initializers;
  for (const statement of program.body) {
    if (!isNode(statement) || statement.type !== "ExportNamedDeclaration") {
      continue;
    }
    const declaration = statement.declaration;
    if (!isNode(declaration) || declaration.type !== "VariableDeclaration") {
      continue;
    }
    if (!Array.isArray(declaration.declarations)) continue;
    for (const declarator of declaration.declarations) {
      if (!isNode(declarator) || !isNode(declarator.init)) continue;
      const init = declarator.init;
      if (init.type !== "TSAsExpression" || !isNode(init.typeAnnotation)) {
        continue;
      }
      const annotation = init.typeAnnotation;
      if (
        annotation.type !== "TSTypeReference" ||
        !isNode(annotation.typeName)
      ) {
        continue;
      }
      const typeName = annotation.typeName;
      if (
        typeName.type !== "Identifier" ||
        typeName.name !== "const" ||
        annotation.typeArguments
      ) {
        continue;
      }
      initializers.push(init);
    }
  }
  return initializers;
}

function listSourceFiles(
  directory: string,
  options: NormalizedOptions,
): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!options.skipDirectories.includes(entry.name)) {
        files.push(...listSourceFiles(entryPath, options));
      }
    } else if (inScope(projectPath(entryPath), options)) {
      files.push(entryPath);
    }
  }
  return files;
}

const semanticValuesByOptions = new Map<string, Set<string>>();

function semanticValues(options: NormalizedOptions): Set<string> {
  const key = JSON.stringify([
    process.cwd(),
    options.roots,
    options.skipDirectories,
    options.testDirectories,
  ]);
  const cached = semanticValuesByOptions.get(key);
  if (cached !== undefined) return cached;
  const values = new Set<string>();
  for (const root of options.roots) {
    const directory = path.resolve(process.cwd(), root);
    if (!existsSync(directory)) continue;
    for (const file of listSourceFiles(directory, options)) {
      const parsed = parseSync(file, readFileSync(file, "utf8"));
      for (const initializer of exportedConstInitializers(
        parsed.program as unknown as OxcNode,
      )) {
        walk(initializer.expression, (node) => {
          if (isStringLiteral(node)) values.add(node.value);
        });
      }
    }
  }
  semanticValuesByOptions.set(key, values);
  return values;
}

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Semantic strings come from exported `as const` objects, not literals or literal unions.",
    },
    schema: [
      {
        type: "object",
        properties: {
          roots: { type: "array", items: { type: "string" } },
          skipDirectories: { type: "array", items: { type: "string" } },
          testDirectories: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = normalizeOptions(
      (context.options[0] ?? {}) as SemanticOptions,
    );
    if (!inScope(projectPath(context.filename), options)) return {};

    const values = semanticValues(options);
    let constantRanges: Array<[number, number]> = [];
    const insideConstant = (node: ESTree.Node) =>
      constantRanges.some(
        ([start, end]) => node.start >= start && node.end <= end,
      );

    const reportLoose = (literal: ESTree.StringLiteral) => {
      if (
        literal.parent?.type === "TSLiteralType" &&
        literal.parent.parent?.type === "TSIndexedAccessType"
      ) {
        return;
      }
      if (!values.has(literal.value) || insideConstant(literal)) return;
      context.report({
        node: literal,
        message: `loose semantic literal ${JSON.stringify(literal.value)}: use the exported \`as const\` object`,
      });
    };

    return {
      Program(program) {
        constantRanges = exportedConstInitializers(
          program as unknown as OxcNode,
        ).map((initializer) => [
          initializer.start as number,
          initializer.end as number,
        ]);
      },
      TSTypeAliasDeclaration(node) {
        if (node.typeAnnotation.type !== "TSUnionType") return;
        const literals = node.typeAnnotation.types.filter(
          (member) =>
            member.type === "TSLiteralType" &&
            member.literal.type === "Literal" &&
            typeof member.literal.value === "string",
        );
        if (literals.length > 1) {
          context.report({
            node,
            message: `literal union ${node.id.name}: derive the type from an exported \`as const\` object`,
          });
        }
      },
      BinaryExpression(node) {
        if (!COMPARISON_OPERATORS.has(node.operator)) return;
        for (const side of [node.left, node.right]) {
          if (side.type === "Literal" && typeof side.value === "string") {
            reportLoose(side);
          }
        }
      },
      TSLiteralType(node) {
        if (
          node.literal.type === "Literal" &&
          typeof node.literal.value === "string"
        ) {
          reportLoose(node.literal);
        }
      },
    };
  },
});
