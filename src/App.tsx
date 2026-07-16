import { useEffect, useState } from 'react';
import AdminDashboard from './components/AdminDashboard';
import BottomNav, { type Tab } from './components/BottomNav';
import Home from './components/Home';
import MyLogs from './components/MyLogs';
import Scanner from './components/Scanner';
import type { ProductInput, PurchaseLog, TuckShopProduct } from './types';
import { normalizeProductText, productSearchTerms } from './utils';

const LOGS_KEY = 'maejum-local-purchase-logs';
const PRODUCTS_KEY = 'maejum-local-products';

const demoProducts: TuckShopProduct[] = [
  { id: 'pocari-355', name: '포카리스웨트 355ML', normalizedName: '포카리스웨트355', aliases: ['포카리', 'POCARI', '포카리 스웨트'], searchTerms: ['포카리', '포카리스웨트355', 'pocari'], category: '음료', price: 1800, stockDate: new Date(), stockQuantity: 20, currentStock: 20, calories: 95, isActive: true },
  { id: 'choco-snack', name: '초코 과자', normalizedName: '초코과자', aliases: ['초코', '초코과자'], searchTerms: ['초코', '초코과자'], category: '과자', price: 1200, stockDate: new Date(), stockQuantity: 15, currentStock: 15, isActive: true },
];

function readStorage<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [logs, setLogs] = useState<PurchaseLog[]>([]);
  const [products, setProducts] = useState<TuckShopProduct[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const storedLogs = readStorage<Array<Omit<PurchaseLog, 'timestamp'> & { timestamp: string }>>(LOGS_KEY, []);
    setLogs(storedLogs.map((log) => ({ ...log, timestamp: new Date(log.timestamp) })));
    const storedProducts = readStorage<TuckShopProduct[]>(PRODUCTS_KEY, demoProducts);
    const parsedProducts = storedProducts.map((product) => ({ ...product, stockDate: new Date(product.stockDate) }));
    setProducts(parsedProducts);
    if (!localStorage.getItem(PRODUCTS_KEY)) localStorage.setItem(PRODUCTS_KEY, JSON.stringify(demoProducts));
  }, []);

  const persistProducts = (next: TuckShopProduct[]) => { setProducts(next); localStorage.setItem(PRODUCTS_KEY, JSON.stringify(next)); };
  const savePurchase = async (product: TuckShopProduct) => {
    if (product.currentStock < 1) throw new Error('재고가 부족한 상품입니다.');
    const log: PurchaseLog = { id: crypto.randomUUID(), productId: product.id, productName: product.name, category: product.category, price: product.price, timestamp: new Date() };
    const nextLogs = [log, ...logs];
    setLogs(nextLogs); localStorage.setItem(LOGS_KEY, JSON.stringify(nextLogs));
    persistProducts(products.map((item) => item.id === product.id ? { ...item, currentStock: item.currentStock - 1 } : item));
  };
  const addProduct = async (input: ProductInput) => { const aliases = input.aliasesText.split(',').map((alias) => alias.trim()).filter(Boolean); const product: TuckShopProduct = { id: crypto.randomUUID(), name: input.name.trim(), normalizedName: normalizeProductText(input.name), aliases, searchTerms: productSearchTerms(input.name, aliases), category: input.category, price: input.price, stockDate: new Date(`${input.stockDate}T00:00:00`), stockQuantity: input.stockQuantity, currentStock: input.stockQuantity, calories: input.calories, isActive: true }; persistProducts([...products, product]); };
  const restockProduct = async (product: TuckShopProduct, amount: number) => persistProducts(products.map((item) => item.id === product.id ? { ...item, currentStock: item.currentStock + amount, stockQuantity: item.stockQuantity + amount } : item));

  if (isAdmin) return <AdminDashboard products={products} onAddProduct={addProduct} onRestock={restockProduct} onExit={() => setIsAdmin(false)} />;
  return <main className="app-shell"><div className="sky-orb sky-orb-one" /><div className="sky-orb sky-orb-two" /><section className="app-content">{tab === 'home' && <Home recentLog={logs[0]} onOpenPurchase={() => setTab('purchase')} onEnterAdmin={() => setIsAdmin(true)} />}{tab === 'purchase' && <Scanner products={products} onSave={savePurchase} />}{tab === 'logs' && <MyLogs logs={logs} isLoading={false} />}</section><BottomNav activeTab={tab} onChange={setTab} /></main>;
}
export default App;
