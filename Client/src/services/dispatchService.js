import axiosClient from "../api/axiosClient";

export const dispatchService = {
  async getAvailableBoxes() {
    const { data } = await axiosClient.get("/dispatch/boxes");
    return data.boxes;
  },
  async getDispatches(params = {}) {
    const { data } = await axiosClient.get("/dispatch", { params });
    return data.dispatches;
  },
  async markDelivered(id, notes) {
    const { data } = await axiosClient.patch(`/dispatch/${id}/delivered`, { notes });
    return data;
  },
  async cancelDispatch(id, reason) {
    const { data } = await axiosClient.patch(`/dispatch/${id}/cancel`, { reason });
    return data;
  },
  async recordManualChallan(payload) {
    const { data } = await axiosClient.post("/dispatch/manual", payload);
    return data;
  },
  async recordDispatch(payload) {
    const { data } = await axiosClient.post("/dispatch", payload);
    return data;
  },
};
