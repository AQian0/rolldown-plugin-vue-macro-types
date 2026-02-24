import { describe, it, expect } from 'vitest'
import { vueMacroTypes } from '../src/index'

const createSfc = (scriptContent: string, lang = 'ts'): string =>
  `<script setup lang="${lang}">\n${scriptContent}\n</script>\n\n<template>\n  <div></div>\n</template>\n`

type TransformResult = { code: string; map: unknown }
type TransformHandler = (code: string, id: string) => TransformResult | undefined

const extractDefinePropsType = (result: TransformResult): string | null => {
  const match = result.code.match(/defineProps<([\s\S]+?)>\(\)/)
  return match?.[1]?.trim() ?? null
}

const getHandler = (): TransformHandler => {
  const plugin = vueMacroTypes()
  const transform = plugin.transform as { handler: TransformHandler }
  return transform.handler.bind(null as never)
}

const transformSfc = (
  scriptContent: string,
  options?: { lang?: string },
): { code: string; map: unknown } | undefined => {
  const handler = getHandler()
  const code = createSfc(scriptContent, options?.lang)
  return handler(code, '/tmp/test/Component.vue')
}

describe('vueMacroTypes', () => {
  describe('should skip transform when', () => {
    it('should return undefined when script lang is not ts', () => {
      const result = transformSfc('defineProps<{ name: string }>()', { lang: 'js' })
      expect(result).toBeUndefined()
    })

    it('should return undefined when no script setup is present', () => {
      const handler = getHandler()
      const code = `<script lang="ts">\nexport default { name: 'Foo' }\n</script>\n\n<template><div></div></template>\n`
      const result = handler(code, '/tmp/test/Component.vue')
      expect(result).toBeUndefined()
    })

    it('should return undefined when no defineProps call exists', () => {
      const result = transformSfc('const msg = "hello"')
      expect(result).toBeUndefined()
    })

    it('should return undefined when defineProps uses runtime declaration', () => {
      const result = transformSfc('const props = defineProps({ name: String })')
      expect(result).toBeUndefined()
    })
  })

  describe('type resolution', () => {
    it('should resolve type alias to inline type literal', () => {
      const result = transformSfc(`
type Props = { name: string; age: number }
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain('defineProps<{ name: string; age: number }>()')
    })

    it('should preserve inline type as-is', () => {
      const result = transformSfc('defineProps<{ name: string }>()')
      expect(result).toBeDefined()
      expect(result!.code).toContain('defineProps<{ name: string }>()')
    })

    it('should resolve optional properties', () => {
      const result = transformSfc(`
type Props = { name: string; age?: number }
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain('name: string')
      expect(result!.code).toContain('age?: number')
    })

    it('should resolve string literal union type', () => {
      const result = transformSfc(`
type Status = 'active' | 'inactive'
type Props = { status: Status }
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain("'active' | 'inactive'")
    })

    it('should resolve array type properties', () => {
      const result = transformSfc(`
type Props = { items: string[] }
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain('Array<string>')
    })

    it('should resolve nested object types', () => {
      const result = transformSfc(`
type Address = { city: string; zip: string }
type Props = { name: string; address: Address }
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain('city: string')
      expect(result!.code).toContain('zip: string')
    })

    it('should resolve intersection types', () => {
      const result = transformSfc(`
type Base = { id: number }
type Named = { name: string }
defineProps<Base & Named>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain('id: number')
      expect(result!.code).toContain('name: string')
    })

    it('should resolve boolean and null types', () => {
      const result = transformSfc(`
type Props = { isActive: boolean; value: string | null }
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain('isActive: boolean')
      expect(result!.code).toContain('string | null')
    })

    it('should generate sourcemap', () => {
      const result = transformSfc(`
type Props = { name: string }
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.map).toBeDefined()
    })
  })

  describe('complex generic types', () => {
    it('should resolve InferInput-like indexed access generic', () => {
      const result = transformSfc(`
type Schema<TInput> = { readonly _input: TInput }
type InferInput<TSchema extends Schema<unknown>> = TSchema['_input']

type UserSchema = Schema<{ name: string; age: number }>
type Props = InferInput<UserSchema>
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain('name: string')
      expect(result!.code).toContain('age: number')
    })

    it('should resolve valibot-like nested schema with mapped types', () => {
      const result = transformSfc(`
type BaseSchema<TInput> = { readonly _types?: { input: TInput } }
type InferInput<TSchema extends BaseSchema<unknown>> = NonNullable<TSchema['_types']>['input']

type StringSchema = BaseSchema<string>
type NumberSchema = BaseSchema<number>
type BooleanSchema = BaseSchema<boolean>

type ObjectEntries = Record<string, BaseSchema<unknown>>
type ObjectSchema<TEntries extends ObjectEntries> = BaseSchema<{
  [K in keyof TEntries]: NonNullable<TEntries[K]['_types']>['input']
}>

type MySchema = ObjectSchema<{
  name: StringSchema
  age: NumberSchema
  isActive: BooleanSchema
}>

type Props = InferInput<MySchema>
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain('name: string')
      expect(result!.code).toContain('age: number')
      expect(result!.code).toContain('isActive: boolean')
    })

    it('should resolve valibot-like optional schema fields', () => {
      const result = transformSfc(`
type BaseSchema<TInput> = { readonly _types?: { input: TInput } }
type InferInput<TSchema extends BaseSchema<unknown>> = NonNullable<TSchema['_types']>['input']

type StringSchema = BaseSchema<string>
type NumberSchema = BaseSchema<number>
type OptionalSchema<TWrapped extends BaseSchema<unknown>> = BaseSchema<
  NonNullable<TWrapped['_types']>['input'] | undefined
>

type ObjectEntries = Record<string, BaseSchema<unknown>>
type ObjectSchema<TEntries extends ObjectEntries> = BaseSchema<{
  [K in keyof TEntries]: NonNullable<TEntries[K]['_types']>['input']
}>

type MySchema = ObjectSchema<{
  name: StringSchema
  age: OptionalSchema<NumberSchema>
}>

type Props = InferInput<MySchema>
defineProps<Props>()
`)
      expect(result).toBeDefined()
      const resolved = extractDefinePropsType(result!)
      expect(resolved).toContain('name: string')
      expect(resolved).toContain('age: undefined | number')
    })

    it('should resolve conditional type with infer', () => {
      const result = transformSfc(`
type ExtractProps<T> = T extends { props: infer TProps } ? TProps : never
type Component = { props: { title: string; count: number }; emits: {} }
type Props = ExtractProps<Component>
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain('title: string')
      expect(result!.code).toContain('count: number')
    })

    it('should resolve deeply nested wrapper generics', () => {
      const result = transformSfc(`
type Wrapper<TValue> = { value: TValue }
type Container<TData> = { data: Wrapper<TData> }
type Props = Container<{ name: string; tags: string[] }>
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain('name: string')
      expect(result!.code).toContain('Array<string>')
    })

    it('should resolve typeof const object', () => {
      const result = transformSfc(`
const defaults = { title: 'hello', count: 42 } as const
type Props = typeof defaults
defineProps<Props>()
`)
      expect(result).toBeDefined()
      expect(result!.code).toContain("title")
      expect(result!.code).toContain("count")
    })
  })

  describe('utility types', () => {
    it('should resolve Pick', () => {
      const result = transformSfc(`
type FullUser = { id: number; name: string; email: string; age: number }
type Props = Pick<FullUser, 'name' | 'email'>
defineProps<Props>()
`)
      expect(result).toBeDefined()
      const resolved = extractDefinePropsType(result!)
      expect(resolved).toContain('name: string')
      expect(resolved).toContain('email: string')
      expect(resolved).not.toContain('id')
      expect(resolved).not.toContain('age')
    })

    it('should resolve Omit', () => {
      const result = transformSfc(`
type FullUser = { id: number; name: string; email: string }
type Props = Omit<FullUser, 'id'>
defineProps<Props>()
`)
      expect(result).toBeDefined()
      const resolved = extractDefinePropsType(result!)
      expect(resolved).toContain('name: string')
      expect(resolved).toContain('email: string')
      expect(resolved).not.toContain('id')
    })

    it('should resolve Partial', () => {
      const result = transformSfc(`
type User = { name: string; age: number }
type Props = Partial<User>
defineProps<Props>()
`)
      expect(result).toBeDefined()
      const resolved = extractDefinePropsType(result!)
      expect(resolved).toContain('name?:')
      expect(resolved).toContain('age?:')
    })

    it('should resolve Required', () => {
      const result = transformSfc(`
type User = { name?: string; age?: number }
type Props = Required<User>
defineProps<Props>()
`)
      expect(result).toBeDefined()
      const resolved = extractDefinePropsType(result!)
      expect(resolved).toContain('name: string')
      expect(resolved).toContain('age: number')
      expect(resolved).not.toContain('?')
    })

    it('should resolve composed utility types', () => {
      const result = transformSfc(`
type FullUser = { id: number; name: string; email: string; bio?: string }
type Props = Required<Pick<FullUser, 'name' | 'bio'>>
defineProps<Props>()
`)
      expect(result).toBeDefined()
      const resolved = extractDefinePropsType(result!)
      expect(resolved).toContain('name: string')
      expect(resolved).toContain('bio: string')
      expect(resolved).not.toContain('id')
      expect(resolved).not.toContain('?')
    })
  })
})
