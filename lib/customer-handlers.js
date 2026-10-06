import { getCustomerContext } from "./customer-auth.js";
import { insertCustomerCompany, insertCustomerProfile } from "./supabase-customer.js";
import { requestCustomerData } from "./supabase-customer.js";
const PUBLISHABLE_KEY="sb_publishable_ycM2wXQ6fGdqUja3hiO6aw_ajU-7t-e";

export async function me(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{const ctx=await getCustomerContext(req,{requireActive:false});if(!ctx)return res.status(401).json({ok:false,error:"Authentication required."});return res.status(200).json({ok:true,user:{id:ctx.user.id,email:ctx.user.email},profile:ctx.profile,company:ctx.company,active:!ctx.inactive});}
 catch(e){console.error("Customer me error",e);return res.status(500).json({ok:false,error:"Unable to load customer profile."})}
}
export async function quotationDecision(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {quotationId,decision,reason,note}=req.body||{};if(!quotationId||!["ACCEPT","IGNORE"].includes(decision))return res.status(400).json({ok:false,error:"Invalid quotation decision."});if(decision==="IGNORE"&&!reason)return res.status(400).json({ok:false,error:"Please select a reason."});
 try{
  const ctx=await getCustomerContext(req);if(!ctx||ctx.inactive)return res.status(403).json({ok:false,error:"Customer account is not active."});
  const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||""),rows=await requestCustomerData(base+"/rest/v1/quotations?id=eq."+encodeURIComponent(quotationId)+"&customer_company_id=eq."+encodeURIComponent(ctx.company.id)+"&limit=1",{base,key}),q=rows?.[0];if(!q)return res.status(404).json({ok:false,error:"Quotation not found."});if(q.status!=="SENT")return res.status(400).json({ok:false,error:"Only sent quotations can be accepted or ignored."});
  const status=decision==="ACCEPT"?"ACCEPTED":"IGNORED",now=new Date().toISOString(),noteText=String(note||"").slice(0,2000);
  const updated=await requestCustomerData(base+"/rest/v1/quotations?id=eq."+encodeURIComponent(quotationId),{base,key,method:"PATCH",body:JSON.stringify({status,customer_decision_note:noteText,decided_at:now,updated_at:now})});
  await requestCustomerData(base+"/rest/v1/customer_rfq_actions",{base,key,method:"POST",body:JSON.stringify({rfq_id:q.rfq_id,user_id:ctx.user.id,action:decision==="ACCEPT"?"ACCEPT":"IGNORE",ignore_reason:decision==="IGNORE"?reason:null,note:noteText})});
  await requestCustomerData(base+"/rest/v1/quotation_events",{base,key,method:"POST",body:JSON.stringify({quotation_id:quotationId,event_type:status,user_id:ctx.user.id,note:noteText})});
  return res.status(200).json({ok:true,quotation:updated?.[0]||null});
 }catch(e){console.error("Customer quotation decision error",e);return res.status(500).json({ok:false,error:"Unable to save quotation decision."})}
}
export async function register(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {email,password,fullName,phone,company}=req.body||{};
 if(!email||!password||!fullName||!company?.legalName)return res.status(400).json({ok:false,error:"Name, email, password and company name are required."});
 if(String(password).length<8)return res.status(400).json({ok:false,error:"Password must be at least 8 characters."});
 try{
  const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,"");
  const normalizedEmail=String(email).trim().toLowerCase();
  if(!base||!String(process.env.SUPABASE_SERVICE_ROLE_KEY||""))throw new Error("Customer database configuration is missing.");
  const auth=await fetch(base+"/auth/v1/signup",{
   method:"POST",
   headers:{"Content-Type":"application/json",apikey:PUBLISHABLE_KEY},
   body:JSON.stringify({
    email:normalizedEmail,
    password:String(password),
    data:{full_name:String(fullName).trim()},
    email_redirect_to:"https://www.enervia.az/customer/login.html"
   })
  });
  const a=await auth.json();
  if(!auth.ok||!a.user)return res.status(auth.status===422?409:400).json({ok:false,error:a.msg||a.error_description||"Registration could not be completed."});
  let created;
  try{
   created=await insertCustomerCompany({...company,email:normalizedEmail,phone});
  }catch(e){
   console.error("Customer company creation error",e);
   return res.status(500).json({ok:false,error:"Account was created, but company registration failed. Please contact Enervia support."});
  }
  if(!created?.id)return res.status(500).json({ok:false,error:"Company registration failed: no company ID returned."});
  try{
   const profile=await insertCustomerProfile({userId:a.user.id,companyId:created.id,fullName:String(fullName).trim(),phone,role:"OWNER"});
   if(!profile?.user_id)return res.status(500).json({ok:false,error:"Customer profile registration failed."});
  }catch(e){
   console.error("Customer profile creation error",e);
   return res.status(500).json({ok:false,error:"Company was created, but customer profile registration failed. Please contact Enervia support."});
  }
  return res.status(200).json({ok:true,needsEmailConfirmation:!a.session,companyId:created.id});
 }catch(e){
  console.error("Customer registration error",e);
  return res.status(500).json({ok:false,error:"Registration failed. Please try again."});
 }
}
export async function rfqs(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{const ctx=await getCustomerContext(req);if(!ctx)return res.status(401).json({ok:false,error:"Authentication required."});if(ctx.inactive)return res.status(403).json({ok:false,error:"Customer account is awaiting approval."});const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||""),rfqs=await requestCustomerData(base+"/rest/v1/rfqs?customer_company_id=eq."+encodeURIComponent(ctx.company.id)+"&customer_visible=eq.true&order=submitted_at.desc",{base,key}),quotes=await requestCustomerData(base+"/rest/v1/quotations?customer_company_id=eq."+encodeURIComponent(ctx.company.id)+"&order=created_at.desc",{base,key});return res.status(200).json({ok:true,rfqs:rfqs||[],quotations:quotes||[]});}
 catch(e){console.error("Customer RFQ list error",e);return res.status(500).json({ok:false,error:"Unable to load customer requests."})}
}
