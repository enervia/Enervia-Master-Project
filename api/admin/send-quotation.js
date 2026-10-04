import nodemailer from "nodemailer";
import { getRfq } from "../../lib/supabase.js";
import { requestCustomerData } from "../../lib/supabase-customer.js";
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {rfqId}=req.body||{};if(!rfqId)return res.status(400).json({ok:false,error:"RFQ ID is required."});
 try{
  const rfq=await getRfq(String(rfqId));if(!rfq)return res.status(404).json({ok:false,error:"RFQ not found."});
  const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  const rows=await requestCustomerData(base+"/rest/v1/quotations?rfq_id=eq."+encodeURIComponent(rfqId)+"&limit=1",{base,key});const q=rows?.[0];if(!q)return res.status(404).json({ok:false,error:"Quotation record not found."});
  if(q.status==="ACCEPTED")return res.status(400).json({ok:false,error:"Quotation has already been accepted."});
  const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST||"mail.privateemail.com",port:Number(process.env.SMTP_PORT||465),secure:String(process.env.SMTP_SECURE||"true")==="true",auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:10000});
  const lines=(rfq.items||[]).map(i=>{const t=(Number(i.quantity)||0)*(Number(i.selling_price)||0);return "<tr><td>"+i.description+"</td><td>"+i.quantity+" "+i.unit+"</td><td>"+Number(i.selling_price||0).toFixed(2)+"</td><td>"+t.toFixed(2)+"</td></tr>"}).join("");
  const html="<h2>Enervia Quotation "+q.quote_no+"</h2><p>Dear "+(rfq.contact_name||"Customer")+",</p><p>Please find your quotation for RFQ <b>"+rfq.rfq_id+"</b>.</p><table border='1' cellpadding='8' cellspacing='0'><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>"+lines+"</table><p><b>Grand Total: "+Number(q.grand_total||0).toFixed(2)+" "+(q.currency||rfq.currency||"AZN")+"</b></p><p>Validity: "+(q.valid_until||"—")+"</p><p>You can accept or ignore this quotation from your Enervia Customer Portal.</p>";
  await transporter.sendMail({from:"Enervia <"+process.env.SMTP_USER+">",to:rfq.email,subject:"Quotation "+q.quote_no+" | RFQ "+rfq.rfq_id,html});
  const now=new Date().toISOString();
  const updated=await requestCustomerData(base+"/rest/v1/quotations?id=eq."+encodeURIComponent(q.id),{base,key,method:"PATCH",body:JSON.stringify({status:"SENT",sent_at:now,updated_at:now})});
  await requestCustomerData(base+"/rest/v1/quotation_events",{base,key,method:"POST",body:JSON.stringify({quotation_id:q.id,event_type:"SENT",note:"Quotation sent to customer."})});
  return res.status(200).json({ok:true,quotation:updated?.[0]||null});
 }catch(e){console.error("Send quotation error",e);return res.status(500).json({ok:false,error:"Unable to send quotation."})}
}