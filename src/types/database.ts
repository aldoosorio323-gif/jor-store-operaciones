export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RoleCode = "administrator" | "operator";
export type LocationType = "storage" | "picking" | "quarantine" | "in_transit";

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
    };
    Enums: {
      location_type: LocationType;
    };
    CompositeTypes: Record<string, never>;
  };
};
