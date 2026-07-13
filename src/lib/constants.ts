export const APP_TIMEZONE = "America/Lima" as const;
export const APP_CURRENCY = "PEN" as const;

export function calculateAvailableStock(
  physicalStock: number,
  reservedStock: number,
): number {
  if (physicalStock < 0 || reservedStock < 0 || reservedStock > physicalStock) {
    throw new RangeError("El stock físico y reservado no pueden producir un saldo negativo.");
  }

  return physicalStock - reservedStock;
}
