export const keys = {
  profiles: {
    all: ["profiles"] as const,
    detail: (id: string) => ["profiles", id] as const,
  },
};
