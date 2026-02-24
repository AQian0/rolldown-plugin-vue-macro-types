import type { Plugin } from 'rolldown'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import path from 'node:path'
import MagicString from 'magic-string'
import { locateDefinePropsWithOxc } from './locateDefineProps.ts'

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
      const rawKey = prop.getName()
      const key = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u.test(rawKey)
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

const DEFAULT_COMPILER_OPTIONS = {
  strict: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
} as const satisfies ts.CompilerOptions

export const vueMacroTypes = (options: VueMacroTypesOptions = {}): Plugin => {
  // 跨 transform 调用共享的 LanguageService 和虚拟文件注册表
  let service: ts.LanguageService | undefined
  let compilerOptions: ts.CompilerOptions
  const virtualFiles = new Map<string, { content: string; version: number }>()
  let scriptFileNamesCache: ReadonlyArray<string> = []
  let scriptFileNamesDirty = true
  const documentRegistry = ts.createDocumentRegistry()

  const getService = (id: string): ts.LanguageService => {
    if (service) return service

    // tsconfig 只在首次调用时解析一次
    const tsconfigPath = options.tsconfig
      ?? ts.findConfigFile(path.dirname(id), ts.sys.fileExists, 'tsconfig.json')

    compilerOptions = tsconfigPath
      ? ts.parseJsonConfigFileContent(
          ts.readConfigFile(tsconfigPath, ts.sys.readFile).config,
          ts.sys,
          path.dirname(tsconfigPath),
        ).options
      : DEFAULT_COMPILER_OPTIONS

    const serviceHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => {
        if (scriptFileNamesDirty) {
          scriptFileNamesCache = [...virtualFiles.keys()]
          scriptFileNamesDirty = false
        }
        return scriptFileNamesCache as Array<string>
      },
      getScriptVersion: (fileName) =>
        String(virtualFiles.get(fileName)?.version ?? 0),
      getScriptSnapshot: (fileName) => {
        const entry = virtualFiles.get(fileName)
        if (entry) return ts.ScriptSnapshot.fromString(entry.content)
        const content = ts.sys.readFile(fileName)
        return content !== undefined
          ? ts.ScriptSnapshot.fromString(content)
          : undefined
      },
      getCompilationSettings: () => compilerOptions,
      getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
      getDefaultLibFileName: ts.getDefaultLibFilePath,
      fileExists: (fileName) =>
        virtualFiles.has(fileName) || ts.sys.fileExists(fileName),
      readFile: (fileName) =>
        virtualFiles.get(fileName)?.content ?? ts.sys.readFile(fileName),
    }

    service = ts.createLanguageService(serviceHost, documentRegistry)
    return service
  }

  return {
    name: 'vue-macro-types',

    buildStart() {
      // 预热 LanguageService，将初始化开销从首次 transform 中移出
      // 传入合成文件路径，因为 getService 内部会对 id 执行 path.dirname()
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

        const typeArg = definePropsMatch.typeArg.trim()
        console.log(`[vue-macro-types] 检测到 defineProps<${typeArg}>() in ${id}`)

        // 更新虚拟文件并从共享 LanguageService 获取 program
        const virtualFileName = id + '.__setup.ts'
        const scriptContent = scriptSetup.content

        const existing = virtualFiles.get(virtualFileName)
        if (!existing) scriptFileNamesDirty = true
        virtualFiles.set(virtualFileName, {
          content: scriptContent,
          version: (existing?.version ?? 0) + 1,
        })

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
