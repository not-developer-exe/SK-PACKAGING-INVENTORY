import axiosClient from '../api/axiosClient';

export const productionService = {
  async getRuns() {\n    const { data } = await axiosClient.get('/production');\n    return data.runs;\n  },\n  async recordRun(runData) {
    const { data } = await axiosClient.post('/production', runData);
    return data;
  }
};