import type { Plugin } from 'rolldown'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import path from 'node:path'
import MagicString from 'magic-string'
import { locateDefinePropsWithOxc } from './locateDefineProps.ts'
import { serializeType } from './serializeType.ts'
import { createLanguageServiceManager } from './languageService.ts'
import type { VueMacroTypesOptions } from './types.ts'

export type { VueMacroTypesOptions } from './types.ts'

export const vueMacroTypes = (options: VueMacroTypesOptions = {}): Plugin => {
  const { getService, updateVirtualFile } = createLanguageServiceManager(options)

  return {
    name: 'vue-macro-types',

    buildStart() {
      // 预热 LanguageService，将初始化开销从首次 transform 中移出
      getService(path.join(process.cwd(), '__warmup__.ts'))
    },

    transform: {
      filter: {
        id: /\.vue$/,
        code: /defineProps\s*</,
      },
      order: 'pre',
      handler(code, id) {
        const { descriptor } = parse(code, { filename: id })
        const scriptSetup = descriptor.scriptSetup
        if (!scriptSetup || scriptSetup.lang !== 'ts') return

        // 使用 oxc-parser 定位 defineProps<T>() 调用
        const definePropsMatch = locateDefinePropsWithOxc(scriptSetup.content)
        if (!definePropsMatch) return

        // 更新虚拟文件并从共享 LanguageService 获取 program
        const virtualFileName = id + '.__setup.ts'
        updateVirtualFile(virtualFileName, scriptSetup.content)

        const svc = getService(id)
        const program = svc.getProgram()
        if (!program) return

        const checker = program.getTypeChecker()
        const sourceFile = program.getSourceFile(virtualFileName)
        if (!sourceFile) return

        // 利用 OXC 已知偏移量做位置引导的 AST 搜索，仅遍历包含目标位置的分支
        const typeArgPos = definePropsMatch.typeArgStart
        let resolvedType: ts.Type | undefined

        const visit = (node: ts.Node): void => {
          if (resolvedType) return
          if (node.end <= typeArgPos || node.pos > typeArgPos) return

          if (
            ts.isCallExpression(node)
            && ts.isIdentifier(node.expression)
            && node.expression.text === 'defineProps'
            && node.typeArguments?.length === 1
          ) {
            resolvedType = checker.getTypeFromTypeNode(node.typeArguments[0]!)
            return
          }
          ts.forEachChild(node, visit)
        }
        visit(sourceFile)

        if (!resolvedType) return

        const typeString = serializeType(resolvedType, checker)

        // 替换源码中的类型参数
        const offset = scriptSetup.loc.start.offset
        const replaceStart = offset + definePropsMatch.typeArgStart
        const replaceEnd = offset + definePropsMatch.typeArgEnd

        const s = new MagicString(code)
        s.overwrite(replaceStart, replaceEnd, typeString)

        return {
          code: s.toString(),
          map: s.generateMap({ hires: true }),
        }
      },
    },
  }
}
