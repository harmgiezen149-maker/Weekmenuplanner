import { Suspense } from "react";
import Deelkeuze from "@/components/Deelkeuze";

export const metadata = { title: "Gedeeld · Kookboek" };

export default function Page() {
  return (
    <Suspense>
      <Deelkeuze />
    </Suspense>
  );
}
