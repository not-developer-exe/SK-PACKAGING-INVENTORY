import axiosClient from '../api/axiosClient';

export const conversionService = {
  async getAvailableSheets() {
    const { data } = await axiosClient.get('/conversion/sheets');
    return data.sheets;
  },
  async getFinishedGoods(params = {}) {
    const { data } = await axiosClient.get('/conversion/finished-goods', { params });
    return data.finishedGoods;
  },
  async recordConversion(payload) {
    const { data } = await axiosClient.post('/conversion', payload);
    return data;
  }
};