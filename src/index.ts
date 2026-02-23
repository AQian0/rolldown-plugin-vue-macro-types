import type { Plugin } from 'rolldown'
import { parse } from '@vue/compiler-sfc'

type VueMacroTypesOptions = {
  // 未来可扩展：tsconfig 路径等
}

export const vueMacroTypes = (_options: VueMacroTypesOptions = {}): Plugin => {
  return {
    name: 'vue-macro-types',

    transform: {
      filter: {
        id: /\.vue$/,
      },
      order: 'pre',
      handler(code, id) {

        const { descriptor } = parse(code, { filename: id })
        const scriptSetup = descriptor.scriptSetup
        if (!scriptSetup || scriptSetup.lang !== 'ts') return

        // 简单检测：是否包含 defineProps 的类型参数调用
        const definePropsMatch = scriptSetup.content.match(
          /defineProps\s*<([^>]+)>\s*\(\)/,
        )
        if (!definePropsMatch) return

        const typeArg = definePropsMatch[1]!.trim()
        console.log(`[vue-macro-types] 检测到 defineProps<${typeArg}>() in ${id}`)

        // TODO: 第 2 步 - 用 TS typeChecker 解析 typeArg
      },
    },
  }
}
