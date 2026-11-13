import axiosClient from '../api/axiosClient';

const API_PATH = '/invoices/';

export const invoiceService = {
  createInvoice: async (invoiceData) => {
    const response = await axiosClient.post(API_PATH, invoiceData);
    return response.data;
  },

  getInvoices: async () => {
    const response = await axiosClient.get(API_PATH);
    return response.data;
  },

  getUninvoicedDispatches: async (customerId) => {
    const response = await axiosClient.get(`${API_PATH}uninvoiced/${encodeURIComponent(customerId)}`);
    return response.data;
  }
};
