import { z } from "zod";

const requiredText = (message: string, max = 160) =>
  z.string().trim().min(1, message).max(max, `No debe superar ${max} caracteres.`);

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `No debe superar ${max} caracteres.`)
    .transform((value) => value || null)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const normalizedCode = (label: string) =>
  requiredText(`Ingresa ${label}.`, 80).transform((value) => value.toUpperCase());

export const productSchema = z
  .object({
    name: requiredText("Ingresa el nombre del producto."),
    description: optionalText(1000),
    brand: optionalText(120),
    category: optionalText(120),
    unitCode: normalizedCode("la unidad"),
    isActive: z.boolean().default(true),
  })
  .strict();

export const productVariantSchema = z
  .object({
    productId: z.uuid("El producto no es válido."),
    sku: normalizedCode("el SKU"),
    name: requiredText("Ingresa el nombre de la variante."),
    color: optionalText(120),
    attributes: z.record(z.string(), z.json()).default({}),
    barcode: optionalText(120),
    salePrice: z.coerce
      .number("Ingresa un precio válido.")
      .finite("Ingresa un precio válido.")
      .min(0, "El precio no puede ser negativo.")
      .multipleOf(0.01, "El precio admite como máximo dos decimales."),
    isActive: z.boolean().default(true),
  })
  .strict();

export const warehouseSchema = z
  .object({
    code: normalizedCode("el código"),
    name: requiredText("Ingresa el nombre del almacén."),
    description: optionalText(1000),
    address: optionalText(500),
    isActive: z.boolean().default(true),
  })
  .strict();

export const warehouseLocationSchema = z
  .object({
    warehouseId: z.uuid("El almacén no es válido."),
    code: normalizedCode("el código"),
    name: requiredText("Ingresa el nombre de la ubicación."),
    locationType: z.enum(["storage", "picking", "quarantine", "in_transit"], {
      error: "Selecciona un tipo de ubicación válido.",
    }),
    isActive: z.boolean().default(true),
  })
  .strict();

export const supplierSchema = z
  .object({
    code: normalizedCode("el código"),
    businessName: requiredText("Ingresa la razón social."),
    taxId: optionalText(30),
    contactName: optionalText(160),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "El correo es demasiado largo.")
      .refine((value) => value === "" || z.email().safeParse(value).success, "Ingresa un correo válido.")
      .transform((value) => value || null)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    phone: optionalText(40),
    notes: optionalText(1000),
    isActive: z.boolean().default(true),
  })
  .strict();

export const catalogFiltersSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    query: z.string().trim().max(120).default(""),
    status: z.enum(["active", "inactive", "all"]).default("active"),
  })
  .strict();

export const catalogEntityIdSchema = z
  .object({ id: z.uuid("El registro no es válido.") })
  .strict();

export const catalogStatusSchema = z
  .object({
    id: z.uuid("El registro no es válido."),
    isActive: z.boolean(),
  })
  .strict();
