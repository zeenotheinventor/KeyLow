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
      accepted_suggestions: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          exercises: Json;
          id: string;
          local_date: string;
          params_version: string;
          reasons: Json;
          routine_day_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          exercises: Json;
          id?: string;
          local_date: string;
          params_version: string;
          reasons: Json;
          routine_day_id?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          exercises?: Json;
          id?: string;
          local_date?: string;
          params_version?: string;
          reasons?: Json;
          routine_day_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accepted_suggestions_routine_day_id_fkey";
            columns: ["routine_day_id"];
            isOneToOne: false;
            referencedRelation: "routine_days";
            referencedColumns: ["id"];
          },
        ];
      };
      body_measurements: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          external_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["body_measurement_kind"];
          local_date: string;
          measured_at: string;
          source: Database["public"]["Enums"]["weigh_in_source"];
          tz: string;
          user_id: string;
          value: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          external_id?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["body_measurement_kind"];
          local_date: string;
          measured_at: string;
          source: Database["public"]["Enums"]["weigh_in_source"];
          tz: string;
          user_id?: string;
          value: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          external_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["body_measurement_kind"];
          local_date?: string;
          measured_at?: string;
          source?: Database["public"]["Enums"]["weigh_in_source"];
          tz?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [];
      };
      day_logs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          is_complete: boolean;
          local_date: string;
          note: string | null;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          is_complete?: boolean;
          local_date: string;
          note?: string | null;
          user_id?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          is_complete?: boolean;
          local_date?: string;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      exercise_import_runs: {
        Row: {
          created_at: string;
          file_sha256: string;
          finished_at: string | null;
          id: string;
          label: string;
          row_count: number | null;
          source: Database["public"]["Enums"]["exercise_source"];
          source_commit: string;
          started_at: string;
        };
        Insert: {
          created_at?: string;
          file_sha256: string;
          finished_at?: string | null;
          id?: string;
          label: string;
          row_count?: number | null;
          source: Database["public"]["Enums"]["exercise_source"];
          source_commit: string;
          started_at?: string;
        };
        Update: {
          created_at?: string;
          file_sha256?: string;
          finished_at?: string | null;
          id?: string;
          label?: string;
          row_count?: number | null;
          source?: Database["public"]["Enums"]["exercise_source"];
          source_commit?: string;
          started_at?: string;
        };
        Relationships: [];
      };
      exercise_muscles: {
        Row: {
          created_at: string;
          exercise_id: string;
          id: string;
          muscle_id: string;
          owner_id: string | null;
          role: Database["public"]["Enums"]["muscle_role"];
          weight: number;
        };
        Insert: {
          created_at?: string;
          exercise_id: string;
          id?: string;
          muscle_id: string;
          owner_id?: string | null;
          role: Database["public"]["Enums"]["muscle_role"];
          weight: number;
        };
        Update: {
          created_at?: string;
          exercise_id?: string;
          id?: string;
          muscle_id?: string;
          owner_id?: string | null;
          role?: Database["public"]["Enums"]["muscle_role"];
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_muscles_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_muscles_muscle_id_fkey";
            columns: ["muscle_id"];
            isOneToOne: false;
            referencedRelation: "muscles";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_source_data: {
        Row: {
          created_at: string;
          exercise_id: string;
          import_run_id: string;
          raw: Json;
        };
        Insert: {
          created_at?: string;
          exercise_id: string;
          import_run_id: string;
          raw: Json;
        };
        Update: {
          created_at?: string;
          exercise_id?: string;
          import_run_id?: string;
          raw?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_source_data_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: true;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_source_data_import_run_id_fkey";
            columns: ["import_run_id"];
            isOneToOne: false;
            referencedRelation: "exercise_import_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      exercises: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          equipment: Database["public"]["Enums"]["equipment"];
          id: string;
          mechanic: Database["public"]["Enums"]["exercise_mechanic"];
          name: string;
          owner_id: string | null;
          source: Database["public"]["Enums"]["exercise_source"];
          source_ref: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          equipment: Database["public"]["Enums"]["equipment"];
          id?: string;
          mechanic: Database["public"]["Enums"]["exercise_mechanic"];
          name: string;
          owner_id?: string | null;
          source: Database["public"]["Enums"]["exercise_source"];
          source_ref?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          equipment?: Database["public"]["Enums"]["equipment"];
          id?: string;
          mechanic?: Database["public"]["Enums"]["exercise_mechanic"];
          name?: string;
          owner_id?: string | null;
          source?: Database["public"]["Enums"]["exercise_source"];
          source_ref?: string | null;
        };
        Relationships: [];
      };
      food_log_entries: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          food_id: string | null;
          id: string;
          item_type: Database["public"]["Enums"]["log_item_type"];
          kcal: number | null;
          local_date: string;
          logged_at: string;
          nutrients: Json;
          portion_id: string | null;
          quantity: number | null;
          recipe_id: string | null;
          resolved_grams: number | null;
          snapshot: Json;
          unit: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          food_id?: string | null;
          id?: string;
          item_type: Database["public"]["Enums"]["log_item_type"];
          kcal?: number | null;
          local_date: string;
          logged_at?: string;
          nutrients: Json;
          portion_id?: string | null;
          quantity?: number | null;
          recipe_id?: string | null;
          resolved_grams?: number | null;
          snapshot: Json;
          unit?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          food_id?: string | null;
          id?: string;
          item_type?: Database["public"]["Enums"]["log_item_type"];
          kcal?: number | null;
          local_date?: string;
          logged_at?: string;
          nutrients?: Json;
          portion_id?: string | null;
          quantity?: number | null;
          recipe_id?: string | null;
          resolved_grams?: number | null;
          snapshot?: Json;
          unit?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "food_log_entries_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: false;
            referencedRelation: "foods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "food_log_entries_portion_id_fkey";
            columns: ["portion_id"];
            isOneToOne: false;
            referencedRelation: "food_portions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "food_log_entries_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
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
      muscles: {
        Row: {
          created_at: string;
          group: Database["public"]["Enums"]["muscle_group"];
          id: string;
          position: number;
          size_class: Database["public"]["Enums"]["muscle_size_class"];
        };
        Insert: {
          created_at?: string;
          group: Database["public"]["Enums"]["muscle_group"];
          id: string;
          position: number;
          size_class: Database["public"]["Enums"]["muscle_size_class"];
        };
        Update: {
          created_at?: string;
          group?: Database["public"]["Enums"]["muscle_group"];
          id?: string;
          position?: number;
          size_class?: Database["public"]["Enums"]["muscle_size_class"];
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          activity: Database["public"]["Enums"]["activity_level"] | null;
          birth_date: string | null;
          checkin_weekday: number | null;
          created_at: string;
          energy_unit: string | null;
          height_cm: number | null;
          id: string;
          onboarding_completed_at: string | null;
          onboarding_weight_kg: number | null;
          sex: string | null;
          target_carbs_g: number | null;
          target_fat_g: number | null;
          target_kcal: number | null;
          target_protein_g: number | null;
          targets_updated_at: string | null;
          terms_accepted_at: string | null;
          terms_version: string | null;
          timezone: string;
          weight_unit: string | null;
        };
        Insert: {
          activity?: Database["public"]["Enums"]["activity_level"] | null;
          birth_date?: string | null;
          checkin_weekday?: number | null;
          created_at?: string;
          energy_unit?: string | null;
          height_cm?: number | null;
          id: string;
          onboarding_completed_at?: string | null;
          onboarding_weight_kg?: number | null;
          sex?: string | null;
          target_carbs_g?: number | null;
          target_fat_g?: number | null;
          target_kcal?: number | null;
          target_protein_g?: number | null;
          targets_updated_at?: string | null;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          timezone?: string;
          weight_unit?: string | null;
        };
        Update: {
          activity?: Database["public"]["Enums"]["activity_level"] | null;
          birth_date?: string | null;
          checkin_weekday?: number | null;
          created_at?: string;
          energy_unit?: string | null;
          height_cm?: number | null;
          id?: string;
          onboarding_completed_at?: string | null;
          onboarding_weight_kg?: number | null;
          sex?: string | null;
          target_carbs_g?: number | null;
          target_fat_g?: number | null;
          target_kcal?: number | null;
          target_protein_g?: number | null;
          targets_updated_at?: string | null;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          timezone?: string;
          weight_unit?: string | null;
        };
        Relationships: [];
      };
      programs: {
        Row: {
          created_at: string;
          dow_offsets_kcal: number[];
          ended_on: string | null;
          fat_fraction_of_remaining: number;
          goal: Database["public"]["Enums"]["goal_type"];
          goal_weight_kg: number | null;
          id: string;
          next_checkin_date: string | null;
          protein_g_per_kg: number;
          rate_pct_per_week: number;
          split_preset: string;
          started_on: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          dow_offsets_kcal?: number[];
          ended_on?: string | null;
          fat_fraction_of_remaining: number;
          goal: Database["public"]["Enums"]["goal_type"];
          goal_weight_kg?: number | null;
          id?: string;
          next_checkin_date?: string | null;
          protein_g_per_kg: number;
          rate_pct_per_week: number;
          split_preset: string;
          started_on: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          dow_offsets_kcal?: number[];
          ended_on?: string | null;
          fat_fraction_of_remaining?: number;
          goal?: Database["public"]["Enums"]["goal_type"];
          goal_weight_kg?: number | null;
          id?: string;
          next_checkin_date?: string | null;
          protein_g_per_kg?: number;
          rate_pct_per_week?: number;
          split_preset?: string;
          started_on?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          bucket: string;
          hits: number;
          window_start: string;
        };
        Insert: {
          bucket: string;
          hits?: number;
          window_start: string;
        };
        Update: {
          bucket?: string;
          hits?: number;
          window_start?: string;
        };
        Relationships: [];
      };
      recipe_ingredients: {
        Row: {
          created_at: string;
          food_id: string;
          id: string;
          owner_id: string;
          portion_id: string | null;
          position: number;
          quantity: number;
          recipe_id: string;
          resolved_grams: number;
          snapshot: Json;
          unit: string;
        };
        Insert: {
          created_at?: string;
          food_id: string;
          id?: string;
          owner_id?: string;
          portion_id?: string | null;
          position: number;
          quantity: number;
          recipe_id: string;
          resolved_grams: number;
          snapshot: Json;
          unit: string;
        };
        Update: {
          created_at?: string;
          food_id?: string;
          id?: string;
          owner_id?: string;
          portion_id?: string | null;
          position?: number;
          quantity?: number;
          recipe_id?: string;
          resolved_grams?: number;
          snapshot?: Json;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: false;
            referencedRelation: "foods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_portion_id_fkey";
            columns: ["portion_id"];
            isOneToOne: false;
            referencedRelation: "food_portions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          computed: Json;
          created_at: string;
          id: string;
          instructions: string[];
          is_archived: boolean;
          name: string;
          owner_id: string;
          servings: number;
          yield_grams: number | null;
        };
        Insert: {
          computed: Json;
          created_at?: string;
          id?: string;
          instructions?: string[];
          is_archived?: boolean;
          name: string;
          owner_id?: string;
          servings: number;
          yield_grams?: number | null;
        };
        Update: {
          computed?: Json;
          created_at?: string;
          id?: string;
          instructions?: string[];
          is_archived?: boolean;
          name?: string;
          owner_id?: string;
          servings?: number;
          yield_grams?: number | null;
        };
        Relationships: [];
      };
      routine_days: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          position: number;
          routine_id: string;
          user_id: string;
          weekday: number | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          position: number;
          routine_id: string;
          user_id?: string;
          weekday?: number | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          position?: number;
          routine_id?: string;
          user_id?: string;
          weekday?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "routine_days_routine_id_fkey";
            columns: ["routine_id"];
            isOneToOne: false;
            referencedRelation: "routines";
            referencedColumns: ["id"];
          },
        ];
      };
      routine_exercises: {
        Row: {
          created_at: string;
          exercise_id: string;
          id: string;
          position: number;
          rep_max: number;
          rep_min: number;
          routine_day_id: string;
          target_rir: number | null;
          target_sets: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          exercise_id: string;
          id?: string;
          position: number;
          rep_max: number;
          rep_min: number;
          routine_day_id: string;
          target_rir?: number | null;
          target_sets: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          exercise_id?: string;
          id?: string;
          position?: number;
          rep_max?: number;
          rep_min?: number;
          routine_day_id?: string;
          target_rir?: number | null;
          target_sets?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "routine_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "routine_exercises_routine_day_id_fkey";
            columns: ["routine_day_id"];
            isOneToOne: false;
            referencedRelation: "routine_days";
            referencedColumns: ["id"];
          },
        ];
      };
      routines: {
        Row: {
          activated_at: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          is_archived: boolean;
          name: string;
          user_id: string;
        };
        Insert: {
          activated_at?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_archived?: boolean;
          name: string;
          user_id?: string;
        };
        Update: {
          activated_at?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_archived?: boolean;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      training_goals: {
        Row: {
          created_at: string;
          days_per_week: number;
          effective_from: string;
          effective_to: string | null;
          equipment: Database["public"]["Enums"]["equipment"][];
          experience: Database["public"]["Enums"]["experience_level"];
          focus: string[];
          goal: Database["public"]["Enums"]["training_goal"];
          id: string;
          muscle_priority: Json;
          params_version: string;
          session_minutes: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          days_per_week: number;
          effective_from?: string;
          effective_to?: string | null;
          equipment?: Database["public"]["Enums"]["equipment"][];
          experience: Database["public"]["Enums"]["experience_level"];
          focus?: string[];
          goal: Database["public"]["Enums"]["training_goal"];
          id?: string;
          muscle_priority: Json;
          params_version: string;
          session_minutes: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          days_per_week?: number;
          effective_from?: string;
          effective_to?: string | null;
          equipment?: Database["public"]["Enums"]["equipment"][];
          experience?: Database["public"]["Enums"]["experience_level"];
          focus?: string[];
          goal?: Database["public"]["Enums"]["training_goal"];
          id?: string;
          muscle_priority?: Json;
          params_version?: string;
          session_minutes?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      weigh_ins: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          external_id: string | null;
          id: string;
          local_date: string;
          measured_at: string;
          note: string | null;
          source: Database["public"]["Enums"]["weigh_in_source"];
          tz: string;
          user_id: string;
          weight_kg: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          external_id?: string | null;
          id?: string;
          local_date: string;
          measured_at: string;
          note?: string | null;
          source: Database["public"]["Enums"]["weigh_in_source"];
          tz: string;
          user_id?: string;
          weight_kg: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          external_id?: string | null;
          id?: string;
          local_date?: string;
          measured_at?: string;
          note?: string | null;
          source?: Database["public"]["Enums"]["weigh_in_source"];
          tz?: string;
          user_id?: string;
          weight_kg?: number;
        };
        Relationships: [];
      };
      workout_sessions: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          ended_at: string | null;
          id: string;
          local_date: string;
          note: string | null;
          routine_day_id: string | null;
          started_at: string;
          tz: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          ended_at?: string | null;
          id?: string;
          local_date: string;
          note?: string | null;
          routine_day_id?: string | null;
          started_at: string;
          tz: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          ended_at?: string | null;
          id?: string;
          local_date?: string;
          note?: string | null;
          routine_day_id?: string | null;
          started_at?: string;
          tz?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_sessions_routine_day_id_fkey";
            columns: ["routine_day_id"];
            isOneToOne: false;
            referencedRelation: "routine_days";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_sets: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          exercise_id: string;
          id: string;
          load_kg: number | null;
          performed_at: string;
          position: number;
          reps: number;
          rir: number | null;
          rpe: number | null;
          session_id: string;
          set_type: Database["public"]["Enums"]["set_type"];
          snapshot: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          exercise_id: string;
          id?: string;
          load_kg?: number | null;
          performed_at?: string;
          position: number;
          reps: number;
          rir?: number | null;
          rpe?: number | null;
          session_id: string;
          set_type?: Database["public"]["Enums"]["set_type"];
          snapshot: Json;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          exercise_id?: string;
          id?: string;
          load_kg?: number | null;
          performed_at?: string;
          position?: number;
          reps?: number;
          rir?: number | null;
          rpe?: number | null;
          session_id?: string;
          set_type?: Database["public"]["Enums"]["set_type"];
          snapshot?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sets_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      day_totals: {
        Row: {
          carbs_g: number | null;
          entry_count: number | null;
          fat_g: number | null;
          fibre_g: number | null;
          kcal: number | null;
          local_date: string | null;
          protein_g: number | null;
          salt_g: number | null;
          sat_fat_g: number | null;
          sugars_g: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_terms: { Args: { p_version: string }; Returns: undefined };
      consume_rate_limit: {
        Args: { p_bucket: string; p_max: number; p_window_seconds: number };
        Returns: {
          allowed: boolean;
          retry_after_seconds: number;
        }[];
      };
      delete_workout_session: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      import_exercises: {
        Args: { p_exercises: Json; p_import_run_id: string };
        Returns: Json;
      };
      recipe_instructions_are_valid: {
        Args: { steps: string[] };
        Returns: boolean;
      };
      save_exercise: {
        Args: { p_exercise: Json; p_exercise_id: string; p_muscles: Json };
        Returns: string;
      };
      save_recipe: {
        Args: { p_ingredients: Json; p_recipe: Json; p_recipe_id: string };
        Returns: string;
      };
      save_routine: {
        Args: { p_days: Json; p_routine: Json; p_routine_id: string };
        Returns: string;
      };
      save_training_goals: { Args: { p_goals: Json }; Returns: string };
      search_food_candidate_ids: {
        Args: { search_phrase: string; search_tsquery: unknown };
        Returns: string[];
      };
      search_foods: {
        Args: { lim?: number; q: string };
        Returns: {
          basis: Database["public"]["Enums"]["nutrient_basis"];
          brand: string;
          carbs_g: number;
          default_portion_grams: number;
          default_portion_id: string;
          default_portion_label: string;
          default_portion_ml: number;
          fat_g: number;
          fibre_g: number;
          id: string;
          kcal: number;
          name: string;
          protein_g: number;
          quality: Json;
          score: number;
          source: Database["public"]["Enums"]["food_source"];
        }[];
      };
      set_active_routine: { Args: { p_routine_id: string }; Returns: undefined };
      store_off_product: {
        Args: { p_food: Json; p_portions: Json; p_raw: Json };
        Returns: Json;
      };
      training_focus_is_valid: { Args: { focus: string[] }; Returns: boolean };
    };
    Enums: {
      activity_level: "sedentary" | "light" | "moderate" | "very" | "extra";
      body_measurement_kind: "body_fat_pct" | "lean_mass_kg";
      equipment:
        | "barbell"
        | "dumbbell"
        | "kettlebell"
        | "cable"
        | "machine"
        | "smith_machine"
        | "ez_bar"
        | "band"
        | "bodyweight"
        | "other";
      exercise_mechanic: "compound" | "isolation";
      exercise_source: "free_exercise_db" | "user";
      experience_level: "beginner" | "intermediate" | "advanced";
      food_source: "off" | "cofid" | "user";
      goal_type: "lose" | "maintain" | "gain";
      log_item_type: "food" | "recipe" | "quick";
      muscle_group: "chest" | "shoulders" | "back" | "arms" | "core" | "legs" | "neck";
      muscle_role: "primary" | "secondary" | "stabiliser";
      muscle_size_class: "small" | "medium" | "large";
      nutrient_basis: "per_100g" | "per_100ml";
      set_type: "warmup" | "working" | "drop" | "failure";
      training_goal: "aesthetic" | "strength" | "hybrid";
      weigh_in_source: "manual" | "healthkit" | "health_connect" | "import";
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
      activity_level: ["sedentary", "light", "moderate", "very", "extra"],
      body_measurement_kind: ["body_fat_pct", "lean_mass_kg"],
      equipment: [
        "barbell",
        "dumbbell",
        "kettlebell",
        "cable",
        "machine",
        "smith_machine",
        "ez_bar",
        "band",
        "bodyweight",
        "other",
      ],
      exercise_mechanic: ["compound", "isolation"],
      exercise_source: ["free_exercise_db", "user"],
      experience_level: ["beginner", "intermediate", "advanced"],
      food_source: ["off", "cofid", "user"],
      goal_type: ["lose", "maintain", "gain"],
      log_item_type: ["food", "recipe", "quick"],
      muscle_group: ["chest", "shoulders", "back", "arms", "core", "legs", "neck"],
      muscle_role: ["primary", "secondary", "stabiliser"],
      muscle_size_class: ["small", "medium", "large"],
      nutrient_basis: ["per_100g", "per_100ml"],
      set_type: ["warmup", "working", "drop", "failure"],
      training_goal: ["aesthetic", "strength", "hybrid"],
      weigh_in_source: ["manual", "healthkit", "health_connect", "import"],
    },
  },
} as const;
