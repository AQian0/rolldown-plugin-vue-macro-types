import type { Plugin } from 'rolldown'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import path from 'node:path'

type VueMacroTypesOptions = {
  tsconfig?: string
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

        console.log(`[vue-macro-types] TS Program 创建成功，准备解析类型`)

        // TODO: 第 3 步 - 遍历 AST 定位 defineProps 调用，用 checker 解析类型
      },
    },
  }
}
