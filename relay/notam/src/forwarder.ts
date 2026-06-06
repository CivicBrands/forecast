import type { CanonicalNotam } from "./parse";

export interface ForwarderOptions {
  url: string;
  token: string;
  maxRecords: number;
  maxAgeMs: number;
  /** Called after every flush attempt (success or failure). */
  onFlush?: (count: number, ok: boolean, error?: string) => void;
}

/**
 * Buffers canonical NOTAM records and flushes them as a batched POST to the
 * Worker. Flush triggers: buffer hits `maxRecords` or `maxAgeMs` has elapsed
 * since the first record landed in the current batch.
 */
export class Forwarder {
  private buffer: CanonicalNotam[] = [];
  private firstEnqueuedAt = 0;
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(private readonly opts: ForwarderOptions) {}

  enqueue(record: CanonicalNotam): void {
    if (this.buffer.length === 0) this.firstEnqueuedAt = Date.now();
    this.buffer.push(record);
    if (this.buffer.length >= this.opts.maxRecords) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), this.opts.maxAgeMs);
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length === 0) return;
    this.flushing = true;

    const batch = this.buffer;
    this.buffer = [];
    this.firstEnqueuedAt = 0;

    try {
      const res = await fetch(this.opts.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.opts.token}`,
        },
        body: JSON.stringify({ records: batch }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        this.opts.onFlush?.(batch.length, false, `${res.status} ${body}`);
      } else {
        this.opts.onFlush?.(batch.length, true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.opts.onFlush?.(batch.length, false, msg);
    } finally {
      this.flushing = false;
    }
  }

  async drain(): Promise<void> {
    await this.flush();
  }
}
