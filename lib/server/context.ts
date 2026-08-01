import "server-only";

export function getLocalContext() {
  const userId = process.env.LOCAL_USER_ID;
  const projectId = process.env.DEFAULT_PROJECT_ID;
  if (!userId || !projectId) throw new Error("Local user context is not configured.");

  // ponytail: Supabase Auth adapter replaces this local-only identity in the cloud phase.
  return { userId, projectId };
}

