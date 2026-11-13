"use client";

import { KeyLowProvider } from "@keylow/api-client";
import { useState, type ReactNode } from "react";

import { DeviceTimeZoneSync } from "../DeviceTimeZoneSync";

import { ToastProvider } from "@/components/ui/Toast";
import { FoodLogActionsProvider } from "@/lib/foodLogActions";
import { createClient } from "@/lib/supabase/client";
import { getFunctionsUrl } from "@/lib/supabase/env";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createClient);
  const [functionsUrl] = useState(getFunctionsUrl);

  return (
    <KeyLowProvider client={client} functionsUrl={functionsUrl}>
      <DeviceTimeZoneSync />
      <ToastProvider>
        <FoodLogActionsProvider>{children}</FoodLogActionsProvider>
      </ToastProvider>
    </KeyLowProvider>
  );
}
