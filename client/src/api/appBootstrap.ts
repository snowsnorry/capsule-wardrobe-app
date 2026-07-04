import { API_BASE_URL } from "./config";
import { requestJson, type JsonObject } from "./request";

type AppBootstrapResponse = JsonObject;

function appUrl(path = "") {
  return `${API_BASE_URL}/app${path}`;
}

async function fetchAppBootstrap(): Promise<AppBootstrapResponse> {
  return requestJson(appUrl("/bootstrap"), {
    credentials: "include",
  });
}

export { fetchAppBootstrap };
