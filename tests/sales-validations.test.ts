import { describe, expect, it } from "vitest";
import { customerSchema, orderItemSchema, paymentSchema, refundSchema, returnOperationSchema } from "@/validations/sales";

const id = "00000000-0000-4000-8000-000000000001";

describe("validaciones de ventas", () => {
  it("normaliza opcionales y correo", () => {
    const value = customerSchema.parse({ fullName:" Cliente Ficticio ", documentType:"", documentNumber:"", email:"TEST@EXAMPLE.INVALID", phone:"", address:"", notes:"" });
    expect(value.fullName).toBe("Cliente Ficticio");
    expect(value.email).toBe("test@example.invalid");
    expect(value.phone).toBeNull();
  });

  it("exige identidad documental completa", () => {
    expect(customerSchema.safeParse({ fullName:"Cliente", documentType:"TEST", documentNumber:"", email:"", phone:"", address:"", notes:"" }).success).toBe(false);
  });

  it("rechaza cantidades y precios negativos", () => {
    expect(orderItemSchema.safeParse({ orderId:id, lineNumber:1, variantId:id, warehouseId:id, locationId:id, quantity:0, unitPrice:-1, discountAmount:0, taxAmount:0 }).success).toBe(false);
  });

  it("valida métodos e importe", () => {
    expect(paymentSchema.safeParse({ orderId:id, amount:1, method:"cash", reference:"", notes:"" }).success).toBe(true);
    expect(paymentSchema.safeParse({ orderId:id, amount:0, method:"cash", reference:"", notes:"" }).success).toBe(false);
  });

  it("exige ubicación y razón para devolver", () => {
    const base={itemId:id,locationId:id,quantity:1,reason:"Producto ficticio devuelto",idempotencyKey:id};
    expect(returnOperationSchema.safeParse(base).success).toBe(true);
    expect(returnOperationSchema.safeParse({...base,locationId:undefined}).success).toBe(false);
  });

  it("exige importe positivo y razón para reembolsar", () => {
    const base={paymentId:id,amount:1,reason:"Corrección ficticia",idempotencyKey:id};
    expect(refundSchema.safeParse(base).success).toBe(true);
    expect(refundSchema.safeParse({...base,amount:0}).success).toBe(false);
    expect(refundSchema.safeParse({...base,reason:""}).success).toBe(false);
  });
});
