import mongoose from 'mongoose';

/**
 * A collection kept in memory for fast reads and written through to MongoDB when it is connected.
 * Without a MONGODB_URI (local preview) the records live in memory only, as the rest of the server does.
 * Nothing is written to the /data JSON files.
 */
export class Store<T extends { id: string }> {
  items: T[] = [];
  private loaded = false;
  constructor(private model: mongoose.Model<any>, private sortKey: string, private label = 'Store') {}
  async ready(): Promise<T[]> {
    if (this.loaded || mongoose.connection.readyState !== 1) return this.items;
    try {
      const docs = await this.model.find().sort({ [this.sortKey]: 1 }).lean();
      this.items = docs.map(({ _id, __v, ...rest }: any) => rest as T);
      this.loaded = true;
    } catch (err: any) {
      console.warn(`[${this.label}] load failed, using memory:`, err?.message);
    }
    return this.items;
  }
  async upsert(rec: T): Promise<void> {
    const idx = this.items.findIndex((x) => x.id === rec.id);
    if (idx === -1) this.items.push(rec);
    else this.items[idx] = rec;
    if (mongoose.connection.readyState === 1) {
      const { _id, ...clean } = rec as any;
      await this.model.updateOne({ id: rec.id }, { $set: clean }, { upsert: true });
    }
  }
  async remove(id: string): Promise<void> {
    if (mongoose.connection.readyState === 1) await this.model.deleteOne({ id });
    this.items = this.items.filter((x) => x.id !== id);
  }
  async upsertMany(recs: T[]): Promise<void> {
    for (const r of recs) {
      const idx = this.items.findIndex((x) => x.id === r.id);
      if (idx === -1) this.items.push(r);
      else this.items[idx] = r;
    }
    if (mongoose.connection.readyState === 1 && recs.length) {
      await this.model.bulkWrite(
        recs.map((r) => {
          const { _id, ...clean } = r as any;
          return { updateOne: { filter: { id: r.id }, update: { $set: clean }, upsert: true } };
        }),
        { ordered: false }
      );
    }
  }
}
