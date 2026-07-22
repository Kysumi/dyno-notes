export type SaveStatus =
  | "saved"
  | "saving"
  | "unsaved"
  | "conflict"
  | "error";

export interface SaveSnapshot {
  id: string;
  source: string;
}

interface SaveResult {
  revision: string;
  updatedAt: string;
}

interface SaveCoordinatorOptions {
  snapshot: () => SaveSnapshot;
  save: (
    input: SaveSnapshot & { expectedRevision: string },
  ) => Promise<SaveResult>;
  status: (status: SaveStatus) => void;
  saved: (result: SaveResult, snapshot: SaveSnapshot) => void;
  failed: (error: unknown, snapshot: SaveSnapshot) => void | Promise<void>;
}

export class SaveCoordinator {
  readonly #options: SaveCoordinatorOptions;
  #revision = "";
  #version = 0;
  #dirty = false;
  #blocked = false;
  #active: Promise<boolean> | null = null;

  constructor(options: SaveCoordinatorOptions) {
    this.#options = options;
  }

  get dirty(): boolean {
    return this.#dirty;
  }

  reset(revision: string): void {
    this.#revision = revision;
    this.#version = 0;
    this.#dirty = false;
    this.#blocked = false;
    this.#options.status("saved");
  }

  changed(): void {
    this.#version++;
    this.#dirty = true;
    if (!this.#blocked) this.#options.status("unsaved");
  }

  block(): void {
    this.#blocked = true;
    this.#dirty = true;
    this.#options.status("conflict");
  }

  retryAgainst(revision: string): Promise<boolean> {
    this.#revision = revision;
    this.#blocked = false;
    this.#dirty = true;
    this.#options.status("unsaved");
    return this.flush();
  }

  async flush(): Promise<boolean> {
    if (this.#blocked) return false;
    if (this.#active) {
      await this.#active;
      return this.#dirty ? await this.flush() : true;
    }
    if (!this.#dirty) return true;

    this.#active = this.#saveOnce();
    const success = await this.#active;
    this.#active = null;
    if (!success) return false;
    return this.#dirty ? await this.flush() : true;
  }

  async #saveOnce(): Promise<boolean> {
    const version = this.#version;
    const snapshot = this.#options.snapshot();
    this.#options.status("saving");
    try {
      const result = await this.#options.save({
        ...snapshot,
        expectedRevision: this.#revision,
      });
      this.#revision = result.revision;
      this.#options.saved(result, snapshot);
      if (version === this.#version) {
        this.#dirty = false;
        this.#options.status("saved");
      } else {
        this.#options.status("unsaved");
      }
      return true;
    } catch (error) {
      if ((error as { name?: unknown })?.name === "Conflict") {
        this.#blocked = true;
        this.#options.status("conflict");
      } else {
        this.#options.status("error");
      }
      await this.#options.failed(error, snapshot);
      return false;
    }
  }
}
