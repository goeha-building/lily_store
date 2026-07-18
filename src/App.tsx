import { useEffect, useMemo, useState } from 'react';
import {
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import AdminDashboard from './components/AdminDashboard';
import BottomNav, { type Tab } from './components/BottomNav';
import Coupons, { type CouponCartItem } from './components/Coupons';
import Home from './components/Home';
import MyLogs from './components/MyLogs';
import Scanner from './components/Scanner';
import { db } from './firebase';
import type {
  DashboardStats,
  ProductInput,
  PurchaseLog,
  Recommendation,
  Student,
  TuckShopProduct,
  Coupon,
} from './types';
import { hashPassword, normalizeProductText, productSearchTerms } from './utils';

const SESSION_KEY = 'maejum-session';

function asDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date();
}

function toProduct(id: string, data: Record<string, unknown>): TuckShopProduct {
  return {
    id,
    name: String(data.name ?? ''),
    normalizedName: String(data.normalizedName ?? ''),
    aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : [],
    searchTerms: Array.isArray(data.searchTerms) ? data.searchTerms.map(String) : [],
    category: String(data.category ?? '기타'),
    price: Number(data.price ?? 0),
    stockDate: asDate(data.stockDate),
    stockQuantity: Number(data.stockQuantity ?? 0),
    currentStock: Number(data.currentStock ?? 0),
    calories: typeof data.calories === 'number' ? data.calories : undefined,
    isActive: data.isActive !== false,
    likedBy: Array.isArray(data.likedBy) ? data.likedBy.map(String) : [],
  };
}

function toLog(id: string, data: Record<string, unknown>, studentId?: string): PurchaseLog {
  return {
    id,
    productId: typeof data.productId === 'string' ? data.productId : undefined,
    productName: String(data.productName ?? ''),
    category: String(data.category ?? '기타'),
    price: typeof data.price === 'number' ? data.price : undefined,
    timestamp: asDate(data.purchasedAt),
    studentId: studentId ?? (typeof data.studentId === 'string' ? data.studentId : undefined),
  };
}

function toCoupon(id: string, data: Record<string, unknown>): Coupon {
  return {
    id,
    serialNumber: String(data.serialNumber ?? ''),
    initialAmount: Number(data.initialAmount ?? 0),
    currentBalance: Number(data.currentBalance ?? 0),
    expiresAt: asDate(data.expiresAt),
    isSplitable: data.isSplitable === true,
    status: (data.status ?? 'active') as Coupon['status'],
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : null,
    registeredAt: data.registeredAt ? asDate(data.registeredAt) : undefined,
    createdAt: data.createdAt ? asDate(data.createdAt) : undefined,
  };
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [student, setStudent] = useState<Student | null>(null);
  const [products, setProducts] = useState<TuckShopProduct[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [myLogs, setMyLogs] = useState<PurchaseLog[]>([]);
  const [myCoupons, setMyCoupons] = useState<Coupon[]>([]);
  const [allCoupons, setAllCoupons] = useState<Coupon[]>([]);
  const [allLogs, setAllLogs] = useState<PurchaseLog[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const savedStudentId = localStorage.getItem(SESSION_KEY);
    if (!savedStudentId) return;

    return onSnapshot(doc(db, 'users', savedStudentId), (snapshot) => {
      if (!snapshot.exists()) {
        localStorage.removeItem(SESSION_KEY);
        setStudent(null);
        return;
      }
      setStudent({
        studentId: snapshot.id,
        mustChangePassword: snapshot.data().mustChangePassword === true,
      });
    });
  }, []);

  useEffect(() => onSnapshot(collection(db, 'products'), (snapshot) => {
    setProducts(snapshot.docs
      .map((item) => toProduct(item.id, item.data()))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')));
  }), []);

  useEffect(() => onSnapshot(collection(db, 'recommendations'), (snapshot) => {
    setRecommendations(snapshot.docs
      .map<Recommendation>((item) => ({
        id: item.id,
        name: String(item.data().name ?? ''),
        supporters: Array.isArray(item.data().supporters) ? item.data().supporters.map(String) : [],
        createdAt: asDate(item.data().createdAt),
        status: item.data().status === 'completed' ? 'completed' : 'pending',
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }), []);

  useEffect(() => {
    if (!student) {
      setMyLogs([]);
      return;
    }
    return onSnapshot(collection(db, 'users', student.studentId, 'purchase_logs'), (snapshot) => {
      setMyLogs(snapshot.docs
        .map((item) => toLog(item.id, item.data(), student.studentId))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    });
  }, [student?.studentId]);

  useEffect(() => {
    if (!student) { setMyCoupons([]); return; }
    return onSnapshot(collection(db, 'coupons'), (snapshot) => {
      const now = new Date();
      setMyCoupons(snapshot.docs
        .filter((item) => item.data().ownerUid === student.studentId && !(Array.isArray(item.data().hiddenBy) && item.data().hiddenBy.includes(student.studentId)))
        .map((item) => toCoupon(item.id, item.data()))
        .map((coupon) => coupon.expiresAt < now && coupon.status === 'registered' ? { ...coupon, status: 'expired' } : coupon));
    });
  }, [student?.studentId]);

  useEffect(() => {
    if (!isAdmin) {
      setAllLogs([]);
      setUserCount(0);
      return;
    }
    const unsubscribeLogs = onSnapshot(collectionGroup(db, 'purchase_logs'), (snapshot) => {
      setAllLogs(snapshot.docs.map((item) => {
        const studentId = item.ref.parent.parent?.id;
        return toLog(item.id, item.data(), studentId);
      }));
    });
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => setUserCount(snapshot.size));
    return () => {
      unsubscribeLogs();
      unsubscribeUsers();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) { setAllCoupons([]); return; }
    return onSnapshot(collection(db, 'coupons'), (snapshot) => setAllCoupons(snapshot.docs
      .map((item) => toCoupon(item.id, item.data()))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))));
  }, [isAdmin]);

  const login = async (studentId: string, password: string) => {
    if (!/^\d{5}$/.test(studentId)) throw new Error('학번은 숫자 5자리여야 합니다.');
    const userRef = doc(db, 'users', studentId);
    const passwordHash = await hashPassword(password);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      if (password !== '1234') throw new Error('처음 로그인할 때 비밀번호는 1234입니다.');
      await runTransaction(db, async (transaction) => {
        const current = await transaction.get(userRef);
        if (!current.exists()) {
          transaction.set(userRef, {
            passwordHash,
            mustChangePassword: true,
            createdAt: serverTimestamp(),
          });
        }
      });
      const created = await getDoc(userRef);
      if (created.data()?.passwordHash !== passwordHash) throw new Error('이미 가입된 학번입니다. 비밀번호를 확인해 주세요.');
      setStudent({ studentId, mustChangePassword: created.data()?.mustChangePassword === true });
    } else {
      if (snapshot.data().passwordHash !== passwordHash) throw new Error('비밀번호가 올바르지 않습니다.');
      setStudent({ studentId, mustChangePassword: snapshot.data().mustChangePassword === true });
    }
    localStorage.setItem(SESSION_KEY, studentId);
  };

  const changePassword = async (newPassword: string) => {
    if (!student || newPassword.length < 4) throw new Error('비밀번호는 4자리 이상이어야 합니다.');
    await updateDoc(doc(db, 'users', student.studentId), {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      passwordChangedAt: serverTimestamp(),
    });
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setStudent(null);
    setTab('home');
  };

  const savePurchase = async (product: TuckShopProduct) => {
    if (!student) throw new Error('먼저 로그인해 주세요.');
    const productRef = doc(db, 'products', product.id);
    const logRef = doc(collection(db, 'users', student.studentId, 'purchase_logs'));
    await runTransaction(db, async (transaction) => {
      const productSnapshot = await transaction.get(productRef);
      if (!productSnapshot.exists()) throw new Error('상품을 찾을 수 없습니다.');
      const currentStock = Number(productSnapshot.data().currentStock ?? 0);
      if (currentStock < 1) throw new Error('재고가 부족합니다.');
      transaction.update(productRef, { currentStock: currentStock - 1, updatedAt: serverTimestamp() });
      transaction.set(logRef, {
        productId: product.id,
        productName: productSnapshot.data().name,
        category: productSnapshot.data().category,
        price: productSnapshot.data().price,
        studentId: student.studentId,
        purchasedAt: serverTimestamp(),
      });
    });
  };

  const registerCoupon = async (rawSerialNumber: string) => {
    if (!student) throw new Error('먼저 로그인해 주세요.');
    const serialNumber = rawSerialNumber.trim().toUpperCase();
    if (!/^MAE-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(serialNumber)) throw new Error('MAE-XXXX-XXXX 형식의 쿠폰 번호를 입력해 주세요.');
    const matches = await getDocs(query(collection(db, 'coupons'), where('serialNumber', '==', serialNumber)));
    if (matches.empty) throw new Error('존재하지 않는 쿠폰 번호입니다.');
    const couponRef = matches.docs[0].ref;
    const userCouponRef = doc(db, 'users', student.studentId, 'coupons', couponRef.id);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(couponRef);
      if (!snapshot.exists()) throw new Error('존재하지 않는 쿠폰입니다.');
      const data = snapshot.data();
      if (data.status !== 'active' || data.ownerUid) throw new Error('이미 등록되었거나 사용할 수 없는 쿠폰입니다.');
      const expiresAt = asDate(data.expiresAt);
      if (expiresAt < new Date()) { transaction.update(couponRef, { status: 'expired', updatedAt: serverTimestamp() }); throw new Error('만료된 쿠폰입니다.'); }
      const couponData = { couponId: couponRef.id, serialNumber, initialAmount: Number(data.initialAmount ?? 0), currentBalance: Number(data.currentBalance ?? data.initialAmount ?? 0), expiresAt: data.expiresAt, isSplitable: data.isSplitable === true, status: 'registered', registeredAt: serverTimestamp(), updatedAt: serverTimestamp() };
      transaction.update(couponRef, { status: 'registered', ownerUid: student.studentId, registeredAt: serverTimestamp(), updatedAt: serverTimestamp() });
      transaction.set(userCouponRef, couponData);
    });
  };

  const useCoupon = async (coupon: Coupon, items: CouponCartItem[]) => {
    if (!student) throw new Error('먼저 로그인해 주세요.');
    if (!items.length || items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) throw new Error('선택한 상품과 수량을 확인해 주세요.');
    const couponRef = doc(db, 'coupons', coupon.id);
    const userCouponRef = doc(db, 'users', student.studentId, 'coupons', coupon.id);
    const transactionRef = doc(collection(db, 'couponTransactions'));
    await runTransaction(db, async (transaction) => {
      const productRefs = items.map((item) => doc(db, 'products', item.product.id));
      const [snapshot, ...productSnapshots] = await Promise.all([transaction.get(couponRef), ...productRefs.map((productRef) => transaction.get(productRef))]);
      if (!snapshot.exists()) throw new Error('쿠폰 정보를 찾을 수 없습니다.');
      const purchaseItems = productSnapshots.map((productSnapshot, index) => {
        const item = items[index];
        if (!productSnapshot.exists() || productSnapshot.data().isActive === false) throw new Error(`${item.product.name}은(는) 현재 판매하지 않는 상품입니다.`);
        const currentStock = Number(productSnapshot.data().currentStock ?? 0);
        if (currentStock < item.quantity) throw new Error(`${String(productSnapshot.data().name ?? item.product.name)} 재고가 부족합니다.`);
        const unitPrice = Number(productSnapshot.data().price ?? 0);
        if (!Number.isFinite(unitPrice) || unitPrice < 1) throw new Error('상품 가격 정보를 확인해 주세요.');
        return { productRef: productRefs[index], productSnapshot, productId: productRefs[index].id, productName: String(productSnapshot.data().name ?? item.product.name), quantity: item.quantity, unitPrice, totalPrice: unitPrice * item.quantity, currentStock };
      });
      const data = snapshot.data(); const balance = Number(data.currentBalance ?? 0); const totalPrice = purchaseItems.reduce((sum, item) => sum + item.totalPrice, 0);
      if (data.status !== 'registered' || data.ownerUid !== student.studentId) throw new Error('현재 사용할 수 없는 쿠폰입니다.');
      if (asDate(data.expiresAt) < new Date()) { transaction.update(couponRef, { status: 'expired', updatedAt: serverTimestamp() }); transaction.update(userCouponRef, { status: 'expired', updatedAt: serverTimestamp() }); throw new Error('만료된 쿠폰입니다.'); }
      if (totalPrice > balance) throw new Error('쿠폰 잔액이 부족합니다!');
      const balanceAfter = balance - totalPrice; const isUsed = balanceAfter === 0;
      transaction.update(couponRef, { currentBalance: balanceAfter, status: isUsed ? 'used' : 'registered', ...(isUsed ? { usedAt: serverTimestamp(), disabled: true } : {}), updatedAt: serverTimestamp() });
      transaction.update(userCouponRef, { currentBalance: balanceAfter, status: isUsed ? 'used' : 'registered', updatedAt: serverTimestamp() });
      purchaseItems.forEach((item) => transaction.update(item.productRef, { currentStock: item.currentStock - item.quantity, updatedAt: serverTimestamp() }));
      transaction.set(transactionRef, { couponId: coupon.id, ownerUid: student.studentId, serialNumber: String(data.serialNumber ?? coupon.serialNumber), items: purchaseItems.map(({ productId, productName, quantity, unitPrice, totalPrice: itemTotalPrice }) => ({ productId, productName, quantity, unitPrice, totalPrice: itemTotalPrice })), totalPrice, balanceBefore: balance, balanceAfter, createdAt: serverTimestamp() });
    });
  };

  const dismissUsedCoupon = async (coupon: Coupon) => {
    if (!student || coupon.status !== 'used') throw new Error('다 사용한 쿠폰만 삭제할 수 있습니다.');
    await updateDoc(doc(db, 'coupons', coupon.id), { hiddenBy: arrayUnion(student.studentId), updatedAt: serverTimestamp() });
  };

  const createCoupon = async (amount: number, expiresAt: string) => {
    if (!Number.isInteger(amount) || amount < 1 || !expiresAt) throw new Error('쿠폰 금액과 만료일을 올바르게 입력해 주세요.');
    const serialNumber = `MAE-${Array.from(crypto.getRandomValues(new Uint32Array(2)), (value) => value.toString(36).toUpperCase().padStart(4, '0').slice(-4)).join('-')}`;
    await setDoc(doc(collection(db, 'coupons')), { serialNumber, initialAmount: amount, currentBalance: amount, expiresAt: Timestamp.fromDate(new Date(`${expiresAt}T23:59:59`)), isSplitable: true, status: 'active', ownerUid: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  };

  const addProduct = async (input: ProductInput) => {
    const aliases = input.aliasesText.split(',').map((value) => value.trim()).filter(Boolean);
    const productRef = doc(collection(db, 'products'));
    await setDoc(productRef, {
      name: input.name.trim(),
      normalizedName: normalizeProductText(input.name),
      aliases,
      searchTerms: productSearchTerms(input.name, aliases),
      category: input.category,
      price: input.price,
      stockDate: Timestamp.fromDate(new Date(`${input.stockDate}T00:00:00`)),
      stockQuantity: input.stockQuantity,
      currentStock: input.stockQuantity,
      ...(input.calories === undefined ? {} : { calories: input.calories }),
      isActive: true,
      likedBy: [],
      createdAt: serverTimestamp(),
    });
  };

  const restock = async (product: TuckShopProduct, amount: number) => {
    if (!Number.isInteger(amount) || amount < 1) throw new Error('입고 수량은 1 이상의 정수여야 합니다.');
    await updateDoc(doc(db, 'products', product.id), {
      currentStock: increment(amount),
      stockQuantity: increment(amount),
      updatedAt: serverTimestamp(),
    });
  };

  const updateProduct = async (productId: string, updates: Pick<TuckShopProduct, 'name' | 'category' | 'price' | 'currentStock' | 'aliases'>) => {
    await updateDoc(doc(db, 'products', productId), {
      ...updates,
      normalizedName: normalizeProductText(updates.name),
      searchTerms: productSearchTerms(updates.name, updates.aliases),
      updatedAt: serverTimestamp(),
    });
  };

  const deleteProduct = async (productId: string) => deleteDoc(doc(db, 'products', productId));

  const toggleLike = async (product: TuckShopProduct) => {
    if (!student) throw new Error('먼저 로그인해 주세요.');
    const liked = product.likedBy?.includes(student.studentId);
    await updateDoc(doc(db, 'products', product.id), {
      likedBy: liked ? arrayRemove(student.studentId) : arrayUnion(student.studentId),
    });
  };

  const addRecommendation = async (name: string) => {
    if (!student) throw new Error('먼저 로그인해 주세요.');
    const cleanedName = name.trim();
    if (!cleanedName) return;
    const existing = recommendations.find((item) => item.name.toLocaleLowerCase('ko') === cleanedName.toLocaleLowerCase('ko'));
    if (existing) return toggleRecommendation(existing);
    await setDoc(doc(collection(db, 'recommendations')), {
      name: cleanedName,
      supporters: [student.studentId],
      createdAt: serverTimestamp(),
    });
  };

  const toggleRecommendation = async (item: Recommendation) => {
    if (!student) throw new Error('먼저 로그인해 주세요.');
    const supported = item.supporters.includes(student.studentId);
    await updateDoc(doc(db, 'recommendations', item.id), {
      supporters: supported ? arrayRemove(student.studentId) : arrayUnion(student.studentId),
    });
  };

  const completeRecommendation = async (item: Recommendation) => {
    await updateDoc(doc(db, 'recommendations', item.id), { status: 'completed', completedAt: serverTimestamp() });
  };

  const deleteRecommendation = async (id: string) => deleteDoc(doc(db, 'recommendations', id));

  const stats = useMemo<DashboardStats>(() => {
    const productCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - ((startWeek.getDay() + 6) % 7));
    for (const log of allLogs) {
      productCounts[log.productName] = (productCounts[log.productName] ?? 0) + 1;
      categoryCounts[log.category] = (categoryCounts[log.category] ?? 0) + 1;
    }
    return {
      userCount,
      todayPurchaseCount: allLogs.filter((log) => log.timestamp >= startToday).length,
      weeklyPurchaseCount: allLogs.filter((log) => log.timestamp >= startWeek).length,
      topProducts: Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count })),
      categoryCounts: Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count })),
    };
  }, [allLogs, userCount]);

  const frequentProduct = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of myLogs) counts[log.productName] = (counts[log.productName] ?? 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? { name: top[0], count: top[1] } : undefined;
  }, [myLogs]);

  if (isAdmin) return <AdminDashboard products={products} stats={stats} coupons={allCoupons} recommendations={recommendations} onCreateCoupon={createCoupon} onAddProduct={addProduct} onRestock={restock} onUpdateProduct={updateProduct} onDeleteProduct={deleteProduct} onCompleteRecommendation={completeRecommendation} onDeleteRecommendation={deleteRecommendation} onExit={() => setIsAdmin(false)} />;
  return <main className="app-shell"><section className="app-content">{tab === 'home' && <Home student={student} recentLog={myLogs[0]} frequentProduct={frequentProduct} recommendations={recommendations} onLogin={login} onLogout={logout} onChangePassword={changePassword} onAddRecommendation={addRecommendation} onToggleRecommendation={toggleRecommendation} onOpenPurchase={() => setTab('purchase')} onEnterAdmin={() => setIsAdmin(true)} />}{tab === 'purchase' && <Scanner student={student} products={products} onSave={savePurchase} onToggleLike={toggleLike} />}{tab === 'coupons' && <Coupons student={student} coupons={myCoupons} products={products} onRegister={registerCoupon} onUse={useCoupon} onDismissUsed={dismissUsedCoupon} />}{tab === 'logs' && <MyLogs logs={myLogs} isLoading={false} />}</section><BottomNav activeTab={tab} onChange={setTab} /></main>;
}
