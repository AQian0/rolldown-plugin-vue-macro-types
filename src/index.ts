import type { Plugin } from "rolldown";
import { parse } from "@vue/compiler-sfc";
import ts from "typescript";
import path from "node:path";
import MagicString from "magic-string";
import { locateDefinePropsWithOxc } from "./locateDefineProps.ts";
import { serializeType } from "./serializeType.ts";
import { createLanguageServiceManager } from "./languageService.ts";
import type { VueMacroTypesOptions } from "./types.ts";

export type { VueMacroTypesOptions } from "./types.ts";

export const vueMacroTypes = (options: VueMacroTypesOptions = {}): Plugin => {
  const { getService, updateVirtualFile } = createLanguageServiceManager(options);

  return {
    name: "vue-macro-types",

    buildStart() {
      getService(path.join(process.cwd(), "__warmup__.ts"));
    },

    transform: {
      filter: {
        id: /\.vue$/,
        code: /defineProps\s*</,
      },
      order: "pre",
      handler(code, id) {
        const { descriptor } = parse(code, { filename: id });
        const scriptSetup = descriptor.scriptSetup;
        if (!scriptSetup || scriptSetup.lang !== "ts") return;

        const definePropsMatch = locateDefinePropsWithOxc(scriptSetup.content);
        if (!definePropsMatch) return;

        const virtualFileName = id + ".__setup.ts";
        updateVirtualFile(virtualFileName, scriptSetup.content);

        const svc = getService(id);
        const program = svc.getProgram();
        if (!program) return;

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(virtualFileName);
        if (!sourceFile) return;

        const typeArgPos = definePropsMatch.typeArgStart;
        let resolvedType: ts.Type | undefined;

        const visit = (node: ts.Node): void => {
          if (resolvedType) return;
          if (node.end <= typeArgPos || node.pos > typeArgPos) return;

          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "defineProps" &&
            node.typeArguments?.length === 1
          ) {
            resolvedType = checker.getTypeFromTypeNode(node.typeArguments[0]!);
            return;
          }
          ts.forEachChild(node, visit);
        };
        visit(sourceFile);

        if (!resolvedType) return;

        const typeString = serializeType(resolvedType, checker);

        const offset = scriptSetup.loc.start.offset;
        const replaceStart = offset + definePropsMatch.typeArgStart;
        const replaceEnd = offset + definePropsMatch.typeArgEnd;

        const s = new MagicString(code);
        s.overwrite(replaceStart, replaceEnd, typeString);

        return {
          code: s.toString(),
          map: s.generateMap({ hires: true }),
        };
      },
    },
  };
};
