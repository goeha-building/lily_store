import { useEffect, useMemo, useState } from 'react';
import {
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import AdminDashboard from './components/AdminDashboard';
import BottomNav, { type Tab } from './components/BottomNav';
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

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [student, setStudent] = useState<Student | null>(null);
  const [products, setProducts] = useState<TuckShopProduct[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [myLogs, setMyLogs] = useState<PurchaseLog[]>([]);
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
      .map((item) => ({
        id: item.id,
        name: String(item.data().name ?? ''),
        supporters: Array.isArray(item.data().supporters) ? item.data().supporters.map(String) : [],
        createdAt: asDate(item.data().createdAt),
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

  if (isAdmin) return <AdminDashboard products={products} stats={stats} onAddProduct={addProduct} onRestock={restock} onUpdateProduct={updateProduct} onDeleteProduct={deleteProduct} onExit={() => setIsAdmin(false)} />;
  return <main className="app-shell"><section className="app-content">{tab === 'home' && <Home student={student} recentLog={myLogs[0]} frequentProduct={frequentProduct} recommendations={recommendations} onLogin={login} onLogout={logout} onChangePassword={changePassword} onAddRecommendation={addRecommendation} onToggleRecommendation={toggleRecommendation} onOpenPurchase={() => setTab('purchase')} onEnterAdmin={() => setIsAdmin(true)} />}{tab === 'purchase' && <Scanner student={student} products={products} onSave={savePurchase} onToggleLike={toggleLike} />}{tab === 'logs' && <MyLogs logs={myLogs} isLoading={false} />}</section><BottomNav activeTab={tab} onChange={setTab} /></main>;
}
