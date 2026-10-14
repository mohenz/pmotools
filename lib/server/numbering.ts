import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { nextNumberingBase } from "@/lib/domain/numbering";

// 프로젝트 번호 시작점 자동 발번(2026-09-30) — 프로젝트 생성 트랜잭션 안에서 호출한다. pmotools와 백오피스에 같은 내용으로 둔다.
type Tx = Prisma.TransactionClient;

/** 지금 쓰이는 가장 큰 값(기존 시작점 + 7개 순번)의 다음 10만 블록. */
export async function allocateNumberingBase(tx: Tx) {
  const [base, wbs, workLog, requirement, requirementChange, issue, managementTask, pmoDelayedTask] = await Promise.all([
    tx.project.aggregate({ _max: { numberingBase: true } }),
    tx.wbsItemSequence.aggregate({ _max: { value: true } }),
    tx.workLogSequence.aggregate({ _max: { value: true } }),
    tx.requirementSequence.aggregate({ _max: { value: true } }),
    tx.requirementChangeSequence.aggregate({ _max: { value: true } }),
    tx.issueSequence.aggregate({ _max: { value: true } }),
    tx.managementTaskSequence.aggregate({ _max: { value: true } }),
    tx.pmoDelayedTaskSequence.aggregate({ _max: { value: true } }),
  ]);
  return nextNumberingBase([base._max.numberingBase, ...[wbs, workLog, requirement, requirementChange, issue, managementTask, pmoDelayedTask].map((row) => row._max.value)]);
}

/** 새 프로젝트의 7개 순번을 시작점으로 미리 만든다 — 번호 발급 코드는 이 값 다음부터 이어서 발급한다. */
export async function presetNumberingSequences(tx: Tx, projectId: string, base: number) {
  const data = { projectId, value: base };
  await Promise.all([
    tx.wbsItemSequence.create({ data }), tx.workLogSequence.create({ data }), tx.requirementSequence.create({ data }),
    tx.requirementChangeSequence.create({ data }), tx.issueSequence.create({ data }), tx.managementTaskSequence.create({ data }),
    tx.pmoDelayedTaskSequence.create({ data }),
  ]);
}

/** 동시 생성으로 같은 시작점을 잡아 유일 제약(numberingBase)에 걸렸는지. */
export function isNumberingBaseConflict(error: unknown) {
  const e = error as { code?: string; meta?: unknown; message?: string } | null;
  return e?.code === "P2002" && /numberingBase/.test(`${JSON.stringify(e.meta ?? {})} ${e.message ?? ""}`);
}
