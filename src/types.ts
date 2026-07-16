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
}

export interface DashboardStats {
  userCount: number;
  categoryCounts: Record<string, number>;
  topProducts: Array<{ name: string; count: number }>;
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
