const PUBLISHABLE_KEY = "sb_publishable_ycM2wXQ6fGdqUja3hiO6aw_ajU-7t-e";
export async function getCustomerContext(req,{requireActive=true}={}) {
  const header=String(req.headers.authorization||"");
  const token=header.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token) return null;
  const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,"");
  if(!base) throw new Error("Supabase URL is missing.");
  const userRes=await fetch(base+"/auth/v1/user",{headers:{apikey:PUBLISHABLE_KEY,Authorization:"Bearer "+token}});
  if(!userRes.ok) return null;
  const user=await userRes.json();
  if(!user?.id) return null;
  const profileRes=await fetch(base+"/rest/v1/customer_profiles?user_id=eq."+encodeURIComponent(user.id)+"&limit=1",{headers:{apikey:String(process.env.SUPABASE_SERVICE_ROLE_KEY),Authorization:"Bearer "+String(process.env.SUPABASE_SERVICE_ROLE_KEY)}});
  if(!profileRes.ok) throw new Error("Customer profile lookup failed.");
  const profiles=await profileRes.json();
  const profile=profiles?.[0];
  if(!profile) return null;
  const companyRes=await fetch(base+"/rest/v1/customer_companies?id=eq."+encodeURIComponent(profile.company_id)+"&limit=1",{headers:{apikey:String(process.env.SUPABASE_SERVICE_ROLE_KEY),Authorization:"Bearer "+String(process.env.SUPABASE_SERVICE_ROLE_KEY)}});
  if(!companyRes.ok) throw new Error("Customer company lookup failed.");
  const companies=await companyRes.json();
  const company=companies?.[0];
  if(!company) return null;
  if(requireActive && company.status!=="ACTIVE") return {user,profile,company,inactive:true};
  return {user,profile,company,inactive:false};
}
export const customerPublishableKey=PUBLISHABLE_KEY;
