function headers(key,extra={}){return {apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=representation",...extra}}
export async function requestCustomerData(url,{base,key,method="GET",body}){
 const r=await fetch(url,{method,headers:headers(key),body});
 const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}
 if(!r.ok)throw new Error(typeof data==="object"&&data?.message?data.message:String(raw||r.statusText));
 return data;
}
export async function insertCustomerCompany(company){
 const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
 const rows=await requestCustomerData(base+"/rest/v1/customer_companies",{base,key,method:"POST",body:JSON.stringify({legal_name:company.legalName,tax_id:company.taxId||null,industry:company.industry||null,phone:company.phone||null,email:company.email||null,website:company.website||null,address:company.address||null,city:company.city||null,country:company.country||"Azerbaijan"})});
 return rows?.[0];
}
export async function insertCustomerProfile(profile){
 const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
 const rows=await requestCustomerData(base+"/rest/v1/customer_profiles",{base,key,method:"POST",body:JSON.stringify({user_id:profile.userId,company_id:profile.companyId,full_name:profile.fullName,phone:profile.phone||null,role:profile.role||"OWNER"})});
 return rows?.[0];
}