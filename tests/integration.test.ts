import { describe, it, expect } from "vitest";
import { getHandler } from "./helpers";

describe("integration", () => {
  it("should handle complete Vue SFC with template and style", () => {
    const handler = getHandler();
    const code = `<script setup lang="ts">
type Props = {
  title: string
  count: number
}
defineProps<Props>()
</script>

<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <p>Count: {{ count }}</p>
  </div>
</template>

<style scoped>
.container {
  padding: 20px;
}
</style>
`;
    const result = handler(code, "/tmp/Component.vue");
    expect(result).toBeDefined();
    expect(result!.code).toContain("title: string");
    expect(result!.code).toContain("count: number");
    expect(result!.code).toContain("<template>");
    expect(result!.code).toContain("<style scoped>");
  });

  it("should handle SFC with multiple script blocks", () => {
    const handler = getHandler();
    const code = `<script lang="ts">
export const CONSTANT = 42
</script>

<script setup lang="ts">
type Props = { value: string }
defineProps<Props>()
</script>

<template>
  <div>{{ value }}</div>
</template>
`;
    const result = handler(code, "/tmp/Component.vue");
    expect(result).toBeDefined();
    expect(result!.code).toContain("value: string");
  });

  it("should preserve source map correctness", () => {
    const handler = getHandler();
    const code = `<script setup lang="ts">
type User = {
  id: number
  name: string
}
type Props = User
defineProps<Props>()
</script>

<template><div /></template>
`;
    const result = handler(code, "/tmp/Component.vue");
    expect(result).toBeDefined();
    expect(result!.map).toBeDefined();
    expect(result!.map).toHaveProperty("mappings");
    expect(result!.map).toHaveProperty("sources");
  });

  it("should handle SFC with imports", () => {
    const handler = getHandler();
    const code = `<script setup lang="ts">
import type { BaseProps } from './types'

type Props = BaseProps & {
  extra: boolean
}
defineProps<Props>()
</script>

<template><div /></template>
`;
    const result = handler(code, "/tmp/Component.vue");
    expect(result).toBeDefined();
    expect(result!.code).toContain("extra");
  });

  it("should handle SFC with defineEmits", () => {
    const handler = getHandler();
    const code = `<script setup lang="ts">
type Props = { value: string }
type Emits = {
  update: [value: string]
  change: []
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<template><div /></template>
`;
    const result = handler(code, "/tmp/Component.vue");
    expect(result).toBeDefined();
    expect(result!.code).toContain("value: string");
  });

  it("should handle SFC with defineModel", () => {
    const handler = getHandler();
    const code = `<script setup lang="ts">
type Props = { label: string }
defineProps<Props>()
const modelValue = defineModel<string>()
</script>

<template><div /></template>
`;
    const result = handler(code, "/tmp/Component.vue");
    expect(result).toBeDefined();
    expect(result!.code).toContain("label: string");
  });

  it("should handle SFC with complex prop and computed", () => {
    const handler = getHandler();
    const code = `<script setup lang="ts">
import { computed } from 'vue'

type User = {
  firstName: string
  lastName: string
}
type Props = { user: User }

const props = defineProps<Props>()
const fullName = computed(() => \`\${props.user.firstName} \${props.user.lastName}\`)
</script>

<template>
  <div>{{ fullName }}</div>
</template>
`;
    const result = handler(code, "/tmp/Component.vue");
    expect(result).toBeDefined();
    expect(result!.code).toContain("firstName");
    expect(result!.code).toContain("lastName");
  });

  it("should handle SFC with generic components", () => {
    const handler = getHandler();
    const code = `<script setup lang="ts" generic="T extends { id: number }">
type Props = {
  items: Array<T>
  onSelect: (item: T) => void
}
defineProps<Props>()
</script>

<template><div /></template>
`;
    const result = handler(code, "/tmp/Component.vue");
    expect(result).toBeDefined();
    expect(result!.code).toContain("items");
  });

  it("should handle props destructuring with defaults", () => {
    const handler = getHandler();
    const code = `<script setup lang="ts">
type Props = {
  title: string
  count?: number
  enabled?: boolean
}

const { title, count = 0, enabled = true } = defineProps<Props>()
</script>

<template><div /></template>
`;
    const result = handler(code, "/tmp/Component.vue");
    expect(result).toBeDefined();
    expect(result!.code).toContain("title: string");
  });

  it("should handle large type definitions", () => {
    const handler = getHandler();
    const properties = Array.from({ length: 50 }, (_, i) => `prop${i}: string`);
    const code = `<script setup lang="ts">
type Props = {
  ${properties.join("\n  ")}
}
defineProps<Props>()
</script>

<template><div /></template>
`;
    const result = handler(code, "/tmp/Component.vue");
    expect(result).toBeDefined();
    expect(result!.code).toContain("prop0");
    expect(result!.code).toContain("prop49");
  });
});
