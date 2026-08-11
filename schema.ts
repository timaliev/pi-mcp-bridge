/**
 * JSON Schema → TypeBox converter.
 *
 * Converts MCP tool inputSchema (JSON Schema subset) to TypeBox TSchema
 * objects used by pi's tool registration system. Pure function, zero
 * side effects — importable by tests without MCP/pi SDK deps.
 */

import { Type } from "typebox";
import type { TSchema } from "typebox";

export function jsonSchemaToTypeBox(
  schema: Record<string, unknown>,
  rootDescription?: string,
): TSchema {
  if (!schema || typeof schema !== "object") return Type.Any();

  const desc =
    typeof schema.description === "string" ? schema.description : undefined;

  // Handle const
  if ("const" in schema) {
    return Type.Literal(schema.const);
  }

  // Handle enum (no type field, or type: "string" with enum)
  if (Array.isArray(schema.enum)) {
    const literals = schema.enum.map((v) => Type.Literal(v));
    if (literals.length === 1) return literals[0];
    return Type.Union(literals as [TSchema, ...TSchema[]]);
  }

  // Handle $ref (basic, resolve against definitions if present)
  if (typeof schema.$ref === "string") {
    return Type.Any({ description: `$ref: ${schema.$ref}` });
  }

  // Handle oneOf / anyOf
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    const options = schema.oneOf.map((s: Record<string, unknown>) =>
      jsonSchemaToTypeBox(s),
    );
    return Type.Union(
      options as [TSchema, ...TSchema[]],
      desc ? { description: desc } : undefined,
    );
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const options = schema.anyOf.map((s: Record<string, unknown>) =>
      jsonSchemaToTypeBox(s),
    );
    return Type.Union(
      options as [TSchema, ...TSchema[]],
      desc ? { description: desc } : undefined,
    );
  }

  const type = schema.type;

  // Handle array
  if (type === "array") {
    const items = schema.items
      ? jsonSchemaToTypeBox(schema.items as Record<string, unknown>)
      : Type.Any();
    const minItems =
      typeof schema.minItems === "number" ? schema.minItems : undefined;
    const maxItems =
      typeof schema.maxItems === "number" ? schema.maxItems : undefined;
    return Type.Array(items, {
      ...(desc ? { description: desc } : {}),
      ...(minItems !== undefined ? { minItems } : {}),
      ...(maxItems !== undefined ? { maxItems } : {}),
    });
  }

  // Handle object
  if (type === "object") {
    const properties = (schema.properties ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    const required = (
      Array.isArray(schema.required) ? schema.required : []
    ) as string[];

    const typeBoxProps: Record<string, TSchema> = {};
    for (const [key, propSchema] of Object.entries(properties)) {
      const converted = jsonSchemaToTypeBox(propSchema);
      typeBoxProps[key] = required.includes(key)
        ? converted
        : Type.Optional(converted);
    }

    const additionalProperties = schema.additionalProperties as
      | boolean
      | Record<string, unknown>
      | undefined;
    const options: Record<string, unknown> = {};
    if (desc) options.description = desc;
    if (additionalProperties === false) options.additionalProperties = false;

    return Type.Object(typeBoxProps, options);
  }

  // Handle primitives
  const opts = desc ? { description: desc } : {};

  switch (type) {
    case "string":
      return Type.String(opts);
    case "number":
      return Type.Number(opts);
    case "integer":
      return Type.Number({
        ...opts,
        description: `${desc ?? ""} (integer)`.trim(),
      });
    case "boolean":
      return Type.Boolean(opts);
    case "null":
      return Type.Null(desc ? { description: desc } : undefined);
    default:
      if ("properties" in schema || "additionalProperties" in schema) {
        return jsonSchemaToTypeBox({ ...schema, type: "object" });
      }
      if ("items" in schema) {
        return jsonSchemaToTypeBox({ ...schema, type: "array" });
      }
      return Type.Any(desc ? { description: desc } : undefined);
  }
}
