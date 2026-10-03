function config() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/,"");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return { url, key };
}
async function request(path, options={}) {
  const {url,key}=config();
  const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=representation",...(options.headers||{})};
  const response=await fetch(url+"/rest/v1/"+path,{...options,headers});
  const raw=await response.text();
  let data; try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!response.ok) throw new Error(typeof data==="object"&&data?.message?data.message:String(raw||response.statusText));
  return data;
}
export async function insertRfq(record){
 const rows=await request("rfqs",{method:"POST",body:JSON.stringify({
  rfq_id:record.rfqId,version:record.version,status:record.status,submitted_at:record.submittedAt,
  language:record.language,company:record.company,contact_name:record.contactName,email:record.email,phone:record.phone,
  industry:record.industry,requirement_type:record.requirementType,project_name:record.projectName,
  delivery_location:record.deliveryLocation,required_by:record.requiredBy||null,currency:record.currency,
  priority:record.priority,details:record.details,attachment:record.attachment
 })});
 return rows?.[0]||null;
}
export async function listRfqs(status=""){
 const query=status?"rfqs?status=eq."+encodeURIComponent(status)+"&order=submitted_at.desc":"rfqs?order=submitted_at.desc";
 return await request(query,{method:"GET"});
}
export async function getRfq(rfqId){
 const rows=await request("rfqs?rfq_id=eq."+encodeURIComponent(rfqId)+"&limit=1",{method:"GET"});
 if(!rows?.[0]) return null;
 const items=await request("rfq_items?rfq_id=eq."+encodeURIComponent(rfqId)+"&order=line_no.asc",{method:"GET"});
 return {...rows[0],items:items||[]};
}
export async function updateRfqStatus(rfqId,status,changedBy="admin"){
 const current=await getRfq(rfqId); if(!current)return null;
 const rows=await request("rfqs?rfq_id=eq."+encodeURIComponent(rfqId),{method:"PATCH",body:JSON.stringify({status})});
 if(current.status!==status) await request("rfq_status_history",{method:"POST",body:JSON.stringify({rfq_id:rfqId,from_status:current.status,to_status:status,changed_by:changedBy})});
 return rows?.[0]||null;
}
export async function getWipCounts(){
 const rows=await request("rfqs?select=status",{method:"GET"});
 const counts={NEW:0,REVIEW:0,SOURCING:0,PRICING:0,PENDING_APPROVAL:0,QUOTED:0,CLOSED:0};
 for(const row of rows||[]) if(counts[row.status]!==undefined) counts[row.status]++;
 return counts;
}