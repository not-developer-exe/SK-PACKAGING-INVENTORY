const mongoose = require('mongoose');
const JobWorkOrder = require('../models/JobWorkOrder.model');
const FacingMaterialBatch = require('../models/FacingMaterialBatch.model');
const CutSheetBatch = require('../models/CutSheetBatch.model');
const StockMovement = require('../models/StockMovement.model');
const Sequence = require('../models/Sequence.model');
const writeAuditLog = require('../utils/writeAuditLog');
const { summarizeJobWorkOrders } = require('../utils/jobWorkReconciliation');
const num = v => Number(v?.toString?.() ?? v ?? 0);
const dec = v => mongoose.Types.Decimal128.fromString(Number(v).toFixed(3));
const dateOnly = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(new Date(v + 'T00:00:00+05:30').getTime());


exports.getProcessorReconciliation = async (req,res) => {
  try {
    const filter = {};
    if (req.query.from || req.query.to) {
      if ((req.query.from && !dateOnly(req.query.from)) || (req.query.to && !dateOnly(req.query.to))) {
        return res.status(400).json({message:'Date filters must use YYYY-MM-DD.'});
      }
      filter.issueDate = {};
      if (req.query.from) filter.issueDate.$gte = new Date(req.query.from+'T00:00:00+05:30');
      if (req.query.to) filter.issueDate.$lte = new Date(req.query.to+'T23:59:59.999+05:30');
    }
    const orders = await JobWorkOrder.find(filter).sort({issueDate:-1}).lean();
    const { processors, totals } = summarizeJobWorkOrders(orders);
    return res.json({processors,totals});
  } catch(e) {
    return res.status(500).json({message:'Unable to build processor reconciliation.'});
  }
};

exports.listOrders = async (req,res) => {
  try {
    const orders = await JobWorkOrder.find().populate('inputBatchId','batchNumber materialType').populate('returns.outputBatchId','batchNumber').sort({issueDate:-1,createdAt:-1}).limit(1000).lean();
    const [facingBatches, cutSheetBatches] = await Promise.all([
      FacingMaterialBatch.find({status:{$in:['available','partial']},remainingSheets:{$gt:0}}).sort({inwardDate:-1}).limit(1000).lean(),
      CutSheetBatch.find({status:{$in:['available','partially_used']},remainingSheets:{$gt:0}}).sort({cutDate:-1}).limit(1000).lean()
    ]);
    return res.json({orders,facingBatches,cutSheetBatches});
  } catch(e) { return res.status(500).json({message:'Unable to fetch job-work register.'}); }
};

exports.issueToJobWorker = async (req,res) => {
  const {jobWorkerName,processType,inputBatchId,inputBatchModel='FacingMaterialBatch',inputMaterialType='duplex',issueDate,expectedReturnDate,issuedSheets,notes=''}=req.body||{};
  const sheets=Number(issuedSheets);
  if(!String(jobWorkerName||'').trim() || String(jobWorkerName).trim().length>160 ||
    !['offset_printing','lamination','other'].includes(processType) ||
    !['FacingMaterialBatch','CutSheetBatch'].includes(inputBatchModel) || (inputBatchModel==='CutSheetBatch' && !['printed','printed_laminated','khaki','duplex'].includes(inputMaterialType)) || !mongoose.isValidObjectId(inputBatchId) ||
    !dateOnly(issueDate) || !Number.isInteger(sheets) || sheets<=0 ||
    (expectedReturnDate && !dateOnly(expectedReturnDate))) return res.status(400).json({message:'Enter job-worker, process, valid source batch, issue date and positive whole sheet quantity.'});
  const Model=inputBatchModel==='CutSheetBatch'?CutSheetBatch:FacingMaterialBatch;
  const session=await mongoose.startSession();
  try {
    let order;
    await session.withTransaction(async()=>{
      const batch=await Model.findById(inputBatchId).session(session);
      const available=batch ? (inputBatchModel==='CutSheetBatch'?['available','partially_used'].includes(batch.status):['available','partial'].includes(batch.status)) : false;
      const balanceSheets=batch?.remainingSheets;
      if(!batch||!available||balanceSheets<sheets){const e=new Error('Selected source batch has insufficient available sheets.');e.statusCode=409;throw e;}
      const weight=num(batch.remainingWeightKg)*sheets/balanceSheets;
      const remainingSheets=balanceSheets-sheets;
      const remainingWeight=Math.max(0,Number((num(batch.remainingWeightKg)-weight).toFixed(3)));
      batch.remainingSheets=remainingSheets;
      batch.remainingWeightKg=dec(remainingWeight);
      batch.status=remainingSheets===0?'consumed':(inputBatchModel==='CutSheetBatch'?'partially_used':'partial');
      await batch.save({session});
      const costRate=inputBatchModel==='CutSheetBatch'?num(batch.unitCostPerKg):num(batch.ratePerKg);
      const inputMaterialCost=Number((weight*costRate).toFixed(2));
      const count=await JobWorkOrder.countDocuments().session(session);
      const seq=await Sequence.findOneAndUpdate({_id:'job-work'},[{$set:{value:{$add:[{$max:[{$ifNull:['$value',count]},count]},1]}}}],{new:true,upsert:true,session,updatePipeline:true});
      const orderNumber='JW-'+String(seq.value).padStart(6,'0');
      const [created]=await JobWorkOrder.create([{
        companyKey:req.companyKey||'sk-packaging',orderNumber,jobWorkerName:String(jobWorkerName).trim(),processType,
        inputBatchModel,inputItemType:inputBatchModel==='CutSheetBatch'?'cut_sheet':'facing_material',
        inputBatchId:batch._id,inputMaterialCost,
        materialType:inputBatchModel==='CutSheetBatch'?inputMaterialType:batch.materialType,
        lengthInches:batch.lengthInches,widthInches:batch.widthInches,
        issuedSheets:sheets,issuedWeightKg:Number(weight.toFixed(3)),issueDate:new Date(issueDate+'T00:00:00+05:30'),
        expectedReturnDate:expectedReturnDate?new Date(expectedReturnDate+'T00:00:00+05:30'):undefined,
        notes:String(notes).slice(0,1000),recordedBy:req.user?._id
      }],{session});
      await StockMovement.create([{companyKey:req.companyKey||'sk-packaging',movementDate:created.issueDate,movementType:'job_work_issue',referenceId:created._id,referenceModel:'JobWorkOrder',itemType:created.inputItemType==='cut_sheet'?'sheet':'facing_material',specificationSummary:created.materialType+' '+created.lengthInches+'x'+created.widthInches,quantityChange:-sheets,weightChangeKg:dec(-weight),notes:'Issued to '+jobWorkerName+' ('+orderNumber+')',performedBy:req.user?._id}],{session});
      await writeAuditLog(req,{action:'job_work.issued',entityType:'JobWorkOrder',entityId:created._id,entityLabel:orderNumber,summary:'Issued '+sheets+' sheets to '+jobWorkerName,metadata:{issuedSheets:sheets,issuedWeightKg:weight,processType,inputBatchModel,inputMaterialCost}},session);
      order=created;
    });
    return res.status(201).json({order});
  } catch(e) {return res.status(e.statusCode||500).json({message:e.statusCode?e.message:'Job-work issue failed; stock was not changed.'});}
  finally{await session.endSession();}
};

exports.receiveFromJobWorker = async(req,res)=>{
  const {orderId,returnDate,sheetsReturned,weightReturnedKg,wastageSheets=0,wastageWeightKg=0,jobCharges=0,outputMaterialType,notes=''}=req.body||{};
  const sheets=Number(sheetsReturned),weight=Number(weightReturnedKg),wSheets=Number(wastageSheets),wWeight=Number(wastageWeightKg),charges=Number(jobCharges);
  if(!mongoose.isValidObjectId(orderId)||!dateOnly(returnDate)||!Number.isInteger(sheets)||sheets<=0||
    !Number.isFinite(weight)||weight<=0||!Number.isInteger(wSheets)||wSheets<0||!Number.isFinite(wWeight)||wWeight<0||
    !Number.isFinite(charges)||charges<0||!['printed','printed_laminated','khaki','duplex'].includes(outputMaterialType))
    return res.status(400).json({message:'Enter valid return date, returned sheets/weight, wastage, charges and output material type.'});
  const session=await mongoose.startSession();
  try{
    let result;
    await session.withTransaction(async()=>{
      const order=await JobWorkOrder.findById(orderId).session(session);
      if(!order||['completed','cancelled'].includes(order.status)){const e=new Error('Job-work order is not open for returns.');e.statusCode=409;throw e;}
      if(order.returnedSheets+sheets+wSheets>order.issuedSheets){const e=new Error('Returned plus wastage sheets exceed the quantity issued.');e.statusCode=409;throw e;}
      // Allocate source material cost by sheet count, not returned kg: printing/lamination can add weight.
      const allocatedMaterialCost=Number((order.inputMaterialCost*sheets/order.issuedSheets).toFixed(2));
      const allocatedWastageMaterialCost=Number((order.inputMaterialCost*wSheets/order.issuedSheets).toFixed(2));
      const allocatedJobCharges=charges;
      const batchRate=Number(((allocatedMaterialCost+allocatedJobCharges)/weight).toFixed(4));
      const [batch]=await FacingMaterialBatch.create([{
        companyKey:req.companyKey||'sk-packaging',batchNumber:'JWR-'+order.orderNumber+'-'+String(order.returns.length+1).padStart(2,'0'),
        materialType:outputMaterialType,lengthInches:order.lengthInches,widthInches:order.widthInches,
        sheetCount:sheets,receivedWeightKg:dec(weight),remainingWeightKg:dec(weight),remainingSheets:sheets,
        ratePerKg:dec(batchRate),totalValue:dec(allocatedMaterialCost+allocatedJobCharges),supplierName:'',
        jobWorkerName:order.jobWorkerName,jobWorkOrderId:order._id,
        inwardDate:new Date(returnDate+'T00:00:00+05:30'),notes:'Returned from '+order.jobWorkerName+'; '+String(notes).slice(0,400),recordedBy:req.user?._id
      }],{session});
      order.returnedSheets+=sheets;order.returnedWeightKg=Number((order.returnedWeightKg+weight).toFixed(3));
      order.allocatedInputMaterialCost=Number((num(order.allocatedInputMaterialCost)+allocatedMaterialCost).toFixed(2));
      order.allocatedWastageMaterialCost=Number((num(order.allocatedWastageMaterialCost)+allocatedWastageMaterialCost).toFixed(2));
      order.wastageSheets+=wSheets;order.wastageWeightKg=Number((order.wastageWeightKg+wWeight).toFixed(3));order.jobCharges+=charges;
      order.returns.push({returnDate:new Date(returnDate+'T00:00:00+05:30'),sheets,weightKg:weight,wastageSheets:wSheets,wastageWeightKg:wWeight,charges,allocatedMaterialCost,allocatedJobCharges,allocatedWastageMaterialCost,outputBatchId:batch._id,notes:String(notes).slice(0,500)});
      order.status=order.returnedSheets+order.wastageSheets===order.issuedSheets?'completed':'partial_return';
      await order.save({session});
      await StockMovement.create([{companyKey:req.companyKey||'sk-packaging',movementDate:new Date(returnDate+'T00:00:00+05:30'),movementType:'job_work_return',referenceId:order._id,referenceModel:'JobWorkOrder',itemType:'facing_material',specificationSummary:outputMaterialType+' '+order.lengthInches+'x'+order.widthInches,quantityChange:sheets,weightChangeKg:dec(weight),notes:'Returned by '+order.jobWorkerName+' as '+batch.batchNumber,performedBy:req.user?._id}],{session});
      await writeAuditLog(req,{action:'job_work.returned',entityType:'JobWorkOrder',entityId:order._id,entityLabel:order.orderNumber,summary:'Received '+sheets+' processed sheets from '+order.jobWorkerName,metadata:{sheets,weight,wSheets,wWeight,charges,allocatedMaterialCost,allocatedJobCharges,allocatedWastageMaterialCost,batchNumber:batch.batchNumber,batchRate}},session);
      result={order,batch};
    });
    return res.status(201).json(result);
  }catch(e){return res.status(e.statusCode||500).json({message:e.statusCode?e.message:'Job-work return failed; no stock was committed.'});}
  finally{await session.endSession();}
};
