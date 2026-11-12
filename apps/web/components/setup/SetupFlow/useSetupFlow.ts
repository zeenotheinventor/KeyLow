"use client";

import { useContext } from "react";

import { SetupFlowContext } from "./setupFlowContext";

import type { SetupFlowValue } from "./types";

export function useSetupFlow(): SetupFlowValue {
  const value = useContext(SetupFlowContext);
  if (value === undefined) {
    throw new Error("useSetupFlow must be used inside SetupFlow");
  }
  return value;
}
