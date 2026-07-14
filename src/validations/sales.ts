import { z } from "zod";

const emptyToNull = (value: unknown) => typeof value === "string" && value.trim() === "" ? null : value;
const optionalText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable());
const uuid = z.string().uuid("Identificador inválido.");
const positive = z.coerce.number().positive("Debe ser mayor que cero.");
const hasAtMostTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
const positiveMoney = z.coerce.number().finite().positive("El importe debe ser mayor que cero.").refine(hasAtMostTwoDecimals, "Usa como máximo dos decimales.");
const nonnegativeMoney = z.coerce.number().finite().min(0, "No puede ser negativo.").refine(hasAtMostTwoDecimals, "Usa como máximo dos decimales.");

export const customerSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresa el nombre del cliente.").max(160),
  documentType: optionalText(30), documentNumber: optionalText(40),
  email: z.preprocess(emptyToNull, z.string().trim().toLowerCase().email("Correo inválido.").nullable()),
  phone: optionalText(40), address: optionalText(240), notes: optionalText(500),
}).strict().superRefine((value, context) => {
  if ((value.documentType === null) !== (value.documentNumber === null)) context.addIssue({ code: "custom", message: "Tipo y número de documento deben ingresarse juntos." });
});

export const orderSchema = z.object({ customerId: uuid, orderedAt: z.string().min(1), notes: optionalText(500) }).strict();
export const orderItemSchema = z.object({ orderId:uuid, lineNumber:z.coerce.number().int().positive(), variantId:uuid, warehouseId:uuid, locationId:uuid, quantity:positive, unitPrice:nonnegativeMoney, discountAmount:nonnegativeMoney, taxAmount:nonnegativeMoney }).strict().superRefine((value,context)=>{
  const subtotal=Math.round(value.quantity*value.unitPrice*100)/100;
  if(value.discountAmount>subtotal)context.addIssue({code:"custom",path:["discountAmount"],message:"El descuento no puede superar el subtotal de la línea."});
});
export const paymentSchema = z.object({ orderId:uuid, amount:positiveMoney, method:z.enum(["cash","bank_transfer","card","digital_wallet","other"]), reference:optionalText(120), notes:optionalText(500) }).strict();
export const paidAtSchema = z.object({ paymentId:uuid, paidAt:z.string().min(1), idempotencyKey:z.string().uuid() }).strict();
export const quantityOperationSchema = z.object({ itemId:uuid, quantity:positive, idempotencyKey:z.string().uuid(), reason:optionalText(240).optional() }).strict();
export const returnOperationSchema = z.object({ itemId:uuid, locationId:uuid, quantity:positive, reason:z.string().trim().min(3,"Ingresa la razón de la devolución.").max(240), idempotencyKey:z.string().uuid() }).strict();
export const refundSchema = z.object({ paymentId:uuid, amount:positive, reason:z.string().trim().min(3,"Ingresa la razón del reembolso.").max(240), idempotencyKey:z.string().uuid() }).strict();
export const salesIdSchema = uuid;
export const salesFiltersSchema = z.object({ page:z.coerce.number().int().positive().default(1), query:z.string().trim().max(100).default(""), status:z.string().trim().max(40).default("all") }).strict();
