/**
 * Type Utilities
 * 
 * TypeScript utility types for better type inference and developer experience.
 * 
 * @module types/helpers
 */

/**
 * Expand a type to show all properties (better IntelliSense)
 */
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

/**
 * Convert snake_case to camelCase
 */
export type SnakeToCamelCase<S extends string> = 
  S extends `${infer T}_${infer U}`
    ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
    : S;

/**
 * Make specified keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specified keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract keys where value is of type U
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Prettify intersection types
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Get function parameter types
 */
export type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;

/**
 * Get function return type
 */
export type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;

/**
 * Make properties mutable
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Extract promise type
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * Array element type
 */
export type ArrayElement<T> = T extends (infer E)[] ? E : never;

