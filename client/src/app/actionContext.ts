import type { Dispatch, SetStateAction } from "react";

export type AppActionContext = Record<string, unknown>;
export type SetState<T> = Dispatch<SetStateAction<T>>;

export function fromContext<T>(context: AppActionContext, key: string) {
  return context[key] as T;
}
