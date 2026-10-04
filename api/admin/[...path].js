import * as h from "../../lib/admin-handlers.js";
export default async function handler(req,res){
 const path=new URL(req.url,"https://enervia.local").pathname.replace(/^\/api\/admin\/?/,"").replace(/\/$/,"");
 const routes={login:h.login,logout:h.logout,customers:h.customers,"customer-status":h.customerStatus,rfqs:h.rfqs,rfq:h.rfq,"rfq-status":h.rfqStatus,"rfq-pricing":h.rfqPricing,wip:h.wip,"approve-quotation":h.approveQuotation,quotation:h.quotation,"send-quotation":h.sendQuotation};
 const fn=routes[path];
 if(!fn)return res.status(404).json({ok:false,error:"Admin API route not found."});
 return fn(req,res);
}
