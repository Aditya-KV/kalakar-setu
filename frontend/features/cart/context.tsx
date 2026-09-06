import React, { createContext, useContext, useState, useMemo } from 'react';

export interface CartItem {
  listingId: string;
  titleEn: string;
  titleHi: string;
  titleMr?: string | null;
  price: number;
  imageUrl: string | null;
  sellerId: string;
  sellerName: string;
  quantityAvailable: number;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (listingId: string) => void;
  updateQuantity: (listingId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem: CartContextType['addItem'] = (item, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.listingId === item.listingId);
      if (existing) {
        return prev.map((i) =>
          i.listingId === item.listingId
            ? { ...i, quantity: Math.min(i.quantity + quantity, i.quantityAvailable) }
            : i
        );
      }
      return [...prev, { ...item, quantity: Math.min(quantity, item.quantityAvailable) }];
    });
  };

  const removeItem = (listingId: string) => {
    setItems((prev) => prev.filter((i) => i.listingId !== listingId));
  };

  const updateQuantity = (listingId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(listingId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.listingId === listingId ? { ...i, quantity: Math.min(quantity, i.quantityAvailable) } : i
      )
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
