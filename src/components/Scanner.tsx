import { useMemo, useState } from 'react';
import type { TuckShopProduct } from '../types';
import { productMatches } from '../utils';

interface PurchaseProps { products: TuckShopProduct[]; onSave: (product: TuckShopProduct) => Promise<void>; }

export default function Scanner({ products, onSave }: PurchaseProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<TuckShopProduct | null>(null);
  const [message, setMessage] = useState('상품 이름을 입력해 주세요.');
  const [isSaving, setIsSaving] = useState(false);
  const available = products.filter((product) => product.isActive && product.currentStock > 0);
  const matches = useMemo(() => query.trim() ? available.filter((product) => productMatches(query, product.searchTerms.length ? product.searchTerms : [product.name, ...product.aliases])) : available, [available, query]);
  const save = async () => { if (!selected) return; setIsSaving(true); try { await onSave(selected); setSelected(null); setQuery(''); setMessage('구매 기록에 저장했어요!'); } catch (error) { setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.'); } finally { setIsSaving(false); } };
  return <div className="page-stack"><header className="page-header"><p className="eyebrow">TUCK SHOP PRODUCTS</p><h1>오늘의 매점</h1><p>찾은 상품을 선택해 구매 기록에 추가하세요.</p></header>
    <section className="product-poster"><p>🌊 FRESH PICK</p><strong>{available.length ? available.slice(0, 3).map((product) => product.name).join(' · ') : '관리자가 상품을 등록하면 여기에 표시돼요'}</strong><span>원하는 상품을 찾아 구매 기록에 추가하세요!</span></section>
    <section className="search-card"><label htmlFor="product-search">구매한 상품 이름</label><input id="product-search" autoComplete="off" placeholder="예: 포카리, POCARI, 포카리 스웨트" value={query} onChange={(event) => { setQuery(event.target.value); setMessage(''); }} /><p className="search-help">띄어쓰기·대소문자·등록된 별칭을 구분하지 않고 찾아요.</p><div className="product-results">{matches.length ? matches.map((product) => <button key={product.id} className="product-result" onClick={() => setSelected(product)}><span>🍀</span><div><strong>{product.name}</strong><small>{product.category} {product.calories ? `· ${product.calories}kcal` : ''}</small></div><b>{product.price.toLocaleString()}원</b><em>재고 {product.currentStock}</em></button>) : <p className="empty-message">일치하는 상품이 없어요. 관리자에게 별칭 또는 상품 등록을 요청해 주세요.</p>}</div></section><p className="scanner-message">{message}</p>
    {selected && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="구매 상품 확인"><div className="success-modal"><span>✓</span><p className="eyebrow">PURCHASE CHECK</p><h2>{selected.name}</h2><p className="category-pill">{selected.category} · {selected.price.toLocaleString()}원</p><p>이 상품을 구매 기록에 저장할까요?</p><div className="modal-actions"><button className="secondary-button" onClick={() => setSelected(null)}>취소</button><button className="primary-button" disabled={isSaving} onClick={() => void save()}>{isSaving ? '저장 중…' : '구매 기록하기'}</button></div></div></div>}
  </div>;
}
