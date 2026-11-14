import axiosClient from '../api/axiosClient';

export const inwardService = {
  async getReceipts(params = {}) {
    const { data } = await axiosClient.get('/inward', { params });
    return data.receipts;
  },

  async createDraft(receiptData) {
    const { data } = await axiosClient.post('/inward', receiptData);
    return data;
  },

  async postReceipt(id) {
    const { data } = await axiosClient.post(`/inward/${id}/post`);
    return data;
  }
};