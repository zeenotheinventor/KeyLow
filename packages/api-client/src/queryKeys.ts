export const keys = {
  profiles: {
    all: ["profiles"] as const,
    detail: (id: string) => ["profiles", id] as const,
  },
  foods: {
    all: ["foods"] as const,
    detail: (id: string) => ["foods", id] as const,
    portions: (id: string) => ["foods", id, "portions"] as const,
    search: (q: string) => ["foods", "search", q] as const,
    offSearch: (q: string) => ["foods", "off-search", q] as const,
    barcode: (code: string) => ["foods", "barcode", code] as const,
    own: ["foods", "own"] as const,
  },
};
