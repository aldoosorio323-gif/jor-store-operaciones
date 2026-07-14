import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const quantity = z.coerce.number().finite().positive("La cantidad debe ser mayor que cero.")
  .multipleOf(0.001, "La cantidad admite como mÃ¡ximo tres decimales.");
const money = z.coerce.number().finite().min(0, "El importe no puede ser negativo.")
  .multipleOf(0.01, "El importe admite como mÃ¡ximo dos decimales.");
const unitCost = z.coerce.number().finite().min(0, "El costo no puede ser negativo.")
  .multipleOf(0.0001, "El costo admite como mÃ¡ximo cuatro decimales.");
const optionalDate = z.string().trim().refine(
  (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
  "La fecha no es vÃ¡lida.",
).transform((value) => value || null);

export const entityIdSchema = z.uuid("El registro no es vÃ¡lido.");
export const idempotencyKeySchema = z.string().trim().min(16, "La clave de operaciÃ³n no es vÃ¡lida.")
  .max(160).regex(/^[A-Za-z0-9._:-]+$/, "La clave de operaciÃ³n no es vÃ¡lida.");

export const purchaseSchema = z.object({
  supplierId: entityIdSchema,
  supplierReference: optionalText(120),
  orderedAt: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "La fecha de compra no es vÃ¡lida."),
  expectedAt: optionalDate,
  notes: optionalText(1000),
}).strict();

export const purchaseItemSchema = z.object({
  purchaseId: entityIdSchema,
  lineNumber: z.coerce.number().int().positive("El nÃºmero de lÃ­nea debe ser positivo."),
  variantId: entityIdSchema,
  orderedQuantity: quantity,
  unitCost,
  taxAmount: money,
}).strict();

export const purchaseReceiptSchema = z.object({
  purchaseItemId: entityIdSchema,
  locationId: entityIdSchema,
  quantity,
  idempotencyKey: idempotencyKeySchema,
}).strict();

export const transferSchema = z.object({
  originWarehouseId: entityIdSchema,
  destinationWarehouseId: entityIdSchema,
  notes: optionalText(1000),
}).strict().refine(
  (value) => value.originWarehouseId !== value.destinationWarehouseId,
  { message: "El almacÃ©n de destino debe ser diferente.", path: ["destinationWarehouseId"] },
);

export const transferItemSchema = z.object({
  transferId: entityIdSchema,
  lineNumber: z.coerce.number().int().positive("El nÃºmero de lÃ­nea debe ser positivo."),
  variantId: entityIdSchema,
  originLocationId: entityIdSchema,
  destinationLocationId: entityIdSchema,
  requestedQuantity: quantity,
}).strict().refine(
  (value) => value.originLocationId !== value.destinationLocationId,
  { message: "Las ubicaciones deben ser diferentes.", path: ["destinationLocationId"] },
);

export const transferReceiptSchema = z.object({
  transferItemId: entityIdSchema,
  quantity,
  idempotencyKey: idempotencyKeySchema,
}).strict();

export const inventoryAdjustmentSchema = z.object({
  variantId: entityIdSchema,
  locationId: entityIdSchema,
  movementType: z.enum(["initial_stock", "positive_adjustment", "negative_adjustment", "damaged", "lost"]),
  quantity,
  unitCost: z.union([z.null(), unitCost]),
  reason: z.string().trim().min(3, "Ingresa una razÃ³n.").max(500),
  idempotencyKey: idempotencyKeySchema,
}).strict().superRefine((value, context) => {
  if (["initial_stock", "positive_adjustment"].includes(value.movementType) && value.unitCost === null) {
    context.addIssue({ code: "custom", path: ["unitCost"], message: "Las entradas requieren costo unitario." });
  }
});

export const inventoryFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  query: z.string().trim().max(120).default(""),
  status: z.enum(["all", "draft", "confirmed", "partially_received", "received", "cancelled", "in_transit"]).default("all"),
  supplierId: z.union([entityIdSchema, z.literal("")]).default(""),
  warehouseId: z.union([entityIdSchema, z.literal("")]).default(""),
  locationId: z.union([entityIdSchema, z.literal("")]).default(""),
  variantId: z.union([entityIdSchema, z.literal("")]).default(""),
  movementType: z.enum(["", "purchase_entry", "supplier_return", "transfer_out", "transfer_in", "positive_adjustment", "negative_adjustment", "damaged", "lost", "initial_stock"]).default(""),
  positiveOnly: z.coerce.boolean().default(false),
  dateFrom: z.string().trim().max(10).default(""),
  dateTo: z.string().trim().max(10).default(""),
}).strict();
