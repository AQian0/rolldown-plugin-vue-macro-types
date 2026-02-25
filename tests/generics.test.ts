import { describe, it, expect } from "vitest";
import { transformSfc, extractDefinePropsType } from "./helpers";

describe("complex generic types", () => {
  it("should resolve InferInput-like indexed access generic", () => {
    const result = transformSfc(`
type Schema<TInput> = { readonly _input: TInput }
type InferInput<TSchema extends Schema<unknown>> = TSchema['_input']

type UserSchema = Schema<{ name: string; age: number }>
type Props = InferInput<UserSchema>
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("name: string");
    expect(result!.code).toContain("age: number");
  });

  it("should resolve valibot-like nested schema with mapped types", () => {
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
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("name: string");
    expect(result!.code).toContain("age: number");
    expect(result!.code).toContain("isActive: boolean");
  });

  it("should resolve valibot-like optional schema fields", () => {
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
`);
    expect(result).toBeDefined();
    const resolved = extractDefinePropsType(result!);
    expect(resolved).toContain("name: string");
    expect(resolved).toContain("age: undefined | number");
  });

  it("should resolve conditional type with infer", () => {
    const result = transformSfc(`
type ExtractProps<T> = T extends { props: infer TProps } ? TProps : never
type Component = { props: { title: string; count: number }; emits: {} }
type Props = ExtractProps<Component>
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("title: string");
    expect(result!.code).toContain("count: number");
  });

  it("should resolve deeply nested wrapper generics", () => {
    const result = transformSfc(`
type Wrapper<TValue> = { value: TValue }
type Container<TData> = { data: Wrapper<TData> }
type Props = Container<{ name: string; tags: string[] }>
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("name: string");
    expect(result!.code).toContain("Array<string>");
  });

  it("should resolve typeof const object", () => {
    const result = transformSfc(`
const defaults = { title: 'hello', count: 42 } as const
type Props = typeof defaults
defineProps<Props>()
`);
    expect(result).toBeDefined();
    expect(result!.code).toContain("title");
    expect(result!.code).toContain("count");
  });
});
