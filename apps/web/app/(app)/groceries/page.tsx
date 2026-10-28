import { Suspense } from "react";
import GrocerySkeleton from "@/components/skeleton/grocery-skeleton";

import { GroceriesPage as GroceriesPageContent } from "./components/groceries-page";
import { GroceriesContextProvider } from "./context";
import { StoresContextProvider } from "./stores-context";

export default function GroceriesPage() {
  return (
    <StoresContextProvider>
      <GroceriesContextProvider>
        <Suspense fallback={<GrocerySkeleton />}>
          <GroceriesPageContent />
        </Suspense>
      </GroceriesContextProvider>
    </StoresContextProvider>
  );
}
