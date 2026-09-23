(function(){
  async function init(){
    try{
      const sb=window.ozziGetSupabase();
      const {data:s,error:sessionError}=await sb.auth.getSession();
      if(sessionError) throw sessionError;
      if(!s.session) return;
      const uid=s.session.user.id;
      async function count(){
        const {count,error}=await sb.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",uid).eq("is_read",false);
        if(error) throw error;
        document.querySelectorAll("[data-notification-count]").forEach(e=>{e.textContent=count||0;e.style.display=count?"inline-flex":"none"});
        return count||0;
      }
      window.ozziNotifications={
        async markRead(id){
          const {error}=await sb.from("notifications").update({is_read:true}).eq("id",id).eq("user_id",uid);
          if(error) throw error;
          return count();
        },
        async markAllRead(){
          const {error}=await sb.from("notifications").update({is_read:true}).eq("user_id",uid).eq("is_read",false);
          if(error) throw error;
          return count();
        },
        count
      };
      await count();
      sb.channel("ozzi-notifications-"+uid).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"user_id=eq."+uid},()=>{count().catch(e=>console.error("Notifications count error:",e));}).subscribe();
    }catch(e){console.error("Notifications error:",e)}
  }
  document.addEventListener("DOMContentLoaded",init);
})();