import axiosClient from '../api/axiosClient';

export const productionService = {
  async recordRun(runData) {
    const { data } = await axiosClient.post('/production', runData);
    return data;
  }
};