import axiosClient from '../api/axiosClient';

export const dashboardService = {
  async getStats() {
    const { data } = await axiosClient.get('/dashboard/stats');
    return data;
  }
};