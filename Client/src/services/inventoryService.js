import axiosClient from '../api/axiosClient';

export const inventoryService = {
  async getReelStock() {
    const { data } = await axiosClient.get('/inventory/reels');
    return data.stock;
  },
  // Add this:
  async getPhysicalReels() {
    const { data } = await axiosClient.get('/inventory/reels/physical');
    return data.reels;
  }
};