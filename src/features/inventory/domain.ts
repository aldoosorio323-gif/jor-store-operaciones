import type { MovementType, PurchaseStatus, TransferStatus } from "@/types/database";

export const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  draft: "Borrador",
  confirmed: "Confirmada",
  partially_received: "Recepción parcial",
  received: "Recibida",
  cancelled: "Cancelada",
};

export const transferStatusLabels: Record<TransferStatus, string> = {
  draft: "Borrador",
  confirmed: "Confirmada",
  in_transit: "En tránsito",
  partially_received: "Recepción parcial",
  received: "Recibida",
  cancelled: "Cancelada",
};

export const movementTypeLabels: Record<MovementType, string> = {
  purchase_entry: "Entrada por compra",
  supplier_return: "Devolución a proveedor",
  transfer_out: "Salida por transferencia",
  transfer_in: "Entrada por transferencia",
  positive_adjustment: "Ajuste positivo",
  negative_adjustment: "Ajuste negativo",
  damaged: "Mercadería dañada",
  lost: "Mercadería perdida",
  initial_stock: "Stock inicial",
  sale_reservation: "Reserva de venta",
  reservation_release: "Liberación de reserva",
  sale_dispatch: "Despacho de venta",
  customer_return: "Devolución de cliente",
};

export const canEditPurchase = (status: PurchaseStatus) => status === "draft";
export const canReceivePurchase = (status: PurchaseStatus) =>
  status === "confirmed" || status === "partially_received";
export const canEditTransfer = (status: TransferStatus) => status === "draft";
export const canDispatchTransfer = (status: TransferStatus) => status === "confirmed";
export const canReceiveTransfer = (status: TransferStatus) =>
  status === "in_transit" || status === "partially_received";

export function calculateWeightedAverage(
  previousStock: number,
  previousAverage: number,
  incomingQuantity: number,
  incomingCost: number,
): number {
  if (previousStock < 0 || previousAverage < 0 || incomingQuantity <= 0 || incomingCost < 0) {
    throw new Error("Valores de costo promedio no válidos.");
  }
  if (previousStock === 0) return Number(incomingCost.toFixed(4));
  return Number(
    (((previousStock * previousAverage) + (incomingQuantity * incomingCost)) /
      (previousStock + incomingQuantity)).toFixed(4),
  );
}
