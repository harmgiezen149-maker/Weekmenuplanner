import { Suspense } from "react";
import KookboekApp from "@/components/KookboekApp";

export default function Page() {
  // Suspense omdat het scherm de deel-parameters uit de adresbalk leest; zonder
  // deze grens weigert Next de pagina vooruit te renderen.
  return (
    <Suspense>
      <KookboekApp />
    </Suspense>
  );
}
