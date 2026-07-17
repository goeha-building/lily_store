import { useMemo, useState, type FormEvent } from 'react';
import type { Coupon, Student, TuckShopProduct } from '../types';
import { productMatches } from '../utils';
import './Coupons.css';

export interface CouponCartItem { product: TuckShopProduct; quantity: number; }

interface Props {
  student: Student | null;
  coupons: Coupon[];
  products: TuckShopProduct[];
  onRegister: (serialNumber: string) => Promise<void>;
  onUse: (coupon: Coupon, items: CouponCartItem[]) => Promise<void>;
  onDismissUsed: (coupon: Coupon) => Promise<void>;
}

const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;

export default function Coupons({ student, coupons, products, onRegister, onUse, onDismissUsed }: Props) {
  const [serialNumber, setSerialNumber] = useState(''); const [selected, setSelected] = useState<Coupon | null>(null); const [message, setMessage] = useState(''); const [sort, setSort] = useState<'expiry' | 'recent'>('expiry');
  const activeCoupons = useMemo(() => coupons.filter((coupon) => coupon.status === 'registered').sort((a, b) => sort === 'expiry' ? a.expiresAt.getTime() - b.expiresAt.getTime() : (b.registeredAt?.getTime() ?? 0) - (a.registeredAt?.getTime() ?? 0)), [coupons, sort]);
  const availableProducts = useMemo(() => products.filter((product) => product.isActive), [products]);
  const register = async (event: FormEvent) => { event.preventDefault(); setMessage(''); try { await onRegister(serialNumber); setSerialNumber(''); setMessage('쿠폰이 내 계정에 등록되었습니다.'); } catch (error) { setMessage(error instanceof Error ? error.message : '쿠폰 등록에 실패했습니다.'); } };

  if (!student) return <section className="scanner-login"><div className="bubble-icon">🎟️</div><h1>쿠폰</h1><p>쿠폰을 등록하고 사용하려면 먼저 로그인해 주세요.</p></section>;
  return <div className="page-stack"><header className="page-header"><p className="eyebrow">MY DIGITAL COUPONS</p><h1>내 쿠폰</h1><p>모든 쿠폰은 잔액을 나누어 사용할 수 있습니다.</p></header><form className="glass-card coupon-register" onSubmit={register}><strong>쿠폰 일련번호 등록</strong><input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value.toUpperCase())} placeholder="MAE-XXXX-XXXX" autoCapitalize="characters" /><button className="primary-button">쿠폰 등록</button>{message && <p className={message.includes('실패') || message.includes('없') || message.includes('만료') ? 'form-error' : 'coupon-success'}>{message}</p>}</form><div className="coupon-sort"><button className={sort === 'expiry' ? 'active' : ''} onClick={() => setSort('expiry')}>만료 임박순</button><button className={sort === 'recent' ? 'active' : ''} onClick={() => setSort('recent')}>최근 등록순</button></div><section className="coupon-grid">{activeCoupons.map((coupon) => <button className="coupon-card" key={coupon.id} onClick={() => setSelected(coupon)}><small>나눠서 사용 가능</small><strong>{money(coupon.currentBalance)}</strong><span>{coupon.serialNumber}</span><em>만료일 {coupon.expiresAt.toLocaleDateString('ko-KR')}</em></button>)}{!activeCoupons.length && <p className="empty-message">아직 등록된 사용 가능 쿠폰이 없습니다.</p>}</section><section className="used-coupon-list">{coupons.filter((coupon) => coupon.status === 'used').map((coupon) => <article key={coupon.id}><div><strong>{coupon.serialNumber}</strong><span>다 사용한 쿠폰</span></div><button type="button" onClick={() => void onDismissUsed(coupon).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '쿠폰 삭제에 실패했습니다.'))}>삭제</button></article>)}</section>{selected && <UseCouponModal coupon={selected} products={availableProducts} onClose={() => setSelected(null)} onUse={onUse} />}</div>;
}

function UseCouponModal({ coupon, products, onClose, onUse }: { coupon: Coupon; products: TuckShopProduct[]; onClose: () => void; onUse: Props['onUse'] }) {
  const [search, setSearch] = useState(''); const [selectedProduct, setSelectedProduct] = useState<TuckShopProduct | null>(null); const [quantityText, setQuantityText] = useState('1'); const [cart, setCart] = useState<CouponCartItem[]>([]); const [error, setError] = useState('');
  const matches = useMemo(() => search.trim() ? products.filter((product) => productMatches(search, product.searchTerms)) : products, [products, search]);
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const selectProduct = (product: TuckShopProduct) => { setSelectedProduct(product); setQuantityText('1'); setSearch(product.name); setError(''); };
  const addToCart = () => {
    const quantity = Number(quantityText);
    if (!selectedProduct) { setError('검색 결과에서 상품을 선택해 주세요.'); return; }
    if (!Number.isInteger(quantity) || quantity < 1) { setError('수량은 1개 이상이어야 합니다.'); return; }
    const alreadyInCart = cart.find((item) => item.product.id === selectedProduct.id)?.quantity ?? 0;
    if (alreadyInCart + quantity > selectedProduct.currentStock) { setError(`재고는 최대 ${selectedProduct.currentStock}개입니다.`); return; }
    setCart((current) => current.some((item) => item.product.id === selectedProduct.id) ? current.map((item) => item.product.id === selectedProduct.id ? { ...item, quantity: item.quantity + quantity } : item) : [...current, { product: selectedProduct, quantity }]);
    setSelectedProduct(null); setQuantityText('1'); setSearch(''); setError('');
  };
  const removeCartItem = (productId: string) => setCart((current) => current.filter((item) => item.product.id !== productId));
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); if (!cart.length) { setError('최소 한 개의 상품을 장바구니에 추가해 주세요.'); return; } try { await onUse(coupon, cart); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : '쿠폰 사용에 실패했습니다.'); } };

  return <div className="modal-backdrop"><form className="success-modal coupon-use-modal" onSubmit={submit}><span>🎟️</span><h2>쿠폰 사용</h2><p>쿠폰 잔액 {money(coupon.currentBalance)}</p><label className="coupon-search-label">상품 검색<input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="상품 이름을 검색하세요" /></label><div className="coupon-product-list">{matches.map((product) => <button type="button" key={product.id} className={selectedProduct?.id === product.id ? 'coupon-product-option selected' : 'coupon-product-option'} onClick={() => selectProduct(product)}><span>{product.name}</span><b>{money(product.price)}</b><small>{product.currentStock > 0 ? `재고 ${product.currentStock}` : '품절'}</small></button>)}{!matches.length && <p className="empty-message">검색된 상품이 없습니다.</p>}</div>{selectedProduct && <div className="coupon-add-row"><strong>{selectedProduct.name} · {money(selectedProduct.price)}</strong><label>수량<input min="1" inputMode="numeric" type="text" value={quantityText} onChange={(event) => setQuantityText(event.target.value.replace(/\D/g, ''))} /></label><button type="button" className="secondary-button" onClick={addToCart}>+ 상품 추가</button></div>}<section className="coupon-cart"><h3>선택한 상품</h3>{cart.length ? <ul>{cart.map((item) => <li key={item.product.id}><span>{item.product.name} × {item.quantity}</span><b>{money(item.product.price * item.quantity)}</b><button type="button" aria-label={`${item.product.name} 삭제`} onClick={() => removeCartItem(item.product.id)}>×</button></li>)}</ul> : <p>상품을 검색하고 수량을 정한 뒤 추가해 주세요.</p>}</section><strong className="coupon-total">총 {money(total)}</strong>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" disabled={!cart.length}>쿠폰 사용</button></div></form></div>;
}
