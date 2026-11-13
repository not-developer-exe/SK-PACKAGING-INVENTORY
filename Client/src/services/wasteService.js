import axiosClient from '../api/axiosClient';

export const wasteService = {
  async getWasteData() {
    const { data } = await axiosClient.get('/waste');
    return data;
  },
  async recordSale(saleData) {
    const { data } = await axiosClient.post('/waste/sale', saleData);
    return data;
  }
};