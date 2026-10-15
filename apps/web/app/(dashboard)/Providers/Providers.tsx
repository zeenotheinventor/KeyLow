"use client";

import { KeyLowProvider } from "@keylow/api-client";
import { useState, type ReactNode } from "react";

import { DeviceTimeZoneSync } from "../DeviceTimeZoneSync";

import { ToastProvider } from "@/components/ui/Toast";
import { FoodLogActionsProvider } from "@/lib/foodLogActions";
import { createClient } from "@/lib/supabase/client";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createClient);

  return (
    <KeyLowProvider client={client}>
      <DeviceTimeZoneSync />
      <ToastProvider>
        <FoodLogActionsProvider>{children}</FoodLogActionsProvider>
      </ToastProvider>
    </KeyLowProvider>
  );
}
