import type { Plugin } from 'rolldown'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import path from 'node:path'

type VueMacroTypesOptions = {
  tsconfig?: string
}

/**
 * 将 TS Type 对象递归序列化为类型字面量字符串
 * 例如：InferInput<typeof schema> → { name: string; age: number }
 */
const serializeType = (type: ts.Type, checker: ts.TypeChecker): string => {
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
      const propType = checker.getTypeOfSymbol(prop)
      const isOptional = (prop.getFlags() & ts.SymbolFlags.Optional) !== 0
      const key = prop.getName()
      return `${key}${isOptional ? '?' : ''}: ${serializeType(propType, checker)}`
    })
    return `{ ${members.join('; ')} }`
  }

  // fallback：让 TS 自己转字符串
  return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)
}

export const vueMacroTypes = (options: VueMacroTypesOptions = {}): Plugin => {
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

        // 第 2 步：构建 TS Program，获取 typeChecker
        const virtualFileName = id + '.__setup.ts'
        const scriptContent = scriptSetup.content

        // 读取 tsconfig
        const tsconfigPath = options.tsconfig
          ?? ts.findConfigFile(path.dirname(id), ts.sys.fileExists, 'tsconfig.json')
        const compilerOptions: ts.CompilerOptions = tsconfigPath
          ? ts.parseJsonConfigFileContent(
              ts.readConfigFile(tsconfigPath, ts.sys.readFile).config,
              ts.sys,
              path.dirname(tsconfigPath),
            ).options
          : { strict: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler }

        // 自定义 CompilerHost：拦截虚拟文件
        const defaultHost = ts.createCompilerHost(compilerOptions)
        const customHost: ts.CompilerHost = {
          ...defaultHost,
          getSourceFile(fileName, languageVersion) {
            if (fileName === virtualFileName) {
              return ts.createSourceFile(fileName, scriptContent, languageVersion)
            }
            return defaultHost.getSourceFile(fileName, languageVersion)
          },
          fileExists(fileName) {
            if (fileName === virtualFileName) return true
            return defaultHost.fileExists(fileName)
          },
          readFile(fileName) {
            if (fileName === virtualFileName) return scriptContent
            return defaultHost.readFile(fileName)
          },
        }

        const program = ts.createProgram([virtualFileName], compilerOptions, customHost)
        const checker = program.getTypeChecker()
        const sourceFile = program.getSourceFile(virtualFileName)
        if (!sourceFile) return

        // 第 3 步：遍历 AST 定位 defineProps<T>() 调用，解析类型参数
        let resolvedType: ts.Type | undefined

        const visit = (node: ts.Node): void => {
          // 查找调用表达式：defineProps<T>()
          if (
            ts.isCallExpression(node)
            && ts.isIdentifier(node.expression)
            && node.expression.text === 'defineProps'
            && node.typeArguments?.length === 1
          ) {
            const typeNode = node.typeArguments[0]!
            resolvedType = checker.getTypeFromTypeNode(typeNode)
            return
          }
          ts.forEachChild(node, visit)
        }
        visit(sourceFile)

        if (!resolvedType) return

        // 第 4 步：序列化为类型字面量字符串
        const typeString = serializeType(resolvedType, checker)
        console.log(`[vue-macro-types] 解析结果: ${typeString}`)

        // TODO: 第 5 步 - 用 typeString 替换源码中的类型参数
      },
    },
  }
}
