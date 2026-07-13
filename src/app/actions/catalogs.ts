"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/auth";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  catalogEntityIdSchema,
  catalogStatusSchema,
  productSchema,
  productVariantSchema,
  supplierSchema,
  warehouseLocationSchema,
  warehouseSchema,
} from "@/validations/catalogs";

async function getAdministratorClient() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== "administrator") return null;
  return createClient();
}

function invalid(message?: string): ActionResult {
  return { ok: false, message: message ?? "Revisa los datos ingresados." };
}

function databaseMessage(error: { code?: string; message: string }, entity: string): string {
  if (error.code === "23505") return `Ya existe ${entity} con esos datos únicos.`;
  if (error.message.includes("variantes activas")) return "Desactiva primero todas las variantes del producto.";
  if (error.message.includes("ubicaciones activas")) return "Desactiva primero todas las ubicaciones del almacén.";
  if (error.message.includes("producto inactivo")) return "Activa el producto antes de activar la variante.";
  if (error.message.includes("almacén inactivo")) return "Activa el almacén antes de activar la ubicación.";
  return `No fue posible guardar ${entity}.`;
}

function mutationMessage(error: { code?: string; message: string }, entity: string): string {
  if (
    error.code === "PGRST116" ||
    error.code === "42501" ||
    error.message.includes("0 rows") ||
    error.message.includes("no rows")
  ) {
    return "Registro no encontrado o no autorizado.";
  }
  return databaseMessage(error, entity);
}

export async function saveProductAction(id: string | null, input: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  const parsedId = id === null ? null : catalogEntityIdSchema.safeParse({ id });
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  if (parsedId && !parsedId.success) return invalid(parsedId.error.issues[0]?.message);

  try {
    const supabase = await getAdministratorClient();
    if (!supabase) return invalid("Acción no autorizada.");
    const updateValues = {
      name: parsed.data.name,
      description: parsed.data.description,
      brand: parsed.data.brand,
      category: parsed.data.category,
      unit_code: parsed.data.unitCode,
    };
    const result = parsedId
      ? await supabase.from("products").update(updateValues).eq("id", parsedId.data.id).select("id").single()
      : await supabase.from("products").insert({ ...updateValues, is_active: parsed.data.isActive }).select("id").single();
    if (result.error) return invalid(mutationMessage(result.error, "el producto"));
    revalidatePath("/app/productos");
    revalidatePath(`/app/productos/${result.data.id}`);
    return {
      ok: true,
      message: parsedId ? "Producto actualizado." : "Producto creado.",
      redirectTo: `/app/productos/${result.data.id}`,
    };
  } catch {
    return invalid("No fue posible guardar el producto.");
  }
}

export async function setProductStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = catalogStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  try {
    const supabase = await getAdministratorClient();
    if (!supabase) return invalid("Acción no autorizada.");
    const { error } = await supabase
      .from("products")
      .update({ is_active: parsed.data.isActive })
      .eq("id", parsed.data.id)
      .select("id")
      .single();
    if (error) return invalid(mutationMessage(error, "el producto"));
    revalidatePath("/app/productos");
    revalidatePath(`/app/productos/${parsed.data.id}`);
    return { ok: true, message: parsed.data.isActive ? "Producto activado." : "Producto desactivado." };
  } catch {
    return invalid("No fue posible cambiar el estado del producto.");
  }
}

export async function saveVariantAction(id: string | null, input: unknown): Promise<ActionResult> {
  const parsed = productVariantSchema.safeParse(input);
  const parsedId = id === null ? null : catalogEntityIdSchema.safeParse({ id });
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  if (parsedId && !parsedId.success) return invalid(parsedId.error.issues[0]?.message);
  try {
    const supabase = await getAdministratorClient();
    if (!supabase) return invalid("Acción no autorizada.");
    const updateValues = {
      product_id: parsed.data.productId,
      sku: parsed.data.sku,
      name: parsed.data.name,
      color: parsed.data.color,
      attributes: parsed.data.attributes,
      barcode: parsed.data.barcode,
      sale_price: parsed.data.salePrice,
    };
    const result = parsedId
      ? await supabase.from("product_variants").update(updateValues).eq("id", parsedId.data.id).select("id, product_id").single()
      : await supabase.from("product_variants").insert({ ...updateValues, is_active: parsed.data.isActive }).select("id, product_id").single();
    if (result.error) return invalid(mutationMessage(result.error, "la variante"));
    revalidatePath(`/app/productos/${result.data.product_id}`);
    revalidatePath("/app/productos");
    return { ok: true, message: parsedId ? "Variante actualizada." : "Variante creada." };
  } catch {
    return invalid("No fue posible guardar la variante.");
  }
}

export async function setVariantStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = catalogStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  try {
    const supabase = await getAdministratorClient();
    if (!supabase) return invalid("Acción no autorizada.");
    const { data, error } = await supabase
      .from("product_variants")
      .update({ is_active: parsed.data.isActive })
      .eq("id", parsed.data.id)
      .select("product_id")
      .single();
    if (error) return invalid(mutationMessage(error, "la variante"));
    revalidatePath(`/app/productos/${data.product_id}`);
    return { ok: true, message: parsed.data.isActive ? "Variante activada." : "Variante desactivada." };
  } catch {
    return invalid("No fue posible cambiar el estado de la variante.");
  }
}

export async function saveWarehouseAction(id: string | null, input: unknown): Promise<ActionResult> {
  const parsed = warehouseSchema.safeParse(input);
  const parsedId = id === null ? null : catalogEntityIdSchema.safeParse({ id });
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  if (parsedId && !parsedId.success) return invalid(parsedId.error.issues[0]?.message);
  try {
    const supabase = await getAdministratorClient();
    if (!supabase) return invalid("Acción no autorizada.");
    const updateValues = {
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description,
      address: parsed.data.address,
    };
    const result = parsedId
      ? await supabase.from("warehouses").update(updateValues).eq("id", parsedId.data.id).select("id").single()
      : await supabase.from("warehouses").insert({ ...updateValues, is_active: parsed.data.isActive }).select("id").single();
    if (result.error) return invalid(mutationMessage(result.error, "el almacén"));
    revalidatePath("/app/almacenes");
    revalidatePath(`/app/almacenes/${result.data.id}`);
    return {
      ok: true,
      message: parsedId ? "Almacén actualizado." : "Almacén creado.",
      redirectTo: `/app/almacenes/${result.data.id}`,
    };
  } catch {
    return invalid("No fue posible guardar el almacén.");
  }
}

export async function setWarehouseStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = catalogStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  try {
    const supabase = await getAdministratorClient();
    if (!supabase) return invalid("Acción no autorizada.");
    const { error } = await supabase
      .from("warehouses")
      .update({ is_active: parsed.data.isActive })
      .eq("id", parsed.data.id)
      .select("id")
      .single();
    if (error) return invalid(mutationMessage(error, "el almacén"));
    revalidatePath("/app/almacenes");
    revalidatePath(`/app/almacenes/${parsed.data.id}`);
    return { ok: true, message: parsed.data.isActive ? "Almacén activado." : "Almacén desactivado." };
  } catch {
    return invalid("No fue posible cambiar el estado del almacén.");
  }
}

export async function saveLocationAction(id: string | null, input: unknown): Promise<ActionResult> {
  const parsed = warehouseLocationSchema.safeParse(input);
  const parsedId = id === null ? null : catalogEntityIdSchema.safeParse({ id });
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  if (parsedId && !parsedId.success) return invalid(parsedId.error.issues[0]?.message);
  try {
    const supabase = await getAdministratorClient();
    if (!supabase) return invalid("Acción no autorizada.");
    const updateValues = {
      warehouse_id: parsed.data.warehouseId,
      code: parsed.data.code,
      name: parsed.data.name,
      location_type: parsed.data.locationType,
    };
    const result = parsedId
      ? await supabase.from("warehouse_locations").update(updateValues).eq("id", parsedId.data.id).select("id, warehouse_id").single()
      : await supabase.from("warehouse_locations").insert({ ...updateValues, is_active: parsed.data.isActive }).select("id, warehouse_id").single();
    if (result.error) return invalid(mutationMessage(result.error, "la ubicación"));
    revalidatePath(`/app/almacenes/${result.data.warehouse_id}`);
    return { ok: true, message: parsedId ? "Ubicación actualizada." : "Ubicación creada." };
  } catch {
    return invalid("No fue posible guardar la ubicación.");
  }
}

export async function setLocationStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = catalogStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  try {
    const supabase = await getAdministratorClient();
    if (!supabase) return invalid("Acción no autorizada.");
    const { data, error } = await supabase
      .from("warehouse_locations")
      .update({ is_active: parsed.data.isActive })
      .eq("id", parsed.data.id)
      .select("warehouse_id")
      .single();
    if (error) return invalid(mutationMessage(error, "la ubicación"));
    revalidatePath(`/app/almacenes/${data.warehouse_id}`);
    return { ok: true, message: parsed.data.isActive ? "Ubicación activada." : "Ubicación desactivada." };
  } catch {
    return invalid("No fue posible cambiar el estado de la ubicación.");
  }
}

export async function saveSupplierAction(id: string | null, input: unknown): Promise<ActionResult> {
  const parsed = supplierSchema.safeParse(input);
  const parsedId = id === null ? null : catalogEntityIdSchema.safeParse({ id });
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  if (parsedId && !parsedId.success) return invalid(parsedId.error.issues[0]?.message);
  try {
    const supabase = await getAdministratorClient();
    if (!supabase) return invalid("Acción no autorizada.");
    const updateValues = {
      code: parsed.data.code,
      business_name: parsed.data.businessName,
      tax_id: parsed.data.taxId,
      contact_name: parsed.data.contactName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
    };
    const result = parsedId
      ? await supabase.from("suppliers").update(updateValues).eq("id", parsedId.data.id).select("id").single()
      : await supabase.from("suppliers").insert({ ...updateValues, is_active: parsed.data.isActive }).select("id").single();
    if (result.error) return invalid(mutationMessage(result.error, "el proveedor"));
    revalidatePath("/app/proveedores");
    revalidatePath(`/app/proveedores/${result.data.id}`);
    return {
      ok: true,
      message: parsedId ? "Proveedor actualizado." : "Proveedor creado.",
      redirectTo: `/app/proveedores/${result.data.id}`,
    };
  } catch {
    return invalid("No fue posible guardar el proveedor.");
  }
}

export async function setSupplierStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = catalogStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  try {
    const supabase = await getAdministratorClient();
    if (!supabase) return invalid("Acción no autorizada.");
    const { error } = await supabase
      .from("suppliers")
      .update({ is_active: parsed.data.isActive })
      .eq("id", parsed.data.id)
      .select("id")
      .single();
    if (error) return invalid(mutationMessage(error, "el proveedor"));
    revalidatePath("/app/proveedores");
    revalidatePath(`/app/proveedores/${parsed.data.id}`);
    return { ok: true, message: parsed.data.isActive ? "Proveedor activado." : "Proveedor desactivado." };
  } catch {
    return invalid("No fue posible cambiar el estado del proveedor.");
  }
}
