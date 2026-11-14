import axiosClient from '../api/axiosClient';

export const ledgerService = {
  async getLedger(params = {}) {
    const { data } = await axiosClient.get('/ledger', { params });
    return data.movements;
  }
};