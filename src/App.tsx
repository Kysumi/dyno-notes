import { AppHeader } from "@/components/app-header.tsx";
import { AppSidebar } from "@/components/app-sidebar.tsx";
import { NoteEditor } from "@/components/note-editor.tsx";
import { NotesProvider } from "@/components/notes-provider.tsx";
import { PageContext } from "@/components/page-context.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";

function App() {
  return (
    <TooltipProvider>
      <NotesProvider>
        <div className="grid h-screen grid-cols-1 grid-rows-[3.25rem_minmax(0,1fr)] overflow-hidden bg-stone-50 text-stone-900 md:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_16rem]">
          <AppHeader />
          <AppSidebar />
          <NoteEditor />
          <PageContext />
        </div>
      </NotesProvider>
    </TooltipProvider>
  );
}

export default App;
