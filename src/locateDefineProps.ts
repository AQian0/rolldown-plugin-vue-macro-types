import { parseSync } from 'oxc-parser'

type DefinePropsMatch = {
  typeArg: string
  typeArgStart: number
  typeArgEnd: number
}

/**
 * 创建 UTF-8 byte offset → UTF-16 char offset 的转换器。
 * ASCII 文本直接返回恒等函数（零开销），非 ASCII 则单次遍历构建查找表后 O(1) 查询。
 */
const createByteToCharConverter = (sourceText: string): (byteOffset: number) => number => {
  // Fast path: 全 ASCII 时 byte offset === char offset
  if (!/[^\x00-\x7F]/.test(sourceText)) {
    return (byteOffset) => byteOffset
  }

  // Slow path: 单次遍历构建 byte→char 查找表
  const byteToChar: Array<number> = []
  let byteOffset = 0

  for (let charOffset = 0; charOffset < sourceText.length; ) {
    const codePoint = sourceText.codePointAt(charOffset)
    if (codePoint === undefined) break

    const charLen = codePoint > 0xFFFF ? 2 : 1
    let byteLen: number
    if (codePoint <= 0x7F) byteLen = 1
    else if (codePoint <= 0x7FF) byteLen = 2
    else if (codePoint <= 0xFFFF) byteLen = 3
    else byteLen = 4

    for (let i = 0; i < byteLen; i++) {
      byteToChar[byteOffset + i] = charOffset
    }

    charOffset += charLen
    byteOffset += byteLen
  }
  byteToChar[byteOffset] = sourceText.length

  return (offset) => {
    const result = byteToChar[offset]
    if (result === undefined) {
      throw new Error(`[vue-macro-types] Invalid byte offset: ${offset}`)
    }
    return result
  }
}

// OXC AST 最小类型定义
type AstNode = Record<string, unknown>

const isAstNode = (value: unknown): value is AstNode =>
  value !== null && typeof value === 'object'

/** 从 CallExpression 中提取 defineProps 的类型参数节点 */
const getDefinePropsTypeParam = (node: AstNode): { start: number; end: number } | undefined => {
  if (node.type !== 'CallExpression') return undefined

  const callee = node.callee
  if (!isAstNode(callee) || callee.type !== 'Identifier' || callee.name !== 'defineProps') return undefined

  const typeArgs = node.typeArguments
  if (!isAstNode(typeArgs)) return undefined

  const params = typeArgs.params
  if (!Array.isArray(params) || params.length !== 1) return undefined

  const param: unknown = params[0]
  if (!isAstNode(param) || typeof param.start !== 'number' || typeof param.end !== 'number') return undefined

  return { start: param.start as number, end: param.end as number }
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

    const toCharIndex = createByteToCharConverter(scriptContent)
    let match: DefinePropsMatch | undefined

    const visit = (node: unknown): void => {
      if (!isAstNode(node) || match) return

      const typeParam = getDefinePropsTypeParam(node)
      if (typeParam) {
        const typeArgStart = toCharIndex(typeParam.start)
        const typeArgEnd = toCharIndex(typeParam.end)
        match = {
          typeArg: scriptContent.slice(typeArgStart, typeArgEnd),
          typeArgStart,
          typeArgEnd,
        }
        return
      }

      for (const key of Object.keys(node)) {
        const value = node[key]
        if (Array.isArray(value)) {
          for (const item of value) {
            if (match) return
            visit(item)
          }
        } else if (isAstNode(value)) {
          visit(value)
        }
      }
    }

    visit(result.program)
    return match
  } catch (error) {
    console.error('[oxc] Failed to parse:', error)
    return undefined
  }
}
