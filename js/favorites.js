(function(){
  const table="favorites";
  let ids=new Set();
  async function client(){return window.ozziGetSupabase();}
  async function load(){const sb=await client();const {data:session}=await sb.auth.getSession();if(!session.session){ids=new Set();return ids;}const {data,error}=await sb.from(table).select("product_id").eq("user_id",session.session.user.id);if(error)throw error;ids=new Set((data||[]).map(x=>String(x.product_id)));return ids;}
  async function toggle(productId){const sb=await client();const {data:session}=await sb.auth.getSession();if(!session.session)throw new Error("LOGIN_REQUIRED");const uid=session.session.user.id;const exists=ids.has(String(productId));if(exists){const {error}=await sb.from(table).delete().eq("user_id",uid).eq("product_id",productId);if(error)throw error;ids.delete(String(productId));}else{const {error}=await sb.from(table).insert({user_id:uid,product_id:productId});if(error)throw error;ids.add(String(productId));}window.dispatchEvent(new CustomEvent("ozzi:favorites-changed",{detail:{productId:String(productId),saved:!exists}}));return !exists;}
  function has(id){return ids.has(String(id));}
  window.ozziFavorites={load,toggle,has};
})();