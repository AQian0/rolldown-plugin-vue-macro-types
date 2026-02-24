import { parseSync } from 'oxc-parser'

type DefinePropsMatch = {
  typeArg: string
  matchIndex: number
  fullMatch: string
}

/**
 * 使用 oxc-parser 定位 defineProps<T>() 调用
 * 替代正则表达式 /defineProps\s*<([^>]+)>\s*\(\)/
 */
export const locateDefinePropsWithOxc = (
  scriptContent: string,
): DefinePropsMatch | undefined => {
  try {
    const result = parseSync('virtual.ts', scriptContent, {
      sourceFilename: 'virtual.ts',
    })

    if (result.errors.length > 0) {
      console.warn('[oxc] Parse errors:', result.errors)
      return undefined
    }

    // 遍历 AST 查找 defineProps 调用
    const { program } = result
    let match: DefinePropsMatch | undefined

    const visit = (node: any): void => {
      if (!node || typeof node !== 'object') return

      // 查找调用表达式：defineProps<T>()
      if (
        node.type === 'CallExpression'
        && node.callee?.type === 'Identifier'
        && node.callee.name === 'defineProps'
        && node.typeArguments?.params?.length === 1
      ) {
        const typeParam = node.typeArguments.params[0]
        const callStart = node.start
        const callEnd = node.end

        // 提取类型参数字符串
        const typeArgStart = typeParam.start
        const typeArgEnd = typeParam.end
        const typeArg = scriptContent.slice(typeArgStart, typeArgEnd)

        // 构造完整匹配字符串
        const fullMatch = scriptContent.slice(callStart, callEnd)

        match = {
          typeArg,
          matchIndex: callStart,
          fullMatch,
        }
        return
      }

      // 递归遍历所有属性
      for (const key in node) {
        const value = node[key]
        if (Array.isArray(value)) {
          for (const item of value) {
            visit(item)
          }
        } else if (value && typeof value === 'object') {
          visit(value)
        }
      }
    }

    visit(program)
    return match
  } catch (error) {
    console.error('[oxc] Failed to parse:', error)
    return undefined
  }
}
