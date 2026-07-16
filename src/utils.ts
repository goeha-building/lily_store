/** 공백, 단위, 특수문자와 영문 대소문자 차이를 제거해 상품 검색에 사용합니다. */
export function normalizeProductText(value: string): string {
  return value.toLowerCase().normalize('NFKC').replace(/[\s\-_/.,()\[\]]/g, '').replace(/(ml|g|kg|l)$/i, '');
}

const BRAND_SYNONYMS: Record<string, string[]> = {
  pocari: ['포카리', '포카리스웨트'],
  '포카리': ['pocari', '포카리스웨트'],
  coke: ['코카콜라', '콜라'],
  '코카콜라': ['coke', '콜라'],
};

/** 등록 이름·관리자 별칭·대표 브랜드 별칭을 합쳐 유연한 검색어를 생성합니다. */
export function productSearchTerms(name: string, aliases: string[] = []): string[] {
  const values = [name, ...aliases];
  const terms = new Set(values.flatMap((value) => {
    const normalized = normalizeProductText(value);
    const firstWord = normalizeProductText(value.split(/\s+/)[0] ?? '');
    return [normalized, firstWord, ...(BRAND_SYNONYMS[normalized] ?? []), ...(BRAND_SYNONYMS[firstWord] ?? [])].map(normalizeProductText);
  }).filter(Boolean));
  return [...terms];
}

export function productMatches(query: string, terms: string[]): boolean {
  const variants = productSearchTerms(query);
  return variants.some((variant) => terms.some((term) => term.includes(variant) || variant.includes(term)));
}

export async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
