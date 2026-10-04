import crypto from "crypto";
import nodemailer from "nodemailer";
import { updateRfqStatus, getRfq, createQuotationFromRfq, updateRfqPricing, listRfqs, getWipCounts } from "./supabase.js";
import { requestCustomerData } from "./supabase-customer.js";

export async function approveQuotation(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {rfqId}=req.body||{}; if(!rfqId)return res.status(400).json({ok:false,error:"RFQ ID is required."});
 try{const current=await getRfq(String(rfqId));if(!current)return res.status(404).json({ok:false,error:"RFQ not found."});if(current.status!=="PENDING_APPROVAL")return res.status(400).json({ok:false,error:"RFQ must be PENDING_APPROVAL before quotation approval."});const quotation=await createQuotationFromRfq(String(rfqId));const rfq=await updateRfqStatus(String(rfqId),"QUOTED","admin");return res.status(200).json({ok:true,rfq,quotation});}
 catch(e){console.error("Quotation approval error",e);return res.status(500).json({ok:false,error:"Unable to approve quotation."})}
}
export async function customerStatus(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {companyId,status}=req.body||{}; const allowed=["PENDING","ACTIVE","SUSPENDED"];
 if(!companyId||!allowed.includes(status))return res.status(400).json({ok:false,error:"Invalid customer status."});
 try{const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");const rows=await requestCustomerData(base+"/rest/v1/customer_companies?id=eq."+encodeURIComponent(companyId),{base,key,method:"PATCH",body:JSON.stringify({status,updated_at:new Date().toISOString()})});if(!rows?.[0])return res.status(404).json({ok:false,error:"Customer not found."});return res.status(200).json({ok:true,customer:rows[0]});}
 catch(e){console.error("Customer status error",e);return res.status(500).json({ok:false,error:"Unable to update customer status."})}
}
export async function customers(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");const companies=await requestCustomerData(base+"/rest/v1/customer_companies?order=created_at.desc",{base,key});return res.status(200).json({ok:true,customers:companies||[]});}
 catch(e){console.error("Customer list error",e);return res.status(500).json({ok:false,error:"Unable to load customers."})}
}
function b64(value){return Buffer.from(value).toString("base64url")}
function sign(value,secret){return crypto.createHmac("sha256",secret).update(value).digest("base64url")}
function readBody(req){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>10000)reject(new Error("Body too large"))});req.on("end",()=>{try{resolve(JSON.parse(raw||"{}"))}catch{resolve({})}});req.on("error",reject)})}
export async function login(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const password=String(process.env.ADMIN_PASSWORD||""),secret=String(process.env.ADMIN_SESSION_SECRET||"");
 if(!password||!secret)return res.status(503).json({ok:false,error:"Admin authentication is not configured yet."});
 try{const body=await readBody(req),supplied=String(body.password||""),a=Buffer.from(supplied),b=Buffer.from(password);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({ok:false,error:"Invalid password."});const now=Math.floor(Date.now()/1000),payload=JSON.stringify({iat:now,exp:now+60*60*8}),encoded=b64(payload),token=encoded+"."+sign(encoded,secret);res.setHeader("Set-Cookie",`enervia_admin=${token}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`);return res.status(200).json({ok:true});}
 catch(e){console.error("Admin login error",e);return res.status(400).json({ok:false,error:"Invalid login request."})}
}
export async function logout(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 res.setHeader("Set-Cookie","enervia_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict");return res.status(200).json({ok:true});
}
export async function quotation(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 const id=String(req.query?.rfqId||"");if(!id)return res.status(400).json({ok:false,error:"RFQ ID is required."});
 try{const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||""),rows=await requestCustomerData(base+"/rest/v1/quotations?rfq_id=eq."+encodeURIComponent(id)+"&limit=1",{base,key}),q=rows?.[0]||null;if(!q)return res.status(200).json({ok:true,quotation:null,actions:[]});const actions=await requestCustomerData(base+"/rest/v1/customer_rfq_actions?rfq_id=eq."+encodeURIComponent(id)+"&order=created_at.desc",{base,key});return res.status(200).json({ok:true,quotation:q,actions:actions||[]});}
 catch(e){console.error("Quotation lookup error",e);return res.status(500).json({ok:false,error:"Unable to load quotation."})}
}
export async function rfqPricing(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {rfqId,defaultMarkupPercent,items}=req.body||{};if(!rfqId)return res.status(400).json({ok:false,error:"RFQ ID is required."});const markup=Number(defaultMarkupPercent);if(!Number.isFinite(markup)||markup<0||markup>1000)return res.status(400).json({ok:false,error:"Invalid markup percent."});
 try{const rfq=await updateRfqPricing(String(rfqId),markup,Array.isArray(items)?items:[]);if(!rfq)return res.status(404).json({ok:false,error:"RFQ not found."});return res.status(200).json({ok:true,rfq});}
 catch(e){console.error("RFQ pricing error",e);return res.status(500).json({ok:false,error:"Unable to update pricing."})}
}
export async function rfqStatus(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {rfqId,status,changedBy}=req.body||{},allowed=["NEW","REVIEW","SOURCING","PRICING","PENDING_APPROVAL","QUOTED","CLOSED"];if(!rfqId||!allowed.includes(status))return res.status(400).json({ok:false,error:"Invalid RFQ status update."});
 try{const rfq=await updateRfqStatus(String(rfqId),status,String(changedBy||"admin"));if(!rfq)return res.status(404).json({ok:false,error:"RFQ not found."});return res.status(200).json({ok:true,rfq})}
 catch(e){console.error("RFQ status update error",e);return res.status(500).json({ok:false,error:"Unable to update RFQ status."})}
}
export async function rfq(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 const rfqId=String(req.query?.id||"").trim();if(!rfqId)return res.status(400).json({ok:false,error:"RFQ ID is required."});
 try{const rfq=await getRfq(rfqId);if(!rfq)return res.status(404).json({ok:false,error:"RFQ not found."});return res.status(200).json({ok:true,rfq})}
 catch(e){console.error("RFQ detail error",e);return res.status(500).json({ok:false,error:"Unable to load RFQ."})}
}
export async function rfqs(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{const status=String(req.query?.status||"").trim();return res.status(200).json({ok:true,rfqs:await listRfqs(status)})}
 catch(e){console.error("RFQ list error",e);return res.status(500).json({ok:false,error:"Unable to load RFQs."})}
}
export async function sendQuotation(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {rfqId}=req.body||{};if(!rfqId)return res.status(400).json({ok:false,error:"RFQ ID is required."});
 try{
  const rfq=await getRfq(String(rfqId));if(!rfq)return res.status(404).json({ok:false,error:"RFQ not found."});
  const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||""),rows=await requestCustomerData(base+"/rest/v1/quotations?rfq_id=eq."+encodeURIComponent(rfqId)+"&limit=1",{base,key}),q=rows?.[0];if(!q)return res.status(404).json({ok:false,error:"Quotation record not found."});if(q.status==="ACCEPTED")return res.status(400).json({ok:false,error:"Quotation has already been accepted."});
  const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST||"mail.privateemail.com",port:Number(process.env.SMTP_PORT||465),secure:String(process.env.SMTP_SECURE||"true")==="true",auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:10000});
  const lines=(rfq.items||[]).map(i=>{const t=(Number(i.quantity)||0)*(Number(i.selling_price)||0);return "<tr><td>"+i.description+"</td><td>"+i.quantity+" "+i.unit+"</td><td>"+Number(i.selling_price||0).toFixed(2)+"</td><td>"+t.toFixed(2)+"</td></tr>"}).join("");
  const html="<h2>Enervia Quotation "+q.quote_no+"</h2><p>Dear "+(rfq.contact_name||"Customer")+",</p><p>Please find your quotation for RFQ <b>"+rfq.rfq_id+"</b>.</p><table border='1' cellpadding='8' cellspacing='0'><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>"+lines+"</table><p><b>Grand Total: "+Number(q.grand_total||0).toFixed(2)+" "+(q.currency||rfq.currency||"AZN")+"</b></p><p>Validity: "+(q.valid_until||"—")+"</p><p>You can accept or ignore this quotation from your Enervia Customer Portal.</p>";
  await transporter.sendMail({from:"Enervia <"+process.env.SMTP_USER+">",to:rfq.email,subject:"Quotation "+q.quote_no+" | RFQ "+rfq.rfq_id,html});
  const now=new Date().toISOString();const updated=await requestCustomerData(base+"/rest/v1/quotations?id=eq."+encodeURIComponent(q.id),{base,key,method:"PATCH",body:JSON.stringify({status:"SENT",sent_at:now,updated_at:now})});await requestCustomerData(base+"/rest/v1/quotation_events",{base,key,method:"POST",body:JSON.stringify({quotation_id:q.id,event_type:"SENT",note:"Quotation sent to customer."})});return res.status(200).json({ok:true,quotation:updated?.[0]||null});
 }catch(e){console.error("Send quotation error",e);return res.status(500).json({ok:false,error:"Unable to send quotation."})}
}
export async function wip(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{return res.status(200).json({ok:true,counts:await getWipCounts()})}catch(e){console.error("WIP error",e);return res.status(500).json({ok:false,error:"Unable to load WIP data."})}
}
