"use client";

import { KeyLowProvider } from "@keylow/api-client";
import { useState, type ReactNode } from "react";

import { ToastProvider } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createClient);

  return (
    <KeyLowProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </KeyLowProvider>
  );
}
