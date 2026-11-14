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
  async cancelDispatch(id, reason) {\n    const { data } = await axiosClient.patch(`/dispatch/${id}/cancel`, { reason });\n    return data;\n  },\n  async recordDispatch(payload) {
    const { data } = await axiosClient.post("/dispatch", payload);
    return data;
  },
};
