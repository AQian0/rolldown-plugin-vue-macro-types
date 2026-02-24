import { parseSync } from 'oxc-parser'

type DefinePropsMatch = {
  typeArg: string
  typeArgStart: number
  typeArgEnd: number
}

const createUtf8ToUtf16Converter = (sourceText: string) => {
  const sourceTextUtf8 = new TextEncoder().encode(sourceText)
  return (byteOffset: number): number =>
    new TextDecoder().decode(sourceTextUtf8.slice(0, byteOffset)).length
}

/**
 * 使用 oxc-parser 定位 defineProps<T>() 调用
 * 替代正则表达式 /defineProps\s*<([^>]+)>\s*\(\)/
 */
export const locateDefinePropsWithOxc = (
  scriptContent: string,
): DefinePropsMatch | undefined => {
  try {
    const result = parseSync('virtual.ts', scriptContent)

    if (result.errors.length > 0) {
      console.warn('[oxc] Parse errors:', result.errors)
      return undefined
    }

    const { program } = result
    const toCharIndex = createUtf8ToUtf16Converter(scriptContent)
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
        const typeArgStart = toCharIndex(typeParam.start)
        const typeArgEnd = toCharIndex(typeParam.end)

        match = {
          typeArg: scriptContent.slice(typeArgStart, typeArgEnd),
          typeArgStart,
          typeArgEnd,
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
