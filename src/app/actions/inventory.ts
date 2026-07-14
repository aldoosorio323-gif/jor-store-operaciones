"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/auth";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  entityIdSchema,
  idempotencyKeySchema,
  inventoryAdjustmentSchema,
  purchaseItemSchema,
  purchaseReceiptSchema,
  purchaseSchema,
  transferItemSchema,
  transferReceiptSchema,
  transferSchema,
} from "@/validations/inventory";

const failure = (message = "Revisa los datos ingresados."): ActionResult => ({ ok: false, message });

async function getOperationsClient(administratorOnly = false) {
  const user = await getCurrentUserContext();
  if (!user || (administratorOnly && user.role !== "administrator")) return null;
  if (user.role !== "administrator" && user.role !== "operator") return null;
  return createClient();
}

function safeDatabaseMessage(error: { code?: string; message: string }, fallback: string) {
  if (error.code === "PGRST116" || error.code === "P0002" || error.code === "42501"
    || error.message.includes("0 rows") || error.message.includes("no rows")) {
    return "Registro no encontrado o no autorizado.";
  }
  if (error.code === "23505") return "La operaciÃ³n ya existe o utiliza datos duplicados.";
  const message = error.message.toLowerCase();
  if (message.includes("stock disponible")) return "No existe stock disponible suficiente para completar la operaciÃ³n.";
  if (message.includes("cantidad supera")) return "La cantidad supera el pendiente permitido.";
  if (message.includes("idempotencia")) return "La clave de operaciÃ³n ya fue utilizada con otros datos.";
  if (message.includes("borrador") || message.includes("confirmada") || message.includes("recepciÃ³n") || message.includes("despacho")) return "El estado actual del registro no permite esta operaciÃ³n.";
  if (message.includes("variante") || message.includes("ubicaciÃ³n") || message.includes("almacenes") || message.includes("proveedor")) return "Uno de los catÃ¡logos seleccionados no estÃ¡ activo o autorizado.";
  if (message.includes("costo unitario")) return "Ingresa un costo unitario vÃ¡lido.";
  if (message.includes("razÃ³n")) return "La razÃ³n es obligatoria.";
  if (message.includes("historial previo")) return "El stock inicial solo puede registrarse sin historial previo.";
  return fallback;
}

export async function savePurchaseAction(id: string | null, input: unknown): Promise<ActionResult> {
  const parsed = purchaseSchema.safeParse(input);
  const parsedId = id === null ? null : entityIdSchema.safeParse(id);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  if (parsedId && !parsedId.success) return failure(parsedId.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const values = {
      supplier_id: parsed.data.supplierId,
      supplier_reference: parsed.data.supplierReference,
      ordered_at: new Date(parsed.data.orderedAt).toISOString(),
      expected_at: parsed.data.expectedAt,
      notes: parsed.data.notes,
    };
    const result = parsedId
      ? await supabase.from("purchases").update(values).eq("id", parsedId.data).select("id").single()
      : await supabase.from("purchases").insert(values).select("id").single();
    if (result.error) return failure(safeDatabaseMessage(result.error, "No fue posible guardar la compra."));
    revalidatePath("/app/compras");
    revalidatePath(`/app/compras/${result.data.id}`);
    return { ok: true, message: parsedId ? "Compra actualizada." : "Compra creada.", redirectTo: `/app/compras/${result.data.id}` };
  } catch { return failure("No fue posible guardar la compra."); }
}

export async function savePurchaseItemAction(id: string | null, input: unknown): Promise<ActionResult> {
  const parsed = purchaseItemSchema.safeParse(input);
  const parsedId = id === null ? null : entityIdSchema.safeParse(id);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  if (parsedId && !parsedId.success) return failure(parsedId.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const values = {
      line_number: parsed.data.lineNumber, variant_id: parsed.data.variantId,
      ordered_quantity: parsed.data.orderedQuantity, unit_cost: parsed.data.unitCost,
      tax_amount: parsed.data.taxAmount,
    };
    const result = parsedId
      ? await supabase.from("purchase_items").update(values).eq("id", parsedId.data).select("id, purchase_id").single()
      : await supabase.from("purchase_items").insert({ ...values, purchase_id: parsed.data.purchaseId }).select("id, purchase_id").single();
    if (result.error) return failure(safeDatabaseMessage(result.error, "No fue posible guardar la lÃ­nea."));
    revalidatePath(`/app/compras/${result.data.purchase_id}`);
    return { ok: true, message: parsedId ? "LÃ­nea actualizada." : "LÃ­nea aÃ±adida." };
  } catch { return failure("No fue posible guardar la lÃ­nea."); }
}

export async function removePurchaseItemAction(input: unknown): Promise<ActionResult> {
  const parsed = entityIdSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const { data, error } = await supabase.rpc("remove_purchase_item", { p_purchase_item_id: parsed.data });
    if (error || !data) return failure(safeDatabaseMessage(error ?? { message: "no rows" }, "No fue posible retirar la lÃ­nea."));
    revalidatePath(`/app/compras/${data}`);
    return { ok: true, message: "LÃ­nea retirada." };
  } catch { return failure("No fue posible retirar la lÃ­nea."); }
}

export async function confirmPurchaseAction(input: unknown): Promise<ActionResult> {
  const parsed = entityIdSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const { data, error } = await supabase.rpc("confirm_purchase", { p_purchase_id: parsed.data });
    if (error || !data) return failure(safeDatabaseMessage(error ?? { message: "no rows" }, "No fue posible confirmar la compra."));
    revalidatePath("/app/compras"); revalidatePath(`/app/compras/${data}`);
    return { ok: true, message: "Compra confirmada. El stock no cambia hasta recibir mercaderÃ­a." };
  } catch { return failure("No fue posible confirmar la compra."); }
}

export async function cancelPurchaseAction(input: unknown): Promise<ActionResult> {
  const parsed = entityIdSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const { data, error } = await supabase.rpc("cancel_purchase", { p_purchase_id: parsed.data });
    if (error || !data) return failure(safeDatabaseMessage(error ?? { message: "no rows" }, "No fue posible cancelar la compra."));
    revalidatePath("/app/compras"); revalidatePath(`/app/compras/${data}`);
    return { ok: true, message: "Compra cancelada." };
  } catch { return failure("No fue posible cancelar la compra."); }
}

export async function receivePurchaseItemAction(input: unknown): Promise<ActionResult> {
  const parsed = purchaseReceiptSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const { data, error } = await supabase.rpc("receive_purchase_item", {
      p_purchase_item_id: parsed.data.purchaseItemId, p_location_id: parsed.data.locationId,
      p_quantity: parsed.data.quantity, p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (error || !data) return failure(safeDatabaseMessage(error ?? { message: "no rows" }, "No fue posible registrar la recepciÃ³n."));
    revalidatePath("/app/compras"); revalidatePath("/app/inventario"); revalidatePath("/app/inventario/movimientos");
    return { ok: true, message: "RecepciÃ³n registrada sin duplicar el intento." };
  } catch { return failure("No fue posible registrar la recepciÃ³n."); }
}

export async function saveTransferAction(id: string | null, input: unknown): Promise<ActionResult> {
  const parsed = transferSchema.safeParse(input);
  const parsedId = id === null ? null : entityIdSchema.safeParse(id);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  if (parsedId && !parsedId.success) return failure(parsedId.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const values = {
      origin_warehouse_id: parsed.data.originWarehouseId,
      destination_warehouse_id: parsed.data.destinationWarehouseId,
      notes: parsed.data.notes,
    };
    const result = parsedId
      ? await supabase.from("inventory_transfers").update(values).eq("id", parsedId.data).select("id").single()
      : await supabase.from("inventory_transfers").insert(values).select("id").single();
    if (result.error) return failure(safeDatabaseMessage(result.error, "No fue posible guardar la transferencia."));
    revalidatePath("/app/transferencias"); revalidatePath(`/app/transferencias/${result.data.id}`);
    return { ok: true, message: parsedId ? "Transferencia actualizada." : "Transferencia creada.", redirectTo: `/app/transferencias/${result.data.id}` };
  } catch { return failure("No fue posible guardar la transferencia."); }
}

export async function saveTransferItemAction(id: string | null, input: unknown): Promise<ActionResult> {
  const parsed = transferItemSchema.safeParse(input);
  const parsedId = id === null ? null : entityIdSchema.safeParse(id);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  if (parsedId && !parsedId.success) return failure(parsedId.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const values = {
      line_number: parsed.data.lineNumber, variant_id: parsed.data.variantId,
      origin_location_id: parsed.data.originLocationId,
      destination_location_id: parsed.data.destinationLocationId,
      requested_quantity: parsed.data.requestedQuantity,
    };
    const result = parsedId
      ? await supabase.from("inventory_transfer_items").update(values).eq("id", parsedId.data).select("id, transfer_id").single()
      : await supabase.from("inventory_transfer_items").insert({ ...values, transfer_id: parsed.data.transferId }).select("id, transfer_id").single();
    if (result.error) return failure(safeDatabaseMessage(result.error, "No fue posible guardar la lÃ­nea."));
    revalidatePath(`/app/transferencias/${result.data.transfer_id}`);
    return { ok: true, message: parsedId ? "LÃ­nea actualizada." : "LÃ­nea aÃ±adida." };
  } catch { return failure("No fue posible guardar la lÃ­nea."); }
}

export async function removeTransferItemAction(input: unknown): Promise<ActionResult> {
  const parsed = entityIdSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const { data, error } = await supabase.rpc("remove_transfer_item", { p_transfer_item_id: parsed.data });
    if (error || !data) return failure(safeDatabaseMessage(error ?? { message: "no rows" }, "No fue posible retirar la lÃ­nea."));
    revalidatePath(`/app/transferencias/${data}`);
    return { ok: true, message: "LÃ­nea retirada." };
  } catch { return failure("No fue posible retirar la lÃ­nea."); }
}

async function transferIdAction(name: "confirm_inventory_transfer" | "cancel_inventory_transfer", input: unknown) {
  const parsed = entityIdSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const { data, error } = await supabase.rpc(name, { p_transfer_id: parsed.data });
    if (error || !data) return failure(safeDatabaseMessage(error ?? { message: "no rows" }, "No fue posible cambiar la transferencia."));
    revalidatePath("/app/transferencias"); revalidatePath(`/app/transferencias/${data}`);
    return { ok: true, message: name === "confirm_inventory_transfer" ? "Transferencia confirmada." : "Transferencia cancelada." };
  } catch { return failure("No fue posible cambiar la transferencia."); }
}

export async function confirmTransferAction(input: unknown) { return transferIdAction("confirm_inventory_transfer", input); }
export async function cancelTransferAction(input: unknown) { return transferIdAction("cancel_inventory_transfer", input); }

export async function dispatchTransferAction(transferId: unknown, idempotencyKey: unknown): Promise<ActionResult> {
  const id = entityIdSchema.safeParse(transferId);
  const key = idempotencyKeySchema.safeParse(idempotencyKey);
  if (!id.success || !key.success) return failure("La operaciÃ³n no es vÃ¡lida.");
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const { data, error } = await supabase.rpc("dispatch_inventory_transfer", { p_transfer_id: id.data, p_idempotency_key: key.data });
    if (error || !data) return failure(safeDatabaseMessage(error ?? { message: "no rows" }, "No fue posible despachar la transferencia."));
    revalidatePath("/app/transferencias"); revalidatePath(`/app/transferencias/${id.data}`); revalidatePath("/app/inventario");
    return { ok: true, message: "Transferencia despachada. El destino no recibe stock hasta confirmar su recepciÃ³n." };
  } catch { return failure("No fue posible despachar la transferencia."); }
}

export async function receiveTransferItemAction(input: unknown): Promise<ActionResult> {
  const parsed = transferReceiptSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient();
    if (!supabase) return failure("AcciÃ³n no autorizada.");
    const { data, error } = await supabase.rpc("receive_inventory_transfer_item", {
      p_transfer_item_id: parsed.data.transferItemId, p_quantity: parsed.data.quantity,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (error || !data) return failure(safeDatabaseMessage(error ?? { message: "no rows" }, "No fue posible recibir la transferencia."));
    revalidatePath("/app/transferencias"); revalidatePath("/app/inventario"); revalidatePath("/app/inventario/movimientos");
    return { ok: true, message: "RecepciÃ³n de transferencia registrada." };
  } catch { return failure("No fue posible recibir la transferencia."); }
}

export async function adjustInventoryAction(input: unknown): Promise<ActionResult> {
  const parsed = inventoryAdjustmentSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message);
  try {
    const supabase = await getOperationsClient(true);
    if (!supabase) return failure("AcciÃ³n reservada para administradores activos.");
    const { data, error } = await supabase.rpc("adjust_inventory", {
      p_variant_id: parsed.data.variantId, p_location_id: parsed.data.locationId,
      p_movement_type: parsed.data.movementType, p_quantity: parsed.data.quantity,
      p_unit_cost: parsed.data.unitCost, p_reason: parsed.data.reason,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (error || !data) return failure(safeDatabaseMessage(error ?? { message: "no rows" }, "No fue posible registrar el ajuste."));
    revalidatePath("/app/inventario"); revalidatePath("/app/inventario/movimientos"); revalidatePath("/app/ajustes");
    const resultingStock = typeof data === "object" && data !== null && !Array.isArray(data)
      && typeof data.physical_stock === "number" ? data.physical_stock : null;
    return {
      ok: true,
      message: resultingStock === null
        ? "Ajuste registrado con su movimiento inmutable."
        : `Ajuste registrado. Saldo fÃ­sico resultante: ${resultingStock}.`,
    };
  } catch { return failure("No fue posible registrar el ajuste."); }
}
