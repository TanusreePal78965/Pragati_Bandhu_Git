import { create } from 'zustand';
import client from '../api/client';

const useProductStore = create((set, get) => ({
  products: [],
  isLoading: false,
  error: null,

  fetchProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      // For now, this is a mock or would point to your future /api/products route
      // const response = await client.get('/api/products');
      // set({ products: response.data, isLoading: false });
      
      // Mock data for initial testing:
      set({ 
        products: [
          { id: '1', name: 'Dettol 500ml', stock: 15, category: 'Personal Care' },
          { id: '2', name: 'Maggi 2min Noodles', stock: 8, category: 'Food' },
        ], 
        isLoading: false 
      });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  addProduct: (product) => set((state) => ({ products: [...state.products, product] })),

  updateStock: (id, newStock) => set((state) => ({
    products: state.products.map((p) => p.id === id ? { ...p, stock: newStock } : p)
  })),
}));

export default useProductStore;
