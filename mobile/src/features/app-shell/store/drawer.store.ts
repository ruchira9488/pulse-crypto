import { create } from 'zustand';

interface DrawerState {
  visible: boolean;
  open: () => void;
  close: () => void;
}

export const useDrawer = create<DrawerState>()((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));
