import { describe, it, expect } from "vitest";
import { transformSfc, extractDefinePropsType } from "./helpers";

describe("utility types", () => {
  it("should resolve Pick", () => {
    const result = transformSfc(`
type FullUser = { id: number; name: string; email: string; age: number }
type Props = Pick<FullUser, 'name' | 'email'>
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("name: string");
    expect(resolved).toContain("email: string");
    expect(resolved).not.toContain("id");
    expect(resolved).not.toContain("age");
  });

  it("should resolve Omit", () => {
    const result = transformSfc(`
type FullUser = { id: number; name: string; email: string }
type Props = Omit<FullUser, 'id'>
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("name: string");
    expect(resolved).toContain("email: string");
    expect(resolved).not.toContain("id");
  });

  it("should resolve Partial", () => {
    const result = transformSfc(`
type User = { name: string; age: number }
type Props = Partial<User>
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("name?:");
    expect(resolved).toContain("age?:");
  });

  it("should resolve Required", () => {
    const result = transformSfc(`
type User = { name?: string; age?: number }
type Props = Required<User>
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("name: string");
    expect(resolved).toContain("age: number");
    expect(resolved).not.toContain("?");
  });

  it("should resolve composed utility types", () => {
    const result = transformSfc(`
type FullUser = { id: number; name: string; email: string; bio?: string }
type Props = Required<Pick<FullUser, 'name' | 'bio'>>
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("name: string");
    expect(resolved).toContain("bio: string");
    expect(resolved).not.toContain("id");
    expect(resolved).not.toContain("?");
  });
});
