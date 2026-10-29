/**
 * The mutation scope of every shopping list write. Mutations of one scope run one after another, so an
 * add from recipes reads the list after a tick that came before it and never writes over it, and two
 * optimistic changes cannot settle out of order. Each optimistic change still shows at once.
 */
export const SHOPPING_LIST_SCOPE = { id: "shopping-list" } as const;
