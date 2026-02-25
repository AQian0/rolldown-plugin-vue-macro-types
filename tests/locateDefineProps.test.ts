import { describe, it, expect } from "vitest";
import { transformSfc, extractDefinePropsType } from "./helpers";

describe("oxc-parser location accuracy", () => {
  it("should locate basic defineProps call", () => {
    const result = transformSfc(`
type Props = { name: string }
defineProps<Props>()
`);
    expect(result).toBeDefined();
  });

  it("should handle defineProps with whitespace variations", () => {
    const result = transformSfc(`
type Props = { name: string }
defineProps  <  Props  >  (  )
`);
    expect(result).toBeDefined();
    expect(extractDefinePropsType(result!)).toContain("name: string");
  });

  it("should handle defineProps with newlines", () => {
    const result = transformSfc(`
type Props = {
  name: string
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(extractDefinePropsType(result!)).toContain("name: string");
  });

  it("should ignore defineProps in comments", () => {
    const result = transformSfc(`
type Actual = { actual: string }
// defineProps<{ commented: string }>()
/* defineProps<{ multiline: string }>() */
defineProps<Actual>()
`);
    expect(result).toBeDefined();
    expect(extractDefinePropsType(result!)).toContain("actual: string");
  });

  it("should ignore defineProps in string literals", () => {
    const result = transformSfc(`
type Actual = { actual: string }
const code = 'defineProps<{ inString: string }>()'
defineProps<Actual>()
`);
    expect(result).toBeDefined();
    expect(extractDefinePropsType(result!)).toContain("actual: string");
  });

  it("should handle only first defineProps call", () => {
    const result = transformSfc(`
defineProps<{ first: string }>()
defineProps<{ second: string }>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("first: string");
  });

  it("should handle multiline complex types", () => {
    const result = transformSfc(`
type ComplexType = {
  name: string
  nested: {
    deep: {
      value: number
    }
  }
}
defineProps<ComplexType>()
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("name: string");
    expect(result!.code).toContain("value: number");
  });

  it("should handle types with special characters", () => {
    const result = transformSfc(`
type Props = {
  'kebab-case': string
  'snake_case': number
  '@special': boolean
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain('"kebab-case"');
    expect(resolved).toContain("snake_case");
  });

  it("should handle unicode characters", () => {
    const result = transformSfc(`
type Props = {
  名字: string
  年龄: number
  emoji: '🎉'
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("名字");
    expect(result!.code).toContain("年龄");
  });

  it("should handle type with trailing comma", () => {
    const result = transformSfc(`
type Props = {
  name: string,
  age: number,
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(extractDefinePropsType(result!)).toContain("name: string");
  });
});
