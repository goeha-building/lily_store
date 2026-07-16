export type Tab = 'home' | 'purchase' | 'logs';

interface BottomNavProps { activeTab: Tab; onChange: (tab: Tab) => void; }

const tabs: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'home', icon: '⌂', label: '홈' },
  { id: 'purchase', icon: '🛒', label: '구매' },
  { id: 'logs', icon: '◷', label: '내 기록' },
];

export default function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return <nav className="bottom-nav" aria-label="주요 메뉴">
    {tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'nav-item active' : 'nav-item'} onClick={() => onChange(tab.id)}>
      <span aria-hidden="true">{tab.icon}</span><small>{tab.label}</small>
    </button>)}
  </nav>;
}
