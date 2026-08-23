import { Suspense } from "react";
import TrackerApp from "@/components/tracker/TrackerApp";

export const metadata = { title: "Week · Tracker" };

export default function Page() {
  return (
    <Suspense>
      <TrackerApp pagina="week" />
    </Suspense>
  );
}
