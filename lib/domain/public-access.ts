export const PUBLIC_VIEW_PATHS = ["/calendar", "/meetrooms"] as const;
export const PUBLIC_READ_APIS = ["/api/v1/meeting-reservations"] as const;

export function isPublicViewPath(pathname: string) {
  return PUBLIC_VIEW_PATHS.some((path) => path === pathname);
}

export function isPublicReadApi(method: string, pathname: string) {
  return method === "GET" && PUBLIC_READ_APIS.some((path) => path === pathname);
}
