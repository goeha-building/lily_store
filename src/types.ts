export interface Student {
  studentId: string;
  passwordHash?: string;
  googleUid?: string;
  mustChangePassword?: boolean;
}

export interface PurchaseLog {
  id: string;
  productId?: string;
  productName: string;
  category: string;
  price?: number;
  timestamp: Date;
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
