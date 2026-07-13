export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RoleCode = "administrator" | "operator";

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
          metadata: Json;
          occurred_at: string;
        };
        Insert: {
          id?: number;
          actor_user_id?: string | null;
          action: string;
          target_profile_id?: string | null;
          metadata?: Json;
          occurred_at?: string;
        };
        Update: never;
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
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
