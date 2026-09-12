export interface CollectionRepository<T> {
  load(fallback: T[]): T[]
  save(items: T[]): void
}
