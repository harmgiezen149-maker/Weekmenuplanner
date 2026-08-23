import { Suspense } from "react";
import TrackerApp from "@/components/tracker/TrackerApp";

export const metadata = { title: "Instellingen · Tracker" };

export default function Page() {
  return (
    <Suspense>
      <TrackerApp pagina="instellingen" />
    </Suspense>
  );
}
