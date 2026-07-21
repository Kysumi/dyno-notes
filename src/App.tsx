import { AppHeader } from "@/components/app-header.tsx";
import { AppSidebar } from "@/components/app-sidebar.tsx";
import { JournalPage } from "@/components/journal-page.tsx";
import { PageContext } from "@/components/page-context.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";

function App() {
  return (
    <TooltipProvider>
      <div className="grid h-screen grid-cols-1 grid-rows-[3.25rem_minmax(0,1fr)] overflow-hidden bg-stone-50 text-stone-900 md:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_16rem]">
        <AppHeader />
        <AppSidebar />
        <JournalPage />
        <PageContext />
      </div>
    </TooltipProvider>
  );
}

export default App;
