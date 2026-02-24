import { describe, it, expect } from 'vitest'
import { transformSfc } from './helpers'

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
