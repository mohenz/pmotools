import "server-only";

export function getLocalContext() {
  const userId = process.env.LOCAL_USER_ID || "10000000-0000-4000-8000-000000000001";
  const projectId = process.env.DEFAULT_PROJECT_ID || "20000000-0000-4000-8000-000000000001";

  // Firebase Authentication을 적용할 때 검증된 사용자와 프로젝트 범위로 교체합니다.
  return { userId, projectId };
}
