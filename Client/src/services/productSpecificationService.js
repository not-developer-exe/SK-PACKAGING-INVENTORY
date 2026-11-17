import axiosClient from '../api/axiosClient';

export const productSpecificationService = {
  async getAll(params = {}) {
    const { data } = await axiosClient.get('/product-specifications', { params });
    return data.products || [];
  },
  async create(payload) {
    const { data } = await axiosClient.post('/product-specifications', payload);
    return data.product;
  },
  async update(id, payload) {
    const { data } = await axiosClient.patch('/product-specifications/' + id, payload);
    return data.product;
  },
  async archive(id) {
    const { data } = await axiosClient.delete('/product-specifications/' + id);
    return data;
  }
};
