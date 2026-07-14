import type { OrderPaymentStatus, OrderStatus, PaymentMethod, PaymentStatus } from "@/types/database";

export const orderStatusLabels:Record<OrderStatus,string>={draft:"Borrador",new:"Nuevo",confirmed:"Confirmado",preparing:"En preparación",shipped:"Despachado",delivered:"Entregado",cancelled:"Cancelado",returned:"Devuelto"};
export const orderPaymentLabels:Record<OrderPaymentStatus,string>={pending:"Pendiente",partial:"Parcial",paid:"Pagado",refunded:"Reembolsado",cancelled:"Cancelado"};
export const paymentStatusLabels:Record<PaymentStatus,string>={pending:"Pendiente",paid:"Pagado",refunded:"Reembolsado",cancelled:"Cancelado"};
export const paymentMethodLabels:Record<PaymentMethod,string>={cash:"Efectivo",bank_transfer:"Transferencia bancaria",card:"Tarjeta",digital_wallet:"Billetera digital",other:"Otro"};
export const canEditOrder=(status:OrderStatus)=>status==="draft";
export const canRefundPayment=(role:string,status:PaymentStatus)=>role==="administrator"&&status==="paid";
