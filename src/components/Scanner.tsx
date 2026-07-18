import { useMemo, useState } from 'react';
import type { Student, TuckShopProduct } from '../types';
import { productMatches } from '../utils';
import './Scanner.css';

interface Props {
  student: Student | null;
  products: TuckShopProduct[];
  onSave: (product: TuckShopProduct) => Promise<void>;
  onToggleLike: (product: TuckShopProduct) => Promise<void>;
}

export default function Scanner({ student, products, onSave, onToggleLike }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<TuckShopProduct | null>(null);
  const [message, setMessage] = useState('상품 이름을 입력해 주세요.');
  const [saving, setSaving] = useState(false);

  // 1. 활성화된 상품들만 기본 필터링
  const activeProducts = useMemo(() => products.filter((item) => item.isActive), [products]);

  // 2. [새로 들어온 상품] 입고일(stockDate)이 최신인 순으로 상위 3개 추출
  const newProducts = useMemo(() => {
    return [...activeProducts]
      .sort((a, b) => b.stockDate.getTime() - a.stockDate.getTime())
      .slice(0, 3);
  }, [activeProducts]);

  // 3. 검색창 검색 결과 로직
  const matches = useMemo(() => {
    return query ? activeProducts.filter((item) => productMatches(query, item.searchTerms)) : activeProducts;
  }, [activeProducts, query]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onSave(selected);
      setSelected(null);
      setMessage('구매 기록을 저장했어요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const like = (product: TuckShopProduct) =>
    void onToggleLike(product).catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : '하트 처리에 실패했습니다.')
    );

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="eyebrow">TUCK SHOP PRODUCTS</p>
        <h1>오늘의 매점</h1>
        <p>{student ? '상품을 선택해 구매 기록을 추가하세요.' : '구매 기록과 하트는 로그인 후 사용할 수 있어요.'}</p>
      </header>

      {/* ✨ 새로 들어온 상품 옵션 적용 완료 */}
      <section className="product-poster">
        <p>{query ? '검색 결과' : '✨ 새로 들어온 상품'}</p>
        <strong>
          {query
            ? (matches.slice(0, 3).map((item) => item.name).join(' · ') || '검색 결과가 없어요')
            : (newProducts.map((item) => item.name).join(' · ') || '등록된 상품이 없어요')
          }
        </strong>
      </section>

      <section className="search-card">
        <label htmlFor="product-search">구매한 상품 이름</label>
        <input
          id="product-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ex) 사이다"
        />
        <div className="product-results">
          {matches.map((product) => {
            const soldOut = product.currentStock < 1;
            return (
              <div key={product.id} className={soldOut ? 'product-result sold-out-product' : 'product-result'}>
                <button disabled={soldOut} onClick={() => setSelected(product)}>
                  <span>🍀</span>
                  <div>
                    <strong>{product.name}</strong>
                    <small>{product.category}</small>
                  </div>
                  <b>{product.price.toLocaleString()}원</b>
                  <em className={soldOut ? 'sold-out' : ''}>{soldOut ? '품절' : `재고 ${product.currentStock}`}</em>
                </button>
                <button
                  className={
                    product.likedBy?.includes(student?.studentId ?? '') ? 'heart-button liked' : 'heart-button'
                  }
                  onClick={() => like(product)}
                >
                  ♥ {product.likedBy?.length ?? 0}
                </button>
              </div>
            );
          })}
        </div>
      </section>
      
      <p className="scanner-message">{message}</p>
      
      {selected && (
        <div className="modal-backdrop">
          <div className="success-modal">
            <span>✓</span>
            <h2>{selected.name}</h2>
            <p className="category-pill">
              {selected.category} · {selected.price.toLocaleString()}원
            </p>
            <p>이 상품을 구매 기록에 저장할까요?</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setSelected(null)}>
                취소
              </button>
              <button className="primary-button" disabled={saving} onClick={() => void save()}>
                {saving ? '저장 중…' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}