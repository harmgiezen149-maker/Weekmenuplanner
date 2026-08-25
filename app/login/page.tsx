import { Suspense } from "react";
import Login from "@/components/Login";

export const metadata = { title: "Inloggen · Kookboek" };

export default function Page() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
