import { fromContext, type AppActionContext } from "./actionContext";

async function runContentOperation(
  context: AppActionContext,
  operation: () => Promise<void>,
) {
  fromContext<(value: boolean) => void>(
    context,
    "setIsContentOperationLoading",
  )(true);
  try {
    await operation();
  } finally {
    fromContext<(value: boolean) => void>(
      context,
      "setIsContentOperationLoading",
    )(false);
  }
}

export { runContentOperation };
