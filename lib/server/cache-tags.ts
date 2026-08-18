import "server-only";

// 포트폴리오 KPI 캐시 태그. work-management.ts와 items.ts가 순환 참조 없이 공유하기 위해 별도 모듈로 둔다.
export const portfolioTag = (projectId: string) => `portfolio:${projectId}`;
export const managementTaskTag = (projectId: string) => `management-task:${projectId}`;
