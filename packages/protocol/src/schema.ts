/**
 * A tiny strict schema language. Objects reject unknown keys: whatever is not
 * explicitly allowed cannot leave the server. This is the hidden-information
 * boundary in executable form.
 */
export type Schema =
  | 'number'
  | 'integer'
  | 'string'
  | 'boolean'
  | 'null'
  | { readonly literal: string | number | boolean }
  | { readonly enum: readonly (string | number)[] }
  | { readonly array: Schema; readonly max?: number }
  | { readonly tuple: readonly Schema[] }
  | { readonly object: { readonly [key: string]: Schema }; readonly optional?: readonly string[] }
  | { readonly record: Schema }
  | { readonly union: readonly Schema[] };

export class SchemaError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
  }
}

export function validate(value: unknown, schema: Schema, path = '$'): void {
  if (typeof schema === 'string') {
    switch (schema) {
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value))
          throw new SchemaError(path, 'expected finite number');
        return;
      case 'integer':
        if (typeof value !== 'number' || !Number.isInteger(value))
          throw new SchemaError(path, 'expected integer');
        return;
      case 'string':
        if (typeof value !== 'string') throw new SchemaError(path, 'expected string');
        return;
      case 'boolean':
        if (typeof value !== 'boolean') throw new SchemaError(path, 'expected boolean');
        return;
      case 'null':
        if (value !== null) throw new SchemaError(path, 'expected null');
        return;
    }
  }
  if ('literal' in schema) {
    if (value !== schema.literal)
      throw new SchemaError(path, `expected ${JSON.stringify(schema.literal)}`);
    return;
  }
  if ('enum' in schema) {
    if (!schema.enum.includes(value as string | number))
      throw new SchemaError(path, `not one of ${schema.enum.join(',')}`);
    return;
  }
  if ('array' in schema) {
    if (!Array.isArray(value)) throw new SchemaError(path, 'expected array');
    if (schema.max !== undefined && value.length > schema.max)
      throw new SchemaError(path, `more than ${schema.max} items`);
    value.forEach((v, i) => validate(v, schema.array, `${path}[${i}]`));
    return;
  }
  if ('tuple' in schema) {
    if (!Array.isArray(value) || value.length !== schema.tuple.length)
      throw new SchemaError(path, `expected tuple of ${schema.tuple.length}`);
    schema.tuple.forEach((s, i) => validate(value[i], s, `${path}[${i}]`));
    return;
  }
  if ('object' in schema) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new SchemaError(path, 'expected object');
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (!(key in schema.object)) throw new SchemaError(`${path}.${key}`, 'key not allowed');
    }
    for (const [key, s] of Object.entries(schema.object)) {
      if (!(key in obj) || obj[key] === undefined) {
        if (schema.optional?.includes(key)) continue;
        throw new SchemaError(`${path}.${key}`, 'missing');
      }
      validate(obj[key], s, `${path}.${key}`);
    }
    return;
  }
  if ('record' in schema) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new SchemaError(path, 'expected record');
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      validate(v, schema.record, `${path}.${k}`);
    return;
  }
  if ('union' in schema) {
    let last: unknown;
    for (const s of schema.union) {
      try {
        validate(value, s, path);
        return;
      } catch (e) {
        last = e;
      }
    }
    throw last instanceof Error ? last : new SchemaError(path, 'no union member matched');
  }
}
