(() => {
  const API=window.SuraeAPI;
  async function login(email,password){const d=await API.login(email,password);try{await API.adminSnapshot();return d}catch(e){API.logout();throw e}}
  async function verify(){if(!API.getSession())throw new Error('Admin login required.');await API.adminSnapshot();return true}
  function logout(){API.logout()}
  window.SuraeCloudAuth={login,verify,logout,configured:()=>API.configured(),getSession:API.getSession};
})();
