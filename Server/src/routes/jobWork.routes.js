const express=require('express');
const router=express.Router();
const {protect}=require('../middlewares/auth.middleware');
const {listOrders,issueToJobWorker,receiveFromJobWorker}=require('../controllers/jobWork.controller');
router.use(protect);
router.get('/',listOrders);
router.post('/issue',issueToJobWorker);
router.post('/return',receiveFromJobWorker);
module.exports=router;
