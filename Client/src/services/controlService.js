import axiosClient from '../api/axiosClient';

export const controlService = {
  async getOpeningStock() {
    const { data } = await axiosClient.get('/controls/opening-stock');
    return data.adjustments || [];
  },
  async createOpeningStock(payload) {
    const { data } = await axiosClient.post('/controls/opening-stock', payload);
    return data;
  },
  async getAuditLogs() {
    const { data } = await axiosClient.get('/controls/audit');
    return data.logs || [];
  }
};
