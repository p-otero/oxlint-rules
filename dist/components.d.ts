import type { Context, ESTree, Visitor } from "@oxlint/plugins";
export type ComponentEntry = {
    node: ESTree.Node;
    name: string;
    exported: boolean;
    loc: number;
};
export type ComponentRuleOptions = {
    files?: string;
    exempt?: string;
    maxLoc?: number;
};
export declare const filesSchema: {
    type: string;
    properties: {
        files: {
            type: string;
        };
        exempt: {
            type: string;
        };
    };
    additionalProperties: boolean;
};
export declare const limitsSchema: {
    type: string;
    properties: {
        files: {
            type: string;
        };
        exempt: {
            type: string;
        };
        maxLoc: {
            type: string;
            minimum: number;
        };
    };
    additionalProperties: boolean;
};
export declare function componentOptions(context: Context): ComponentRuleOptions;
export declare function coversFile(options: ComponentRuleOptions, file: string): boolean;
export declare function componentFileStem(file: string): string;
export declare function pascalCase(stem: string): string;
export declare function collectComponents(context: Context, onComplete: (entries: ComponentEntry[]) => void): Visitor;
