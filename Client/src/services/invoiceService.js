import axios from 'axios';

const API_URL = 'http://localhost:5000/api/invoices/'; // Adjust if your port differs

export const invoiceService = {
  createInvoice: async (invoiceData) => {
    const response = await axios.post(API_URL, invoiceData);
    return response.data;
  },
  
  getInvoices: async () => {
    const response = await axios.get(API_URL);
    return response.data;
  },

  getUninvoicedDispatches: async (customerId) => {
    const response = await axios.get(`${API_URL}uninvoiced/${customerId}`);
    return response.data;
  }
};