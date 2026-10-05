// KEY-20 generates the real type at packages/db/src/types.gen.ts and the first consumer that needs it swaps this import.
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
