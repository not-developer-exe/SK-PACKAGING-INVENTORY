import axiosClient from '../api/axiosClient';
export const pastingService = {
  async getFacingMaterial() { const { data } = await axiosClient.get('/pasting/facing-material'); return data.batches || []; },
  async receiveFacingMaterial(payload) { const { data } = await axiosClient.post('/pasting/facing-material', payload); return data.batch; },
  async getPastingRuns() { const { data } = await axiosClient.get('/pasting/runs'); return data.runs || []; },
  async recordPasting(payload) { const { data } = await axiosClient.post('/pasting/runs', payload); return data; }
};
