import axiosClient from '../api/axiosClient';

export const wasteService = {
  async getWasteData(params = {}) {
    const { data } = await axiosClient.get('/waste', { params });
    return data;
  },
  async recordSale(saleData) {
    const { data } = await axiosClient.post('/waste/sale', saleData);
    return data;
  }
};