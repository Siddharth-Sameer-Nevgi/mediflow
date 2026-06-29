import { Suspense } from "react";
import RegisterPageContent from "./RegisterPageContent";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md animate-pulse" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
