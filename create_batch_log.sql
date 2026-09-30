CREATE TABLE batch_job_logs (
    id VARCHAR(36) PRIMARY KEY,
    "jobName" TEXT NOT NULL,
    status TEXT NOT NULL,
    output TEXT,
    "durationMs" INTEGER,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX batch_job_logs_jobName_executedAt_idx ON batch_job_logs("jobName", "executedAt");
