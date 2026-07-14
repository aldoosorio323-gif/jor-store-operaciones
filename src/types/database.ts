export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RoleCode = "administrator" | "operator";
export type LocationType = "storage" | "picking" | "quarantine" | "in_transit";
export type PurchaseStatus = "draft" | "confirmed" | "partially_received" | "received" | "cancelled";
export type TransferStatus = "draft" | "confirmed" | "in_transit" | "partially_received" | "received" | "cancelled";
export type MovementType =
  | "purchase_entry"
  | "supplier_return"
  | "transfer_out"
  | "transfer_in"
  | "positive_adjustment"
  | "negative_adjustment"
  | "damaged"
  | "lost"
  | "initial_stock"
  | "sale_reservation"
  | "reservation_release"
  | "sale_dispatch"
  | "customer_return";
export type OrderStatus = "draft" | "new" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled" | "returned";
export type OrderPaymentStatus = "pending" | "partial" | "paid" | "refunded" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "refunded" | "cancelled";
export type PaymentMethod = "cash" | "bank_transfer" | "card" | "digital_wallet" | "other";
export type ShipmentStatus = "draft" | "ready" | "handed_to_carrier" | "in_transit" | "delivered" | "delivery_failed" | "returning" | "returned" | "cancelled";
export type ShipmentEventType = "shipment_created" | "shipment_ready" | "handed_to_carrier" | "transit_update" | "delivery_attempt" | "delivered" | "delivery_failed" | "return_started" | "returned" | "cancelled" | "note_added";

export type Database = {
  public: {
    Tables: {
      roles: {
        Row: {
          id: string;
          code: RoleCode;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          code: RoleCode;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role_id: string;
          display_name: string;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id: string;
          role_id: string;
          display_name: string;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_user_id: string | null;
          action: string;
          target_profile_id: string | null;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json;
          occurred_at: string;
        };
        Insert: {
          id?: number;
          actor_user_id?: string | null;
          action: string;
          target_profile_id?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json;
          occurred_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      products: {
        Row: {
          id: string; name: string; description: string | null; brand: string | null;
          category: string | null; unit_code: string; is_active: boolean;
          created_at: string; updated_at: string; created_by: string; updated_by: string;
        };
        Insert: {
          id?: string; name: string; description?: string | null; brand?: string | null;
          category?: string | null; unit_code: string; is_active?: boolean;
          created_at?: string; updated_at?: string; created_by?: string; updated_by?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string; product_id: string; sku: string; name: string; color: string | null;
          attributes: Json; barcode: string | null; sale_price: number; is_active: boolean;
          created_at: string; updated_at: string; created_by: string; updated_by: string;
        };
        Insert: {
          id?: string; product_id: string; sku: string; name: string; color?: string | null;
          attributes?: Json; barcode?: string | null; sale_price: number; is_active?: boolean;
          created_at?: string; updated_at?: string; created_by?: string; updated_by?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_variants"]["Insert"]>;
        Relationships: [];
      };
      warehouses: {
        Row: {
          id: string; code: string; name: string; description: string | null; address: string | null;
          is_active: boolean; created_at: string; updated_at: string; created_by: string; updated_by: string;
        };
        Insert: {
          id?: string; code: string; name: string; description?: string | null; address?: string | null;
          is_active?: boolean; created_at?: string; updated_at?: string; created_by?: string; updated_by?: string;
        };
        Update: Partial<Database["public"]["Tables"]["warehouses"]["Insert"]>;
        Relationships: [];
      };
      warehouse_locations: {
        Row: {
          id: string; warehouse_id: string; code: string; name: string; location_type: LocationType;
          is_active: boolean; created_at: string; updated_at: string; created_by: string; updated_by: string;
        };
        Insert: {
          id?: string; warehouse_id: string; code: string; name: string; location_type: LocationType;
          is_active?: boolean; created_at?: string; updated_at?: string; created_by?: string; updated_by?: string;
        };
        Update: Partial<Database["public"]["Tables"]["warehouse_locations"]["Insert"]>;
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string; code: string; business_name: string; tax_id: string | null;
          contact_name: string | null; email: string | null; phone: string | null; notes: string | null;
          is_active: boolean; created_at: string; updated_at: string; created_by: string; updated_by: string;
        };
        Insert: {
          id?: string; code: string; business_name: string; tax_id?: string | null;
          contact_name?: string | null; email?: string | null; phone?: string | null; notes?: string | null;
          is_active?: boolean; created_at?: string; updated_at?: string; created_by?: string; updated_by?: string;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string; purchase_number: string; supplier_id: string; supplier_reference: string | null;
          status: PurchaseStatus; ordered_at: string; expected_at: string | null; confirmed_at: string | null;
          confirmed_by: string | null; currency_code: "PEN"; subtotal: number; tax_amount: number;
          total_amount: number; notes: string | null; created_at: string; updated_at: string;
          created_by: string; updated_by: string;
        };
        Insert: {
          id?: string; purchase_number?: string; supplier_id: string; supplier_reference?: string | null;
          status?: PurchaseStatus; ordered_at?: string; expected_at?: string | null; confirmed_at?: string | null;
          confirmed_by?: string | null; currency_code?: "PEN"; subtotal?: number; tax_amount?: number;
          total_amount?: number; notes?: string | null; created_at?: string; updated_at?: string;
          created_by?: string; updated_by?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchases"]["Insert"]>;
        Relationships: [];
      };
      purchase_items: {
        Row: {
          id: string; purchase_id: string; line_number: number; variant_id: string;
          ordered_quantity: number; received_quantity: number; unit_cost: number; tax_amount: number;
          line_subtotal: number; line_total: number; created_at: string; updated_at: string;
          created_by: string; updated_by: string;
        };
        Insert: {
          id?: string; purchase_id: string; line_number: number; variant_id: string;
          ordered_quantity: number; received_quantity?: number; unit_cost: number; tax_amount?: number;
          line_subtotal?: number; line_total?: number; created_at?: string; updated_at?: string;
          created_by?: string; updated_by?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_items"]["Insert"]>;
        Relationships: [];
      };
      inventory_balances: {
        Row: {
          id: string; variant_id: string; warehouse_id: string; location_id: string;
          physical_stock: number; reserved_stock: number; available_stock: number;
          average_unit_cost: number; version: number; created_at: string; updated_at: string;
          created_by: string; updated_by: string;
        };
        Insert: {
          id?: string; variant_id: string; warehouse_id: string; location_id: string;
          physical_stock?: number; reserved_stock?: number; average_unit_cost?: number; version?: number;
          created_at?: string; updated_at?: string; created_by?: string; updated_by?: string;
        };
        Update: never;
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          id: string; balance_id: string; movement_type: MovementType; variant_id: string;
          warehouse_id: string; location_id: string; previous_physical: number; physical_delta: number;
          resulting_physical: number; previous_reserved: number; reserved_delta: number;
          resulting_reserved: number; unit_cost_snapshot: number; reason: string | null;
          purchase_id: string | null; purchase_item_id: string | null; transfer_id: string | null;
          transfer_item_id: string | null; order_id: string | null; order_item_id: string | null;
          related_movement_id: string | null; responsible_user_id: string;
          idempotency_key: string; metadata: Json; occurred_at: string; created_at: string; created_by: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      inventory_transfers: {
        Row: {
          id: string; transfer_number: string; origin_warehouse_id: string; destination_warehouse_id: string;
          status: TransferStatus; confirmed_at: string | null; confirmed_by: string | null;
          dispatched_at: string | null; dispatched_by: string | null; received_at: string | null;
          received_by: string | null; notes: string | null; created_at: string; updated_at: string;
          created_by: string; updated_by: string;
        };
        Insert: {
          id?: string; transfer_number?: string; origin_warehouse_id: string; destination_warehouse_id: string;
          status?: TransferStatus; confirmed_at?: string | null; confirmed_by?: string | null;
          dispatched_at?: string | null; dispatched_by?: string | null; received_at?: string | null;
          received_by?: string | null; notes?: string | null; created_at?: string; updated_at?: string;
          created_by?: string; updated_by?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_transfers"]["Insert"]>;
        Relationships: [];
      };
      inventory_transfer_items: {
        Row: {
          id: string; transfer_id: string; line_number: number; variant_id: string;
          origin_location_id: string; destination_location_id: string; requested_quantity: number;
          dispatched_quantity: number; received_quantity: number; created_at: string; updated_at: string;
          created_by: string; updated_by: string;
        };
        Insert: {
          id?: string; transfer_id: string; line_number: number; variant_id: string;
          origin_location_id: string; destination_location_id: string; requested_quantity: number;
          dispatched_quantity?: number; received_quantity?: number; created_at?: string; updated_at?: string;
          created_by?: string; updated_by?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_transfer_items"]["Insert"]>;
        Relationships: [];
      };
      customers: {
        Row: { id: string; code: string; document_type: string | null; document_number: string | null; full_name: string; email: string | null; phone: string | null; address: string | null; notes: string | null; is_active: boolean; created_at: string; updated_at: string; created_by: string; updated_by: string };
        Insert: { id?: string; code?: string; document_type?: string | null; document_number?: string | null; full_name: string; email?: string | null; phone?: string | null; address?: string | null; notes?: string | null; is_active?: boolean; created_at?: string; updated_at?: string; created_by?: string; updated_by?: string };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>; Relationships: [];
      };
      orders: {
        Row: { id:string; order_number:string; customer_id:string; status:OrderStatus; payment_status:OrderPaymentStatus; ordered_at:string; submitted_at:string|null; confirmed_at:string|null; shipped_at:string|null; delivered_at:string|null; cancelled_at:string|null; submitted_by:string|null; confirmed_by:string|null; shipped_by:string|null; delivered_by:string|null; cancelled_by:string|null; currency_code:"PEN"; subtotal:number; discount_amount:number; tax_amount:number; total_amount:number; paid_amount:number; balance_due:number; notes:string|null; created_at:string; updated_at:string; created_by:string; updated_by:string };
        Insert: { id?:string; order_number?:string; customer_id:string; status?:OrderStatus; payment_status?:OrderPaymentStatus; ordered_at?:string; notes?:string|null; currency_code?:"PEN"; subtotal?:number; discount_amount?:number; tax_amount?:number; total_amount?:number; paid_amount?:number; balance_due?:number; created_at?:string; updated_at?:string; created_by?:string; updated_by?:string };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>; Relationships: [];
      };
      order_items: {
        Row: { id:string; order_id:string; line_number:number; variant_id:string; warehouse_id:string; location_id:string; balance_id:string; quantity:number; reserved_quantity:number; dispatched_quantity:number; returned_quantity:number; unit_cost_snapshot:number; unit_price:number; discount_amount:number; tax_amount:number; line_subtotal:number; line_total:number; created_at:string; updated_at:string; created_by:string; updated_by:string };
        Insert: { id?:string; order_id:string; line_number:number; variant_id:string; warehouse_id:string; location_id:string; balance_id?:string; quantity:number; reserved_quantity?:number; dispatched_quantity?:number; returned_quantity?:number; unit_cost_snapshot?:number; unit_price:number; discount_amount?:number; tax_amount?:number; line_subtotal?:number; line_total?:number; created_at?:string; updated_at?:string; created_by?:string; updated_by?:string };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>; Relationships: [];
      };
      payments: {
        Row: { id:string; payment_number:string; order_id:string; amount:number; method:PaymentMethod; status:PaymentStatus; refunded_payment_id:string|null; paid_at:string|null; reference:string|null; notes:string|null; confirmed_at:string|null; confirmed_by:string|null; cancelled_at:string|null; cancelled_by:string|null; refunded_at:string|null; refunded_by:string|null; created_at:string; updated_at:string; created_by:string; updated_by:string };
        Insert: { id?:string; payment_number?:string; order_id:string; amount:number; method:PaymentMethod; status?:PaymentStatus; refunded_payment_id?:string|null; paid_at?:string|null; reference?:string|null; notes?:string|null; created_at?:string; updated_at?:string; created_by?:string; updated_by?:string };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>; Relationships: [];
      };
      carriers: {
        Row:{id:string;code:string;name:string;contact_name:string|null;email:string|null;phone:string|null;tracking_url_template:string|null;notes:string|null;is_active:boolean;created_at:string;updated_at:string;created_by:string;updated_by:string};
        Insert:{id?:string;code:string;name:string;contact_name?:string|null;email?:string|null;phone?:string|null;tracking_url_template?:string|null;notes?:string|null;is_active?:boolean;created_at?:string;updated_at?:string;created_by?:string;updated_by?:string};
        Update:Partial<Database["public"]["Tables"]["carriers"]["Insert"]>;Relationships:[];
      };
      shipments: {
        Row:{id:string;shipment_number:string;order_id:string;carrier_id:string|null;status:ShipmentStatus;tracking_number:string|null;recipient_name:string;recipient_phone:string|null;address_line:string;district:string|null;province:string|null;department:string|null;address_reference:string|null;shipping_cost:number;currency_code:"PEN";ready_at:string|null;handed_to_carrier_at:string|null;delivered_at:string|null;returned_at:string|null;cancelled_at:string|null;cancelled_by:string|null;version:number;notes:string|null;created_at:string;updated_at:string;created_by:string;updated_by:string};
        Insert:never;Update:never;Relationships:[];
      };
      shipment_items:{Row:{id:string;shipment_id:string;order_id:string;order_item_id:string;quantity:number;created_at:string;updated_at:string;created_by:string;updated_by:string};Insert:never;Update:never;Relationships:[]};
      shipment_events:{Row:{id:string;shipment_id:string;event_type:ShipmentEventType;occurred_at:string;location:string|null;description:string|null;responsible_user_id:string;metadata:Json;created_at:string;created_by:string};Insert:never;Update:never;Relationships:[]};
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: RoleCode | null;
      };
      current_user_is_active: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      current_user_is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      mark_current_user_login: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      admin_update_profile: {
        Args: {
          p_profile_id: string;
          p_role_code: RoleCode;
          p_is_active: boolean;
          p_display_name?: string | null;
        };
        Returns: undefined;
      };
      admin_record_invitation: {
        Args: { p_profile_id: string };
        Returns: undefined;
      };
      record_security_event: {
        Args: { p_action: string };
        Returns: undefined;
      };
      remove_purchase_item: { Args: { p_purchase_item_id: string }; Returns: string };
      confirm_purchase: { Args: { p_purchase_id: string }; Returns: string };
      cancel_purchase: { Args: { p_purchase_id: string }; Returns: string };
      receive_purchase_item: {
        Args: { p_purchase_item_id: string; p_location_id: string; p_quantity: number; p_idempotency_key: string };
        Returns: Json;
      };
      remove_transfer_item: { Args: { p_transfer_item_id: string }; Returns: string };
      confirm_inventory_transfer: { Args: { p_transfer_id: string }; Returns: string };
      cancel_inventory_transfer: { Args: { p_transfer_id: string }; Returns: string };
      dispatch_inventory_transfer: {
        Args: { p_transfer_id: string; p_idempotency_key: string };
        Returns: Json;
      };
      receive_inventory_transfer_item: {
        Args: { p_transfer_item_id: string; p_quantity: number; p_idempotency_key: string };
        Returns: Json;
      };
      adjust_inventory: {
        Args: {
          p_variant_id: string; p_location_id: string; p_movement_type: MovementType;
          p_quantity: number; p_unit_cost: number | null; p_reason: string; p_idempotency_key: string;
        };
        Returns: Json;
      };
      admin_inventory_reconciliation: {
        Args: Record<string, never>;
        Returns: Array<{
          issue_type: string; balance_id: string | null; expected_physical: number | null;
          actual_physical: number | null; expected_reserved: number | null; actual_reserved: number | null;
        }>;
      };
      remove_order_item: { Args:{p_order_item_id:string}; Returns:string };
      submit_order: { Args:{p_order_id:string}; Returns:string };
      return_order_to_draft: { Args:{p_order_id:string}; Returns:string };
      confirm_order: { Args:{p_order_id:string;p_idempotency_key:string}; Returns:Json };
      cancel_order: { Args:{p_order_id:string;p_idempotency_key:string}; Returns:Json };
      dispatch_order_item: { Args:{p_order_item_id:string;p_quantity:number;p_idempotency_key:string}; Returns:Json };
      dispatch_order: { Args:{p_order_id:string;p_idempotency_key:string}; Returns:Json };
      deliver_order: { Args:{p_order_id:string}; Returns:string };
      return_order_item: { Args:{p_order_item_id:string;p_location_id:string;p_quantity:number;p_reason:string;p_idempotency_key:string}; Returns:Json };
      confirm_payment: { Args:{p_payment_id:string;p_paid_at:string|null;p_idempotency_key:string}; Returns:Json };
      cancel_payment: { Args:{p_payment_id:string}; Returns:string };
      refund_payment: { Args:{p_payment_id:string;p_amount:number;p_reason:string;p_idempotency_key:string}; Returns:Json };
      check_customer_duplicate_candidates: { Args:{p_document_type:string|null;p_document_number:string|null;p_email:string|null;p_phone:string|null;p_full_name:string}; Returns:Array<{document_match:boolean;email_match:boolean;phone_match:boolean;name_match:boolean}> };
      admin_financial_reconciliation: { Args:Record<string,never>; Returns:Array<{issue_type:string;order_id:string;payment_id:string|null;expected_value:number|null;actual_value:number|null}> };
      create_shipment:{Args:{p_order_id:string;p_carrier_id:string|null;p_recipient_name:string;p_recipient_phone:string|null;p_address_line:string;p_district:string|null;p_province:string|null;p_department:string|null;p_address_reference:string|null;p_shipping_cost:number;p_tracking_number:string|null;p_notes:string|null};Returns:string};
      add_shipment_item:{Args:{p_shipment_id:string;p_order_item_id:string;p_quantity:number};Returns:string};
      remove_shipment_item:{Args:{p_shipment_item_id:string};Returns:string};
      mark_shipment_ready:{Args:{p_shipment_id:string;p_idempotency_key:string};Returns:Json};
      hand_shipment_to_carrier:{Args:{p_shipment_id:string;p_location:string|null;p_description:string|null;p_idempotency_key:string};Returns:Json};
      add_shipment_transit_event:{Args:{p_shipment_id:string;p_location:string|null;p_description:string|null;p_idempotency_key:string};Returns:Json};
      register_delivery_attempt:{Args:{p_shipment_id:string;p_delivered:boolean;p_location:string|null;p_description:string|null;p_idempotency_key:string};Returns:Json};
      deliver_shipment:{Args:{p_shipment_id:string;p_location:string|null;p_description:string|null;p_idempotency_key:string};Returns:Json};
      start_shipment_return:{Args:{p_shipment_id:string;p_location:string|null;p_description:string|null;p_idempotency_key:string};Returns:Json};
      complete_shipment_return:{Args:{p_shipment_id:string;p_location:string|null;p_description:string|null;p_idempotency_key:string};Returns:Json};
      cancel_shipment:{Args:{p_shipment_id:string;p_description:string|null;p_idempotency_key:string};Returns:Json};
      admin_shipping_reconciliation:{Args:Record<string,never>;Returns:Array<{issue_type:string;shipment_id:string;order_id:string;shipment_item_id:string|null;details:Json}>};
    };
    Enums: {
      location_type: LocationType;
      purchase_status: PurchaseStatus;
      transfer_status: TransferStatus;
      movement_type: MovementType;
      order_status: OrderStatus;
      order_payment_status: OrderPaymentStatus;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
      shipment_status: ShipmentStatus;
      shipment_event_type: ShipmentEventType;
    };
    CompositeTypes: Record<string, never>;
  };
};
