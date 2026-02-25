import { describe, it, expect } from "vitest";
import { transformSfc, extractDefinePropsType } from "./helpers";

describe("advanced types", () => {
  it("should resolve tuple types", () => {
    const result = transformSfc(`
type Props = {
  coordinates: [number, number]
  rgb: [number, number, number]
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("coordinates");
    expect(resolved).toContain("[number, number]");
  });

  it("should resolve readonly properties", () => {
    const result = transformSfc(`
type Props = {
  readonly id: string
  readonly count: number
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("readonly id");
    expect(resolved).toContain("readonly count");
  });

  it("should resolve ReadonlyArray", () => {
    const result = transformSfc(`
type Props = {
  items: ReadonlyArray<string>
  numbers: ReadonlyArray<number>
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("items");
    expect(resolved).toContain("numbers");
  });

  it("should resolve template literal types", () => {
    const result = transformSfc(`
type Color = 'red' | 'blue' | 'green'
type Size = 'sm' | 'md' | 'lg'
type Props = {
  variant: \`\${Color}-\${Size}\`
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("variant");
  });

  it("should resolve Record type", () => {
    const result = transformSfc(`
type Props = {
  metadata: Record<string, unknown>
  config: Record<string, number>
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("metadata");
    expect(resolved).toContain("config");
  });

  it("should resolve Exclude utility type", () => {
    const result = transformSfc(`
type AllColors = 'red' | 'blue' | 'green' | 'yellow'
type Props = {
  color: Exclude<AllColors, 'yellow'>
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("color");
    expect(resolved).toContain("'red'");
    expect(resolved).not.toContain("'yellow'");
  });

  it("should resolve Extract utility type", () => {
    const result = transformSfc(`
type AllValues = string | number | boolean
type Props = {
  value: Extract<AllValues, string | number>
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("value");
    expect(resolved).toContain("string");
    expect(resolved).toContain("number");
  });

  it("should resolve function type properties", () => {
    const result = transformSfc(`
type Props = {
  onClick: (event: MouseEvent) => void
  onChange: (value: string) => number
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("onClick");
    expect(resolved).toContain("onChange");
  });

  it("should resolve indexed access types", () => {
    const result = transformSfc(`
type User = {
  profile: {
    name: string
    age: number
  }
}
type Props = {
  userProfile: User['profile']
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("name: string");
    expect(resolved).toContain("age: number");
  });

  it("should resolve NonNullable type", () => {
    const result = transformSfc(`
type Props = {
  value: NonNullable<string | null | undefined>
  count: NonNullable<number | null>
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("value: string");
    expect(resolved).toContain("count: number");
  });

  it("should resolve keyof operator", () => {
    const result = transformSfc(`
type User = {
  id: number
  name: string
  email: string
}
type Props = {
  field: keyof User
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("field");
  });

  it("should resolve typeof with const objects", () => {
    const result = transformSfc(`
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3
} as const

type Props = typeof config
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("apiUrl");
    expect(resolved).toContain("timeout");
    expect(resolved).toContain("retries");
  });

  it("should resolve array of union types", () => {
    const result = transformSfc(`
type Props = {
  items: Array<string | number>
}
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("items");
  });

  it("should resolve deeply nested generic types", () => {
    const result = transformSfc(`
type Response<T> = {
  data: T
  meta: {
    page: number
  }
}
type User = {
  id: number
  name: string
}
type Props = Response<Array<User>>
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("data");
    expect(resolved).toContain("meta");
  });

  it("should resolve ReturnType utility", () => {
    const result = transformSfc(`
function getUser() {
  return { id: 1, name: 'Alice', role: 'admin' as const }
}
type Props = ReturnType<typeof getUser>
defineProps<Props>()
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("id");
    expect(resolved).toContain("name");
    expect(resolved).toContain("role");
  });
});
