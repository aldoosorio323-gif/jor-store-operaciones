import type { MovementType, PurchaseStatus, TransferStatus } from "@/types/database";

export const INVENTORY_PAGE_SIZE = 20;

export type InventoryFilters = {
  page: number;
  query: string;
  status: string;
  supplierId: string;
  warehouseId: string;
  locationId: string;
  variantId: string;
  movementType: string;
  positiveOnly: boolean;
  dateFrom: string;
  dateTo: string;
};

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type SelectOption = { id: string; label: string };
export type LocationOption = SelectOption & { warehouseId: string; locationType: string };

export type PurchaseListItem = {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  supplierReference: string | null;
  status: PurchaseStatus;
  orderedAt: string;
  totalAmount: number;
};

export type PurchaseItem = {
  id: string;
  purchaseId: string;
  lineNumber: number;
  variantId: string;
  variantLabel: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
};

export type PurchaseDetail = PurchaseListItem & {
  expectedAt: string | null;
  confirmedAt: string | null;
  currencyCode: "PEN";
  subtotal: number;
  taxAmount: number;
  notes: string | null;
  items: PurchaseItem[];
};

export type InventoryBalanceItem = {
  id: string;
  variantId: string;
  variantLabel: string;
  sku: string;
  warehouseId: string;
  warehouseLabel: string;
  locationId: string;
  locationLabel: string;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  averageUnitCost: number;
  version: number;
};

export type InventoryMovementItem = {
  id: string;
  movementType: MovementType;
  variantLabel: string;
  sku: string;
  warehouseLabel: string;
  locationLabel: string;
  previousPhysical: number;
  physicalDelta: number;
  resultingPhysical: number;
  previousReserved: number;
  reservedDelta: number;
  resultingReserved: number;
  unitCostSnapshot: number;
  reason: string | null;
  occurredAt: string;
};

export type TransferListItem = {
  id: string;
  transferNumber: string;
  originWarehouseId: string;
  originWarehouseName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  status: TransferStatus;
  createdAt: string;
};

export type TransferItem = {
  id: string;
  transferId: string;
  lineNumber: number;
  variantId: string;
  variantLabel: string;
  originLocationId: string;
  originLocationName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  requestedQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
};

export type TransferDetail = TransferListItem & {
  confirmedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  items: TransferItem[];
};
