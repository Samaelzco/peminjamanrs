
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  "public": {
          Tables: {
            "aset": {
                  Row: {
                    "created_at": string,"deskripsi": string | null,"id": number,"kategori_id": number,"kode_aset": string,"kondisi": Database["public"]['Enums']["kondisi_aset"],"nama_aset": string,"status": Database["public"]['Enums']["status_aset"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deskripsi"?: string | null,"id"?: never,"kategori_id": number,"kode_aset"?: string,"kondisi"?: Database["public"]['Enums']["kondisi_aset"],"nama_aset": string,"status"?: Database["public"]['Enums']["status_aset"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deskripsi"?: string | null,"id"?: never,"kategori_id"?: number,"kode_aset"?: string,"kondisi"?: Database["public"]['Enums']["kondisi_aset"],"nama_aset"?: string,"status"?: Database["public"]['Enums']["status_aset"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "aset_kategori_id_fkey"
      columns: ["kategori_id"]
isOneToOne: false
      referencedRelation: "kategori"
      referencedColumns: ["id"]
    }
                  ]
                },"kategori": {
                  Row: {
                    "created_at": string,"id": number,"kode_prefix": string,"nama": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"kode_prefix": string,"nama": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"kode_prefix"?: string,"nama"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"permissions": {
                  Row: {
                    "deskripsi": string | null,"id": number,"modul": string,"nama": string
                  }
                  ComputedFields: never
                  Insert: {
                    "deskripsi"?: string | null,"id"?: never,"modul": string,"nama": string
                  }
                  Update: {
                    "deskripsi"?: string | null,"id"?: never,"modul"?: string,"nama"?: string
                  }
                  Relationships: [
                    
                  ]
                },"role_permissions": {
                  Row: {
                    "permission_id": number,"role_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "permission_id": number,"role_id": number
                  }
                  Update: {
                    "permission_id"?: number,"role_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_id_fkey"
      columns: ["permission_id"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "role_permissions_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"roles": {
                  Row: {
                    "created_at": string,"deskripsi": string | null,"id": number,"nama": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deskripsi"?: string | null,"id"?: never,"nama": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deskripsi"?: string | null,"id"?: never,"nama"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff_it": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"nama": string,"role_id": number,"status": Database["public"]['Enums']["status_akun"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id": string,"nama": string,"role_id": number,"status"?: Database["public"]['Enums']["status_akun"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"nama"?: string,"role_id"?: number,"status"?: Database["public"]['Enums']["status_akun"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_it_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "has_permission":
{ Args: { "nama_permission": string }; Returns: boolean
                           },
"is_active_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_permissions":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           }
          }
          Enums: {
            "kondisi_aset": "baik"|"rusak","status_akun": "aktif"|"non_aktif","status_aset": "tersedia"|"dipinjam"|"dalam_perbaikan"|"hilang"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "kondisi_aset": ["baik", "rusak"],"status_akun": ["aktif", "non_aktif"],"status_aset": ["tersedia", "dipinjam", "dalam_perbaikan", "hilang"]
          }
        }
} as const
