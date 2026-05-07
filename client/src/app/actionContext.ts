export type AppActionContext = Record<string, unknown>;

export function fromContext<T>(context: AppActionContext, key: string) {
  return context[key] as T;
}
