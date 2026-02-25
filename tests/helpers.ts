import { vueMacroTypes } from "../src/index";

export type TransformResult = { code: string; map: unknown };
type TransformHandler = (code: string, id: string) => TransformResult | undefined;

const createSfc = (scriptContent: string, lang = "ts"): string =>
  `<script setup lang="${lang}">\n${scriptContent}\n</script>\n\n<template>\n  <div></div>\n</template>\n`;

export const getHandler = (): TransformHandler => {
  const plugin = vueMacroTypes();
  const transform = plugin.transform as { handler: TransformHandler };
  return transform.handler.bind(null as never);
};

export const transformSfc = (
  scriptContent: string,
  options?: { lang?: string },
): TransformResult | undefined => {
  const handler = getHandler();
  const code = createSfc(scriptContent, options?.lang);
  return handler(code, "/tmp/test/Component.vue");
};

export const extractDefinePropsType = (result: TransformResult): string | null => {
  const match = result.code.match(/defineProps<([\s\S]+?)>\(\)/);
  return match?.[1]?.trim() ?? null;
};
