import axiosClient from '../api/axiosClient';

export const partiesService = {
  async getSuppliers() {
    const { data } = await axiosClient.get('/parties?type=supplier');
    return data.parties;
  }
};