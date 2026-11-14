import axiosClient from '../api/axiosClient';

export const productionService = {
  async getRuns() {
    const { data } = await axiosClient.get('/production');
    return data.runs;
  },
  async recordRun(runData) {
    const { data } = await axiosClient.post('/production', runData);
    return data;
  }
};