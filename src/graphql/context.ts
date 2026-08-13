/**
 * Контекст резолверов. На этапе 0 — только запрос.
 * Сессия и Prisma добавляются на этапах 2-3.
 */
export type GraphQLContext = {
  request: Request;
};

export function createContext(request: Request): GraphQLContext {
  return { request };
}
