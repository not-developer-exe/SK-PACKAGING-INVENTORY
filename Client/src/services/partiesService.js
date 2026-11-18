import axiosClient from '../api/axiosClient';

// The API currently returns the active party list as a bare JSON array.
// Accept both that canonical shape and the wrapped shapes used by older deployments.
const normalizePartyList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.parties)) return payload.parties;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const partiesService = {
  async getAllParties() {
    const { data } = await axiosClient.get('/parties?type=all');
    return normalizePartyList(data);
  },
  async getSuppliers() {
    const { data } = await axiosClient.get('/parties?type=supplier');
    return normalizePartyList(data);
  },
  async getCustomers() {
    const { data } = await axiosClient.get('/parties?type=customer');
    return normalizePartyList(data);
  },
  async createParty(partyData) {
    const { data } = await axiosClient.post('/parties', partyData);
    return data;
  }
};
