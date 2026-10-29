export interface InvItem {
  name: string
  col: number
  // The rest of tileweb.cc's per-item fields, as the wire sends them (all
  // delta-encoded, so any may be absent until first sent). The map key is
  // the engine's item index, NOT the inventory letter: `letter` (a char
  // code) is. An emptied slot arrives as base_type 100 (OBJ_UNASSIGNED),
  // quantity 0, keeping its stale name.
  letter?: number
  base_type?: number
  sub_type?: number
  quantity?: number
  tile?: number | number[]
  action_verb?: string
}

export class InventoryStore {
  readonly items: Map<number, InvItem> = new Map()

  update(inv: Record<string, Partial<InvItem>> | undefined): void {
    if (!inv) return
    for (const [slot, patch] of Object.entries(inv)) {
      const idx = Number(slot)
      const existing = this.items.get(idx) ?? { name: '', col: 7 }
      this.items.set(idx, { ...existing, ...patch })
    }
  }

  get(index: number): InvItem | undefined {
    return this.items.get(index)
  }
}
