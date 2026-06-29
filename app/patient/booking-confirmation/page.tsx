import { Suspense } from "react";
import BookingConfirmationContent from "./BookingConfirmationContent";

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <BookingConfirmationContent />
    </Suspense>
  );
}
