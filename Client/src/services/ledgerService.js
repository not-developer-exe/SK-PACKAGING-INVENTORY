import axiosClient from '../api/axiosClient';

export const ledgerService = {
  async getLedger() {
    const { data } = await axiosClient.get('/ledger');
    return data.movements;
  }
};