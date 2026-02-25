import ts from 'typescript'

const VALID_IDENTIFIER_RE = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u

/** Recursively serializes a `ts.Type` into a type literal string. */
export const serializeType = (type: ts.Type, checker: ts.TypeChecker): string => {
  if (type.isStringLiteral()) return `'${type.value}'`
  if (type.isNumberLiteral()) return `${type.value}`

  const flags = type.getFlags()

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

  if (type.isUnion()) {
    return type.types.map((t) => serializeType(t, checker)).join(' | ')
  }

  if (type.isIntersection()) {
    return type.types.map((t) => serializeType(t, checker)).join(' & ')
  }

  if (checker.isArrayType(type)) {
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference)
    if (typeArgs.length === 1) {
      return `Array<${serializeType(typeArgs[0]!, checker)}>`
    }
  }

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

  return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)
}
