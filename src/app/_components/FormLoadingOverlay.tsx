"use client";

import { useFormStatus } from "react-dom";
import { LoadingOverlay } from "@/app/_components/LoadingOverlay";

export function FormLoadingOverlay() {
  const { pending } = useFormStatus();
  return <LoadingOverlay show={pending} />;
}
