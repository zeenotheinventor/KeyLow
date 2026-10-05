"use client";

import { KeyLowProvider } from "@keylow/api-client";
import { useState, type ReactNode } from "react";

import { createClient } from "@/lib/supabase/client";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createClient);

  return <KeyLowProvider client={client}>{children}</KeyLowProvider>;
}
