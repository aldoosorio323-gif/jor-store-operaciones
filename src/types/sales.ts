import type { OrderPaymentStatus, OrderStatus, PaymentMethod, PaymentStatus } from "@/types/database";

export const SALES_PAGE_SIZE = 20;
export type CustomerListItem = { id:string; code:string; fullName:string; documentType:string|null; documentNumber:string|null; email:string|null; phone:string|null; address:string|null; notes:string|null; isActive:boolean };
export type OrderListItem = { id:string; orderNumber:string; customerId:string; customerName:string; status:OrderStatus; paymentStatus:OrderPaymentStatus; orderedAt:string; totalAmount:number; paidAmount:number; balanceDue:number };
export type OrderItem = { id:string; orderId:string; lineNumber:number; variantId:string; variantLabel:string; warehouseId:string; locationId:string; locationLabel:string; quantity:number; reservedQuantity:number; dispatchedQuantity:number; returnedQuantity:number; unitCostSnapshot:number; unitPrice:number; discountAmount:number; taxAmount:number; lineTotal:number };
export type OrderDetail = OrderListItem & { notes:string|null; items:OrderItem[] };
export type PaymentListItem = { id:string; paymentNumber:string; orderId:string; orderNumber:string; amount:number; method:PaymentMethod; status:PaymentStatus; refundedPaymentId:string|null; paidAt:string|null; reference:string|null; notes:string|null };
export type PageResult<T> = {items:T[];page:number;pageSize:number;total:number;pageCount:number};
export type SalesFilters = {page:number;query:string;status:string};
export type Option = {id:string;label:string};
