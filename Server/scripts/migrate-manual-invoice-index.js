require('dotenv').config();
const mongoose = require('mongoose');
async function migrate() {
 if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
 await mongoose.connect(process.env.MONGODB_URI);
 const collection=mongoose.connection.collection('invoices');
 const indexes=await collection.indexes();
 if(indexes.some(x=>x.name==='dispatchId_1')){
  const duplicates=await collection.aggregate([{ $match:{dispatchId:{ $type:'objectId' }}},{ $group:{_id:'$dispatchId',count:{ $sum:1 }}},{ $match:{count:{ $gt:1 }}},{ $limit:1 }]).toArray();
  if(duplicates.length) throw new Error('Duplicate challan-linked invoices exist. Resolve before migration.');
  await collection.dropIndex('dispatchId_1');
 }
 await collection.createIndex({dispatchId:1},{name:'dispatchId_1',unique:true,partialFilterExpression:{dispatchId:{ $type:'objectId' }}});
 console.info('Manual invoice index migration complete.');
}
migrate().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>mongoose.disconnect());
