import ts from 'typescript'

const VALID_IDENTIFIER_RE = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u

/**
 * 将 TS Type 对象递归序列化为类型字面量字符串
 * 例如：InferInput<typeof schema> → { name: string; age: number }
 */
export const serializeType = (type: ts.Type, checker: ts.TypeChecker): string => {
  // 字符串字面量
  if (type.isStringLiteral()) return `'${type.value}'`
  // 数字字面量
  if (type.isNumberLiteral()) return `${type.value}`

  const flags = type.getFlags()

  // 基础类型
  if (flags & ts.TypeFlags.String) return 'string'
  if (flags & ts.TypeFlags.Number) return 'number'
  if (flags & ts.TypeFlags.Boolean) return 'boolean'
  if (flags & ts.TypeFlags.BooleanLiteral) {
    return checker.typeToString(type)
  }
  if (flags & ts.TypeFlags.Null) return 'null'
  if (flags & ts.TypeFlags.Undefined) return 'undefined'
  if (flags & ts.TypeFlags.Void) return 'void'
  if (flags & ts.TypeFlags.Any) return 'any'
  if (flags & ts.TypeFlags.Unknown) return 'unknown'
  if (flags & ts.TypeFlags.Never) return 'never'

  // 联合类型
  if (type.isUnion()) {
    return type.types.map((t) => serializeType(t, checker)).join(' | ')
  }

  // 交叉类型
  if (type.isIntersection()) {
    return type.types.map((t) => serializeType(t, checker)).join(' & ')
  }

  // 数组类型
  if (checker.isArrayType(type)) {
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference)
    if (typeArgs.length === 1) {
      return `Array<${serializeType(typeArgs[0]!, checker)}>`
    }
  }

  // 对象类型：递归展开属性
  if (flags & ts.TypeFlags.Object) {
    const properties = checker.getPropertiesOfType(type)
    if (properties.length === 0) {
      return checker.typeToString(type)
    }
    const members = properties.map((prop) => {
      const rawKey = prop.getName()
      const key = VALID_IDENTIFIER_RE.test(rawKey)
        ? rawKey
        : JSON.stringify(rawKey)
      const propType = checker.getTypeOfSymbol(prop)
      const isOptional = (prop.getFlags() & ts.SymbolFlags.Optional) !== 0
      return `${key}${isOptional ? '?' : ''}: ${serializeType(propType, checker)}`
    })
    return `{ ${members.join('; ')} }`
  }

  // fallback：让 TS 自己转字符串
  return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)
}
