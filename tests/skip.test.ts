import { describe, it, expect } from 'vitest'
import { getHandler, transformSfc } from './helpers'

describe('skip transform', () => {
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
