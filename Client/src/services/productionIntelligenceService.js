import axiosClient from '../api/axiosClient';
export const productionIntelligenceService={
 async getPlans(params={}){const {data}=await axiosClient.get('/production-plans',{params});return data.plans||[];},
 async createPlan(payload){const {data}=await axiosClient.post('/production-plans',payload);return data.plan;},
 async updatePlanStatus(id,status){const {data}=await axiosClient.patch('/production-plans/'+id+'/status',{status});return data.plan;},
 async getPerformance(params={}){const {data}=await axiosClient.get('/production-intelligence/performance',{params});return data;},
 async trace(batchNumber){const {data}=await axiosClient.get('/production-intelligence/trace',{params:{batchNumber}});return data.trace;}
};