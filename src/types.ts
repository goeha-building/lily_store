export interface Student {
  studentId: string;
  mustChangePassword?: boolean;
}

export interface StoredUser extends Student {
  passwordHash: string;
  createdAt: string;
}

export interface PurchaseLog {
  id: string;
  productId?: string;
  productName: string;
  category: string;
  price?: number;
  timestamp: Date;
  studentId?: string;
}

export interface Recommendation {
  id: string;
  name: string;
  supporters: string[];
  createdAt: Date;
  status?: 'pending' | 'completed';
}

export interface DashboardStats {
  userCount: number;
  todayPurchaseCount: number;
  weeklyPurchaseCount: number;
  topProducts: Array<{ name: string; count: number }>;
  categoryCounts: Array<{ category: string; count: number }>;
}

export interface TuckShopProduct {
  id: string;
  name: string;
  normalizedName: string;
  aliases: string[];
  searchTerms: string[];
  category: string;
  price: number;
  stockDate: Date;
  stockQuantity: number;
  currentStock: number;
  calories?: number;
  isActive: boolean;
  likedBy?: string[];
}

export interface ProductInput {
  name: string;
  aliasesText: string;
  category: string;
  price: number;
  stockDate: string;
  stockQuantity: number;
  calories?: number;
}

export type CouponStatus = 'active' | 'registered' | 'used' | 'expired' | 'disabled';

export interface Coupon {
  id: string;
  serialNumber: string;
  initialAmount: number;
  currentBalance: number;
  expiresAt: Date;
  isSplitable: boolean;
  status: CouponStatus;
  ownerUid?: string | null;
  registeredAt?: Date;
  createdAt?: Date;
}

export interface CouponTransaction {
  id: string;
  couponId: string;
  serialNumber: string;
  totalPrice: number;
  balanceAfter: number;
  createdAt: Date;
  items: Array<{ productName: string; quantity: number; totalPrice: number }>;
}
