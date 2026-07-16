import type { PurchaseLog } from '../types';

export default function MyLogs({ logs, isLoading }: { logs: PurchaseLog[]; isLoading: boolean }) {
  const categories = logs.reduce<Record<string, number>>((result, log) => { result[log.category] = (result[log.category] ?? 0) + 1; return result; }, {});
  const total = logs.length || 1;
  const colors = ['#35bced', '#79c843', '#ffc94d', '#ff8d69', '#a88cf2'];
  let cursor = 0;
  const gradient = Object.entries(categories).map(([, count], index) => { const start = cursor; cursor += count / total * 100; return `${colors[index % colors.length]} ${start}% ${cursor}%`; }).join(', ') || '#d9f2fb 0 100%';
  return <div className="page-stack"><header className="page-header"><p className="eyebrow">MY SNACK REPORT</p><h1>나의 구매 기록</h1><p>총 {logs.length}개의 간식을 기록했어요.</p></header>
    <section className="glass-card chart-card"><div className="donut" style={{ background: `conic-gradient(${gradient})` }}><span>{logs.length}<small>개</small></span></div><div className="legend">{Object.entries(categories).length ? Object.entries(categories).map(([category, count], index) => <p key={category}><i style={{ backgroundColor: colors[index % colors.length] }} />{category}<b>{count}개</b></p>) : <p>스캔 후 카테고리 비율이 표시됩니다.</p>}</div></section>
    <section className="glass-card log-card"><h2>구매 목록</h2>{isLoading ? <p>기록을 불러오는 중…</p> : logs.length ? <ul className="log-list">{logs.map((log) => <li key={log.id}><span className="product-dot">✦</span><div><strong>{log.productName}</strong><p>{log.category}</p></div><time>{log.timestamp.toLocaleDateString('ko-KR')}<br />{log.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></li>)}</ul> : <p className="empty-message">아직 구매 기록이 없어요.</p>}</section>
  </div>;
}
