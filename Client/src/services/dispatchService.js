import axiosClient from "../api/axiosClient";

export const dispatchService = {
  async getAvailableBoxes() {
    const { data } = await axiosClient.get("/dispatch/boxes");
    return data.boxes;
  },
  async getDispatches() {
    const { data } = await axiosClient.get("/dispatch");
    return data.dispatches;
  },
  async recordDispatch(payload) {
    const { data } = await axiosClient.post("/dispatch", payload);
    return data;
  },
};
