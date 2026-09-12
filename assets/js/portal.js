
document.addEventListener("DOMContentLoaded", () => {
  const sidebar=document.querySelector(".sidebar");
  const toggle=document.querySelector("[data-mobile-menu]");
  if(toggle && sidebar){
    toggle.addEventListener("click",()=>sidebar.classList.toggle("open"));
  }
  document.querySelectorAll("[data-nav]").forEach(a=>{
    if(location.pathname.endsWith(a.getAttribute("href"))) a.classList.add("active");
  });
});
