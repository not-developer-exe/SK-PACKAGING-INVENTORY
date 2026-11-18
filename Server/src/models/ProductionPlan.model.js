const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');
const productionPlanSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
 planNumber:{type:String,required:true,unique:true,trim:true},
 customerId:{type:mongoose.Schema.Types.ObjectId,ref:'Party',required:true,index:true},
 productSpecificationId:{type:mongoose.Schema.Types.ObjectId,ref:'ProductSpecification',default:null},
 itemName:{type:String,required:true,trim:true,maxlength:120},
 dimensions:{length:Number,width:Number,height:Number},
 plannedBoxes:{type:Number,required:true,min:1},
 completedBoxes:{type:Number,default:0,min:0},
 dueDate:{type:Date,required:true},
 assignedMachine:{type:String,trim:true,maxlength:100},
 shift:{type:String,enum:['Day','Night','Any'],default:'Any'},
 operatorName:{type:String,trim:true,maxlength:100},
 notes:{type:String,trim:true,maxlength:500},
 status:{type:String,enum:['planned','in_progress','completed','cancelled'],default:'planned',index:true},
 createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
 updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}
},{timestamps:true});
productionPlanSchema.index({dueDate:1,status:1});
module.exports=mongoose.model('ProductionPlan',productionPlanSchema);