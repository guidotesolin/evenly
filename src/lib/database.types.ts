
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "fixed_concepts": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"emoji": string | null,"id": string,"is_shared": boolean,"name": string,"owner_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"emoji"?: string | null,"id"?: string,"is_shared"?: boolean,"name": string,"owner_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"emoji"?: string | null,"id"?: string,"is_shared"?: boolean,"name"?: string,"owner_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fixed_concepts_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"fixed_entries": {
                  Row: {
                    "amount": number | null,"concept_id": string,"created_at": string,"id": string,"month": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number | null,"concept_id": string,"created_at"?: string,"id"?: string,"month": string
                  }
                  Update: {
                    "amount"?: number | null,"concept_id"?: string,"created_at"?: string,"id"?: string,"month"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fixed_entries_concept_id_fkey"
      columns: ["concept_id"]
isOneToOne: false
      referencedRelation: "fixed_concepts"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "created_at": string,"household_id": string,"id": string,"joined_on": string,"left_on": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"id"?: string,"joined_on"?: string,"left_on"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"joined_on"?: string,"left_on"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "household_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"id": string,"invite_code": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invite_code": string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invite_code"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reference_rates": {
                  Row: {
                    "ars_per_usd": number,"created_at": string,"id": string,"month": string,"owner_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ars_per_usd": number,"created_at"?: string,"id"?: string,"month": string,"owner_id"?: string
                  }
                  Update: {
                    "ars_per_usd"?: number,"created_at"?: string,"id"?: string,"month"?: string,"owner_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reference_rates_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shared_movements": {
                  Row: {
                    "amount": number,"created_at": string,"description": string,"fixed_entry_id": string | null,"household_id": string,"id": string,"kind": string,"occurred_on": string,"paid_by": string,"paid_to": string | null,"my_share": number | null
                  }
                  ComputedFields: "my_share"
                  Insert: {
                    "amount": number,"created_at"?: string,"description": string,"fixed_entry_id"?: string | null,"household_id": string,"id"?: string,"kind": string,"occurred_on"?: string,"paid_by": string,"paid_to"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"description"?: string,"fixed_entry_id"?: string | null,"household_id"?: string,"id"?: string,"kind"?: string,"occurred_on"?: string,"paid_by"?: string,"paid_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shared_movements_fixed_entry_id_fkey"
      columns: ["fixed_entry_id"]
isOneToOne: true
      referencedRelation: "fixed_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shared_movements_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shared_movements_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shared_movements_paid_to_fkey"
      columns: ["paid_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "household_balances": {
                  Row: {
                    "balance": number | null,"household_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "household_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "create_household":
{ Args: { "household_name": string }; Returns: {
              "created_at": string,
"id": string,
"invite_code": string,
"name": string
            }
                          SetofOptions: {
        from: "*"
        to: "households"
        isOneToOne: true
        isSetofReturn: false
      } },
"household_participants":
{ Args: { "on_date": string,"target_household": string }; Returns: string[]
                           },
"is_active_member":
{ Args: { "target_household": string,"target_user": string }; Returns: boolean
                           },
"join_household":
{ Args: { "code": string }; Returns: {
              "created_at": string,
"id": string,
"invite_code": string,
"name": string
            }
                          SetofOptions: {
        from: "*"
        to: "households"
        isOneToOne: true
        isSetofReturn: false
      } },
"my_share":
{ Args: { "movement": Omit<Database["public"]['Tables']["shared_movements"]['Row'], Database["public"]['Tables']["shared_movements"]['ComputedFields']> }; Returns: number
                           },
"participant_count":
{ Args: { "on_date": string,"target_household": string }; Returns: number
                           }
          }
          Enums: {
            [_ in never]: never
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
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
