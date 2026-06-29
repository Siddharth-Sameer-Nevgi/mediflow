import { Suspense } from "react";
import LoginPageContent from "./LoginPageContent";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md animate-pulse" />}>
      <LoginPageContent />
    </Suspense>
  );
}
