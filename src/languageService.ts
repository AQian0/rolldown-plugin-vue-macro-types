import ts from 'typescript'
import path from 'node:path'
import type { VueMacroTypesOptions } from './types.ts'

const DEFAULT_COMPILER_OPTIONS = {
  strict: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
} as const satisfies ts.CompilerOptions

export type LanguageServiceManager = {
  getService: (id: string) => ts.LanguageService
  updateVirtualFile: (fileName: string, content: string) => void
}

export const createLanguageServiceManager = (
  options: VueMacroTypesOptions,
): LanguageServiceManager => {
  let service: ts.LanguageService | undefined
  let compilerOptions: ts.CompilerOptions
  const virtualFiles = new Map<string, { content: string; version: number }>()
  let scriptFileNamesCache: ReadonlyArray<string> = []
  let scriptFileNamesDirty = true
  const documentRegistry = ts.createDocumentRegistry()

  const getService = (id: string): ts.LanguageService => {
    if (service) return service

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

  const updateVirtualFile = (fileName: string, content: string): void => {
    const existing = virtualFiles.get(fileName)
    if (!existing) scriptFileNamesDirty = true
    virtualFiles.set(fileName, {
      content,
      version: (existing?.version ?? 0) + 1,
    })
  }

  return { getService, updateVirtualFile }
}
