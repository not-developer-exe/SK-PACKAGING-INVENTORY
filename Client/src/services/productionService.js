import axiosClient from '../api/axiosClient';

export const productionService = {
  async getRuns(params = {}) {
    const { data } = await axiosClient.get('/production', { params });
    return data.runs;
  },
  async recordRun(runData) {
    const { data } = await axiosClient.post('/production', runData);
    return data;
  }
};