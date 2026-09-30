import { getPrisma } from "@/lib/server/db-pg";

export const dynamic = "force-dynamic";

export default async function BatchLogsPage() {
  const prisma = getPrisma();
  
  const logs = await prisma.batchJobLog.findMany({
    orderBy: { executedAt: "desc" },
    take: 100,
  });

  return (
    <>
      <header className="topbar">
        <div>
          <h1>배치 모니터링</h1>
          <p>백그라운드로 실행된 시스템 배치 작업(DB 백업 등)의 이력을 확인합니다.</p>
        </div>
      </header>
      <div className="content settings-content" style={{ padding: '20px' }}>
        <div style={{ background: 'var(--bg-panel)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '12px' }}>작업명</th>
                <th style={{ padding: '12px' }}>상태</th>
                <th style={{ padding: '12px' }}>소요시간</th>
                <th style={{ padding: '12px' }}>실행일시</th>
                <th style={{ padding: '12px' }}>출력 결과 / 상세</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    실행된 배치 작업 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{log.jobName}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: log.status === 'SUCCESS' ? 'var(--status-green-bg, #e6f4ea)' : 'var(--status-red-bg, #fce8e6)',
                        color: log.status === 'SUCCESS' ? 'var(--status-green-text, #137333)' : 'var(--status-red-text, #c5221f)'
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>{log.durationMs ? `${log.durationMs} ms` : '-'}</td>
                    <td style={{ padding: '12px' }}>{log.executedAt.toLocaleString('ko-KR')}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.output || ''}>
                      {log.output || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
