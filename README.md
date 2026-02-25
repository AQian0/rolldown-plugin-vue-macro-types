# rolldown-plugin-vue-macro-types

A [Rolldown](https://rolldown.rs/) plugin that resolves complex TypeScript type arguments in Vue `defineProps<T>()` calls at build time, replacing them with inline type literals so Vue's compiler can understand the props without full TypeScript type resolution.

## Why

Vue's `<script setup>` only supports simple, inline type literals in `defineProps<T>()`. If `T` references an imported type, a type alias, or any non-trivial construct, Vue cannot extract the prop definitions at compile time.

This plugin uses the TypeScript Language Service to fully resolve the type and rewrites it as an inline object literal before Vue processes the SFC.

## Install

```sh
# npm
npm install -D rolldown-plugin-vue-macro-types

# pnpm
pnpm add -D rolldown-plugin-vue-macro-types
```

Peer dependencies: `rolldown`, `typescript`

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vueMacroTypes } from 'rolldown-plugin-vue-macro-types'

export default defineConfig({
  plugins: [
    vueMacroTypes(),
    vue(),
  ],
})
```

This plugin is only useful when `defineProps<T>()` uses complex types that Vue's compiler cannot resolve on its own, such as imported types, type aliases, intersections, or generics. For simple inline type literals (e.g. `defineProps<{ name: string }>()`), Vue handles them natively and this plugin is not needed.

### Options

- `tsconfig` (`string`, optional) - Path to `tsconfig.json`. Auto-detected if omitted.

## How It Works

1. Filters `.vue` files containing `defineProps<` using Rolldown's built-in transform filter.
2. Parses the `<script setup>` block with [oxc-parser](https://github.com/nicolo-ribaudo/oxc-parser) to locate the `defineProps<T>()` call and its type argument span.
3. Creates a virtual TypeScript file and feeds it to a TypeScript Language Service to resolve `T` into its fully expanded type.
4. Serializes the resolved type back into a type literal string (handling unions, intersections, arrays, optional/readonly properties, etc.).
5. Replaces the original type argument in the SFC source with the resolved literal using [magic-string](https://github.com/rich-harris/magic-string), preserving sourcemaps.

## Example

```ts
// types.ts
export type BaseProps = {
  id: number
  label: string
}

export type UserProps = BaseProps & {
  role: 'admin' | 'guest'
  avatar?: string
}
```

Before:

```vue
<script setup lang="ts">
import type { UserProps } from './types'
defineProps<UserProps>()
</script>
```

After (build time):

```vue
<script setup lang="ts">
import type { UserProps } from './types'
defineProps<{ id: number; label: string; role: 'admin' | 'guest'; avatar?: string }>()
</script>
```

## License

[MIT](./LICENSE)
