import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { DashboardStats, ProductInput, TuckShopProduct } from '../types';

interface Props {
  products: TuckShopProduct[];
  stats: DashboardStats;
  onAddProduct: (input: ProductInput) => Promise<void>;
  onRestock: (product: TuckShopProduct, amount: number) => Promise<void>;
  onUpdateProduct: (id: string, updates: Pick<TuckShopProduct, 'name' | 'category' | 'price' | 'currentStock' | 'aliases'>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onExit: () => void;
}

const initial: ProductInput = { name: '', aliasesText: '', category: '음료', price: 0, stockDate: new Date().toISOString().slice(0, 10), stockQuantity: 1 };

export default function AdminDashboard(props: Props) {
  const [form, setForm] = useState<ProductInput>(initial);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<TuckShopProduct | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const totalCategoryPurchases = props.stats.categoryCounts.reduce((total, item) => total + item.count, 0);
  const change = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await props.onAddProduct(form);
      setForm(initial);
      setMessage('상품을 서버에 등록했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '상품 등록에 실패했습니다.');
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setMessage('CSV UTF-8 파일만 업로드할 수 있습니다.'); return; }
    try {
      const rows = (await file.text()).replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1);
      let count = 0;
      for (const row of rows) {
        const [name, category, price, stockDate, stockQuantity, aliasesText = '', calories = ''] = row.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
        if (!name || !category || !price || !stockQuantity) continue;
        await props.onAddProduct({ name, category, price: Number(price), stockDate: stockDate || initial.stockDate, stockQuantity: Number(stockQuantity), aliasesText, calories: calories ? Number(calories) : undefined });
        count += 1;
      }
      setMessage(`${count}개 상품을 서버에 등록했습니다.`);
      setUploadOpen(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : '일괄 등록에 실패했습니다.'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  return <main className="admin-shell">
    <header className="admin-header"><div><p className="eyebrow">ADMIN DASHBOARD</p><h1>매점 관리</h1></div><button className="secondary-button" onClick={props.onExit}>사용자 화면으로</button></header>
    <section className="stats-grid"><article><small>등록 사용자</small><b>{props.stats.userCount}명</b></article><article><small>오늘 구매</small><b>{props.stats.todayPurchaseCount}건</b></article><article><small>이번 주 구매</small><b>{props.stats.weeklyPurchaseCount}건</b></article></section>
    <div className="admin-grid">
      <form className="admin-form" onSubmit={submit}><h2>새 상품 입고</h2><button type="button" className="excel-button" onClick={() => setUploadOpen(true)}>CSV 일괄 업로드</button><label>상품명<input required value={form.name} onChange={(event) => change('name', event.target.value)} /></label><label>검색 별칭<input value={form.aliasesText} onChange={(event) => change('aliasesText', event.target.value)} placeholder="포카리, POCARI" /></label><div className="form-columns"><label>종류<select value={form.category} onChange={(event) => change('category', event.target.value)}><option>음료</option><option>과자</option><option>젤리</option><option>캔디</option><option>기타</option></select></label><label>가격<input required type="number" min="0" value={form.price || ''} onChange={(event) => change('price', Number(event.target.value))} /></label></div><div className="form-columns"><label>입고일<input required type="date" value={form.stockDate} onChange={(event) => change('stockDate', event.target.value)} /></label><label>입고 수량<input required type="number" min="1" value={form.stockQuantity || ''} onChange={(event) => change('stockQuantity', Number(event.target.value))} /></label></div><button className="primary-button">상품 등록</button><p className="admin-message">{message}</p></form>
      <section className="admin-products"><h2>재고 현황 ({props.products.length})</h2><ul>{props.products.map((product) => <li key={product.id}><div><strong>{product.name}</strong><p>{product.category} · {product.price.toLocaleString()}원</p><small>재고 {product.currentStock} · 좋아요 {product.likedBy?.length ?? 0}</small></div><div className="stock"><button onClick={() => setEditing(product)}>수정</button><button onClick={() => { if (window.confirm(`${product.name} 상품을 삭제할까요?`)) void props.onDeleteProduct(product.id).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '삭제에 실패했습니다.')); }}>삭제</button><button onClick={() => { const amount = Number(window.prompt('추가 입고 수량', '1')); if (amount > 0) void props.onRestock(product, amount).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '입고 처리에 실패했습니다.')); }}>+ 입고</button></div></li>)}</ul></section>
    </div>
    <section className="analytics"><h2>인기 상품 Top 3</h2><ol>{props.stats.topProducts.length ? props.stats.topProducts.map((product) => <li key={product.name}>{product.name} <b>{product.count}건</b></li>) : <li>아직 구매 기록이 없습니다.</li>}</ol><h2>카테고리별 구매 비율</h2><ul>{props.stats.categoryCounts.length ? props.stats.categoryCounts.map((item) => <li key={item.category}>{item.category} <b>{item.count}건 ({Math.round(item.count / totalCategoryPurchases * 100)}%)</b></li>) : <li>아직 구매 기록이 없습니다.</li>}</ul></section>
    {editing && <EditModal product={editing} onClose={() => setEditing(null)} onSave={async (updates) => { await props.onUpdateProduct(editing.id, updates); setEditing(null); }} />}
    {uploadOpen && <div className="modal-backdrop"><div className="success-modal upload-modal"><h2>상품 일괄 업로드</h2><p>첫 줄을 제외하고 다음 순서의 CSV UTF-8 파일을 올려 주세요.</p><code>상품명,종류,가격,입고일,입고수량,별칭,칼로리</code><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(event) => void upload(event)} /><button className="secondary-button" onClick={() => setUploadOpen(false)}>닫기</button></div></div>}
  </main>;
}

function EditModal({ product, onClose, onSave }: { product: TuckShopProduct; onClose: () => void; onSave: (updates: Pick<TuckShopProduct, 'name' | 'category' | 'price' | 'currentStock' | 'aliases'>) => Promise<void> }) {
  const [name, setName] = useState(product.name); const [category, setCategory] = useState(product.category); const [price, setPrice] = useState(product.price); const [stock, setStock] = useState(product.currentStock); const [aliases, setAliases] = useState(product.aliases.join(', '));
  return <div className="modal-backdrop"><form className="success-modal edit-modal" onSubmit={(event) => { event.preventDefault(); void onSave({ name, category, price, currentStock: stock, aliases: aliases.split(',').map((item) => item.trim()).filter(Boolean) }); }}><h2>상품 수정</h2><label>상품명<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>종류<input value={category} onChange={(event) => setCategory(event.target.value)} /></label><label>가격<input type="number" min="0" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label><label>현재 재고<input type="number" min="0" value={stock} onChange={(event) => setStock(Number(event.target.value))} /></label><label>별칭<input value={aliases} onChange={(event) => setAliases(event.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button">저장</button></div></form></div>;
}
