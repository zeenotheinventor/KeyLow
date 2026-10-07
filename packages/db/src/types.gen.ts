export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      food_portions: {
        Row: {
          created_at: string;
          food_id: string;
          grams: number | null;
          id: string;
          is_default: boolean;
          label: string;
          ml: number | null;
          owner_id: string | null;
          position: number;
        };
        Insert: {
          created_at?: string;
          food_id: string;
          grams?: number | null;
          id?: string;
          is_default?: boolean;
          label: string;
          ml?: number | null;
          owner_id?: string | null;
          position?: number;
        };
        Update: {
          created_at?: string;
          food_id?: string;
          grams?: number | null;
          id?: string;
          is_default?: boolean;
          label?: string;
          ml?: number | null;
          owner_id?: string | null;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "food_portions_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: false;
            referencedRelation: "foods";
            referencedColumns: ["id"];
          },
        ];
      };
      food_source_data: {
        Row: {
          created_at: string;
          food_id: string;
          import_run_id: string | null;
          raw: Json;
        };
        Insert: {
          created_at?: string;
          food_id: string;
          import_run_id?: string | null;
          raw: Json;
        };
        Update: {
          created_at?: string;
          food_id?: string;
          import_run_id?: string | null;
          raw?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "food_source_data_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: true;
            referencedRelation: "foods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "food_source_data_import_run_id_fkey";
            columns: ["import_run_id"];
            isOneToOne: false;
            referencedRelation: "import_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      foods: {
        Row: {
          barcode: string | null;
          basis: Database["public"]["Enums"]["nutrient_basis"];
          brand: string | null;
          carbs_g: number | null;
          created_at: string;
          deleted_at: string | null;
          density_g_per_ml: number | null;
          fat_g: number | null;
          fetched_at: string | null;
          fibre_g: number | null;
          food_group: string | null;
          id: string;
          kcal: number | null;
          micros: Json;
          name: string;
          owner_id: string | null;
          protein_g: number | null;
          quality: Json;
          salt_g: number | null;
          sat_fat_g: number | null;
          search: unknown;
          source: Database["public"]["Enums"]["food_source"];
          source_ref: string | null;
          sugars_g: number | null;
        };
        Insert: {
          barcode?: string | null;
          basis: Database["public"]["Enums"]["nutrient_basis"];
          brand?: string | null;
          carbs_g?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          density_g_per_ml?: number | null;
          fat_g?: number | null;
          fetched_at?: string | null;
          fibre_g?: number | null;
          food_group?: string | null;
          id?: string;
          kcal?: number | null;
          micros?: Json;
          name: string;
          owner_id?: string | null;
          protein_g?: number | null;
          quality?: Json;
          salt_g?: number | null;
          sat_fat_g?: number | null;
          search?: unknown;
          source: Database["public"]["Enums"]["food_source"];
          source_ref?: string | null;
          sugars_g?: number | null;
        };
        Update: {
          barcode?: string | null;
          basis?: Database["public"]["Enums"]["nutrient_basis"];
          brand?: string | null;
          carbs_g?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          density_g_per_ml?: number | null;
          fat_g?: number | null;
          fetched_at?: string | null;
          fibre_g?: number | null;
          food_group?: string | null;
          id?: string;
          kcal?: number | null;
          micros?: Json;
          name?: string;
          owner_id?: string | null;
          protein_g?: number | null;
          quality?: Json;
          salt_g?: number | null;
          sat_fat_g?: number | null;
          search?: unknown;
          source?: Database["public"]["Enums"]["food_source"];
          source_ref?: string | null;
          sugars_g?: number | null;
        };
        Relationships: [];
      };
      import_runs: {
        Row: {
          created_at: string;
          file_sha256: string | null;
          finished_at: string | null;
          id: string;
          label: string;
          row_count: number | null;
          source: Database["public"]["Enums"]["food_source"];
          started_at: string;
        };
        Insert: {
          created_at?: string;
          file_sha256?: string | null;
          finished_at?: string | null;
          id?: string;
          label: string;
          row_count?: number | null;
          source: Database["public"]["Enums"]["food_source"];
          started_at?: string;
        };
        Update: {
          created_at?: string;
          file_sha256?: string | null;
          finished_at?: string | null;
          id?: string;
          label?: string;
          row_count?: number | null;
          source?: Database["public"]["Enums"]["food_source"];
          started_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          activity: string | null;
          birth_date: string | null;
          checkin_weekday: number | null;
          created_at: string;
          energy_unit: string | null;
          height_cm: number | null;
          id: string;
          onboarding_completed_at: string | null;
          onboarding_weight_kg: number | null;
          sex: string | null;
          timezone: string;
          weight_unit: string | null;
        };
        Insert: {
          activity?: string | null;
          birth_date?: string | null;
          checkin_weekday?: number | null;
          created_at?: string;
          energy_unit?: string | null;
          height_cm?: number | null;
          id: string;
          onboarding_completed_at?: string | null;
          onboarding_weight_kg?: number | null;
          sex?: string | null;
          timezone?: string;
          weight_unit?: string | null;
        };
        Update: {
          activity?: string | null;
          birth_date?: string | null;
          checkin_weekday?: number | null;
          created_at?: string;
          energy_unit?: string | null;
          height_cm?: number | null;
          id?: string;
          onboarding_completed_at?: string | null;
          onboarding_weight_kg?: number | null;
          sex?: string | null;
          timezone?: string;
          weight_unit?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      food_source: "off" | "cofid" | "user";
      nutrient_basis: "per_100g" | "per_100ml";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      food_source: ["off", "cofid", "user"],
      nutrient_basis: ["per_100g", "per_100ml"],
    },
  },
} as const;
