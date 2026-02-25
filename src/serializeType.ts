import ts from "typescript";

const VALID_IDENTIFIER_RE = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u;

const isReadonlyProperty = (prop: ts.Symbol): boolean => {
  const declarations = prop.getDeclarations();
  if (!declarations) return false;
  return declarations.some((decl) => {
    if (!ts.canHaveModifiers(decl)) return false;
    const modifiers = ts.getModifiers(decl);
    return modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false;
  });
};

/** Recursively serializes a `ts.Type` into a type literal string. */
export const serializeType = (
  type: ts.Type,
  checker: ts.TypeChecker,
  seen: Set<ts.Type> = new Set(),
): string => {
  if (type.isStringLiteral()) return `'${type.value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  if (type.isNumberLiteral()) return `${type.value}`;

  const flags = type.getFlags();

  if (flags & ts.TypeFlags.String) return "string";
  if (flags & ts.TypeFlags.Number) return "number";
  if (flags & ts.TypeFlags.Boolean) return "boolean";
  if (flags & ts.TypeFlags.BooleanLiteral) {
    return checker.typeToString(type);
  }
  if (flags & ts.TypeFlags.Null) return "null";
  if (flags & ts.TypeFlags.Undefined) return "undefined";
  if (flags & ts.TypeFlags.Void) return "void";
  if (flags & ts.TypeFlags.Any) return "any";
  if (flags & ts.TypeFlags.Unknown) return "unknown";
  if (flags & ts.TypeFlags.Never) return "never";

  if (type.isUnion()) {
    return type.types.map((t) => serializeType(t, checker, seen)).join(" | ");
  }

  if (type.isIntersection()) {
    return type.types.map((t) => serializeType(t, checker, seen)).join(" & ");
  }

  if (checker.isArrayType(type)) {
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
    if (typeArgs.length === 1) {
      return `Array<${serializeType(typeArgs[0]!, checker, seen)}>`;
    }
  }

  if (flags & ts.TypeFlags.Object) {
    /* Detect circular references to avoid infinite recursion. */
    if (seen.has(type)) {
      return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
    }
    seen.add(type);

    const properties = checker.getPropertiesOfType(type);
    if (properties.length === 0) {
      const objectType = type as ts.ObjectType;
      const hasSignatures =
        checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0 ||
        checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length > 0 ||
        checker.getIndexInfosOfType(type).length > 0 ||
        (objectType.objectFlags & ts.ObjectFlags.Reference) !== 0;
      if (!hasSignatures) return "{}";
      return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
    }
    const members = properties.map((prop) => {
      const rawKey = prop.getName();
      const key = VALID_IDENTIFIER_RE.test(rawKey) ? rawKey : JSON.stringify(rawKey);
      const propType = checker.getTypeOfSymbol(prop);
      const isOptional = (prop.getFlags() & ts.SymbolFlags.Optional) !== 0;
      const isReadonly = isReadonlyProperty(prop);
      return `${isReadonly ? "readonly " : ""}${key}${isOptional ? "?" : ""}: ${serializeType(propType, checker, seen)}`;
    });
    return `{ ${members.join("; ")} }`;
  }

  return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
};
