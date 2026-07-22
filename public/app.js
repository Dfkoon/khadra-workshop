(function(){
  const token = localStorage.getItem('khadraToken') || '';
  if (!token) return;

  async function init() {
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { return; }
      const data = await res.json();
      const role = data.user?.role;
      window.KhadraUser = data.user || {};
      // hide attendance nav for non-admins
      const navAttendance = document.getElementById('navAttendance');
      if (navAttendance && role !== 'admin') navAttendance.style.display = 'none';
    } catch (e) {
      // ignore
    }
  }

  init();
})();
