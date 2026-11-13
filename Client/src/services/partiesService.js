import axiosClient from '../api/axiosClient';

export const partiesService = {
  async getAllParties() {
    const { data } = await axiosClient.get('/parties?type=all');
    return data.parties;
  },
  async getSuppliers() {
    const { data } = await axiosClient.get('/parties?type=supplier');
    return data.parties;
  },
  async getCustomers() {
    const { data } = await axiosClient.get('/parties?type=customer');
    return data.parties;
  },
  async createParty(partyData) {
    const { data } = await axiosClient.post('/parties', partyData);
    return data;
  }
};