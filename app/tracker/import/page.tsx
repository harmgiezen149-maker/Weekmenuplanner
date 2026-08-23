import { Suspense } from "react";
import TrackerApp from "@/components/tracker/TrackerApp";

export const metadata = { title: "Importeren · Tracker" };

export default function Page() {
  return (
    <Suspense>
      <TrackerApp pagina="import" />
    </Suspense>
  );
}
