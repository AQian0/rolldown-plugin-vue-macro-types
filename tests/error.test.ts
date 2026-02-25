import { describe, it, expect } from "vitest";
import { transformSfc, extractDefinePropsType } from "./helpers";

describe("error handling", () => {
  it("should handle syntax errors gracefully", () => {
    expect(() => {
      transformSfc(`
type Props = { name: string
defineProps<Props>()
`);
    }).not.toThrow();
  });

  it("should handle invalid generic parameter", () => {
    expect(() => {
      transformSfc("defineProps<>()");
    }).not.toThrow();
  });

  it("should handle multiple type parameters", () => {
    const result = transformSfc("defineProps<Props, Extra>()");
    expect(result).toBeUndefined();
  });

  it("should handle undefined type reference", () => {
    const result = transformSfc("defineProps<NonExistentType>()");
    expect(result).toBeDefined();
  });

  it("should handle circular type reference", () => {
    const result = transformSfc(`
type A = { b: B }
type B = { a: A }
type Props = A
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const code = result!.code;
    expect(code).toContain("{ b:");
    expect(code).toContain("{ a:");
  });

  it("should handle empty object type", () => {
    const result = transformSfc(`
type Props = {}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toBe("{}");
  });

  it("should handle never type", () => {
    const result = transformSfc(`
type Props = never
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("never");
  });

  it("should handle any type", () => {
    const result = transformSfc(`
type Props = any
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("any");
  });

  it("should handle unknown type", () => {
    const result = transformSfc(`
type Props = unknown
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("unknown");
  });

  it("should handle deeply nested types", () => {
    const result = transformSfc(`
type Level4 = { value: string }
type Level3 = { nested: Level4 }
type Level2 = { nested: Level3 }
type Level1 = { nested: Level2 }
type Props = Level1
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("value: string");
  });
});
