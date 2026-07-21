import {
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronRight,
  Circle,
  Command,
  FileText,
  Hash,
  Inbox,
  Link,
  Menu,
  MoreHorizontal,
  Network,
  PanelRight,
  Plus,
  Search,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button.tsx";

const today = new Intl.DateTimeFormat("en-NZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

function App() {
  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Toggle sidebar">
            <Menu />
          </Button>
          <div className="brand-mark">D</div>
          <span className="font-semibold tracking-tight">Dyno Notes</span>
        </div>

        <label className="command-search">
          <Search aria-hidden="true" />
          <input
            placeholder="Search notes or run a command…"
            aria-label="Search notes"
          />
          <span>
            <Command /> K
          </span>
        </label>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Open right sidebar">
            <PanelRight />
          </Button>
          <Button variant="ghost" size="icon" aria-label="More options">
            <MoreHorizontal />
          </Button>
        </div>
      </header>

      <aside className="left-sidebar">
        <div className="sidebar-section">
          <Button className="w-full justify-start shadow-none" size="sm">
            <Plus /> New page
          </Button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <a className="active" href="#journal">
            <Calendar /> Journal
          </a>
          <a href="#pages">
            <FileText /> All pages
          </a>
          <a href="#tasks">
            <CheckSquare /> Tasks <span className="nav-count">3</span>
          </a>
          <a href="#inbox">
            <Inbox /> Inbox <span className="nav-count">5</span>
          </a>
          <a href="#graph">
            <Network /> Graph
          </a>
        </nav>

        <div className="sidebar-heading">
          <span>Favorites</span>
          <Plus aria-label="Add favorite" />
        </div>
        <nav className="sidebar-nav compact" aria-label="Favorite pages">
          <a href="#field-notes">
            <Hash /> Field notes
          </a>
          <a href="#reading">
            <Hash /> Reading list
          </a>
        </nav>

        <div className="sidebar-heading">
          <span>Recent</span>
        </div>
        <nav className="recent-pages" aria-label="Recent pages">
          <a href="#project-orbit">
            <span>Project Orbit</span>
            <small>8m</small>
          </a>
          <a href="#books">
            <span>Books to revisit</span>
            <small>1h</small>
          </a>
          <a href="#weekly">
            <span>Weekly review</span>
            <small>Mon</small>
          </a>
        </nav>

        <div className="sidebar-footer">
          <Button variant="ghost" className="w-full justify-start">
            <Settings /> Settings
          </Button>
        </div>
      </aside>

      <main className="workspace" id="journal">
        <div className="document-header">
          <div className="eyebrow">
            <Calendar /> Journal
          </div>
          <h1>{today}</h1>
          <p>A quiet place to think, link, and get things done.</p>
        </div>

        <article
          className="editor"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Journal editor"
          aria-multiline="true"
        >
          <section>
            <h2>
              <span>TODO</span> Focus
            </h2>
            <div className="outline-row">
              <Circle className="bullet" />
              <div>
                Draft the opening note for{" "}
                <a href="#project-orbit">[[Project Orbit]]</a>
                <p className="meta">SCHEDULED: &lt;today 09:30&gt;</p>
              </div>
            </div>
            <label className="task-row">
              <input type="checkbox" />
              <span>Review yesterday’s loose ends</span>
              <em>#daily</em>
            </label>
            <label className="task-row">
              <input type="checkbox" defaultChecked />
              <span>Clear the capture inbox</span>
            </label>
          </section>

          <section>
            <h2>
              <span>NOTE</span> Morning thoughts
            </h2>
            <div className="outline-row">
              <Circle className="bullet" />
              <div>
                Good tools should feel like a workbench: everything close at
                hand, nothing asking for attention until it is needed.
              </div>
            </div>
            <div className="outline-row nested">
              <Circle className="bullet" />
              <div>
                Keep capture friction low; structure can emerge through links.
              </div>
            </div>
            <div className="outline-row nested">
              <Circle className="bullet" />
              <div>
                Prefer plain text concepts: headings, tasks, tags, and
                references.
              </div>
            </div>
          </section>

          <section>
            <h2>
              <span>NEXT</span> On the desk
            </h2>
            <div className="reference-card" contentEditable={false}>
              <BookOpen />
              <div>
                <strong>Designing Data-Intensive Applications</strong>
                <p>Resume chapter 10 · 42% complete</p>
              </div>
              <ChevronRight />
            </div>
          </section>

          <div className="new-block">
            <Plus /> Type “/” for commands
          </div>
        </article>
      </main>

      <aside className="right-sidebar">
        <section>
          <div className="panel-title">
            <span>Outline</span>
            <MoreHorizontal />
          </div>
          <nav className="outline-nav" aria-label="Page outline">
            <a href="#focus">
              <ChevronRight /> Focus <span>3</span>
            </a>
            <a href="#thoughts">
              <ChevronRight /> Morning thoughts <span>3</span>
            </a>
            <a href="#desk">
              <ChevronRight /> On the desk <span>1</span>
            </a>
          </nav>
        </section>

        <section>
          <div className="panel-title">
            <span>Linked references</span>
            <span className="badge">2</span>
          </div>
          <a className="backlink" href="#weekly">
            <div>
              <FileText /> Weekly review
            </div>
            <p>
              “…return to today’s journal and choose the one thing that
              matters.”
            </p>
          </a>
          <a className="backlink" href="#project-orbit">
            <div>
              <Link /> Project Orbit
            </div>
            <p>“Daily notes are where rough project ideas begin.”</p>
          </a>
        </section>

        <section className="page-info">
          <div className="panel-title">
            <span>Page</span>
          </div>
          <dl>
            <div>
              <dt>Created</dt>
              <dd>Today</dd>
            </div>
            <div>
              <dt>Words</dt>
              <dd>86</dd>
            </div>
            <div>
              <dt>Links</dt>
              <dd>3</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}

export default App;
