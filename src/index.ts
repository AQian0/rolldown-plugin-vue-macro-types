import type { Plugin } from 'rolldown'

type VueMacroTypesOptions = {
  // 插件选项
}

export const vueMacroTypes = (_options: VueMacroTypesOptions = {}): Plugin => {
  return {
    name: 'vue-macro-types',
  }
}
