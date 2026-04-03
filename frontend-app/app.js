(function () {
  const C = window.SOA_CONFIG || {};
  const CONFIG = {
    JSON_API_URL: C.JSON_API_URL || 'http://localhost:3000',
    SOAP_PROXY_URL: C.SOAP_PROXY_URL || 'http://localhost:4000',
    FILE_API_URL: C.FILE_API_URL || 'http://localhost:3001'
  };

  const MSG = {
    allFields: 'Бүх талбарыг бөглөнө үү',
    pwdMatch: 'Нууц үгнүүд таарахгүй',
    pwdShort: 'Нууц үг хамгийн багадаа 6 тэмдэгт',
    loginReq: 'Хэрэглэгчийн нэр, нууц үг шаардлагатай',
    regFail: 'Бүртгэл амжилтгүй',
    loginFail: 'Нэвтрэлт амжилтгүй',
    session: 'Хугацаа дууссан. Дахин нэвтэрнэ үү.',
    regOk: 'Бүртгэл амжилттай! Нэвтрэх руу...',
    loginOk: 'Амжилттай! Профайл руу...',
    profileOk: 'Профайл шинэчлэгдлээ!',
    uploadOk: 'Зураг upload амжилттай! Хадгалах дарна уу.',
    uploadFail: 'Upload амжилтгүй',
    noFile: 'Файл сонгоно уу',
    welcome: 'Тавтай морил! Профайлаа бөглөнө үү.',
    noName: 'Нэр байхгүй',
    delConfirm: 'Профайл устгах уу?'
  };

  function saveAuth(token, userId, role) {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', String(userId));
    localStorage.setItem('role', role || 'user');
  }
  function getToken() { return localStorage.getItem('token'); }
  function getUserId() { return localStorage.getItem('userId'); }
  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
  }
  function isAuth() { return !!getToken(); }
  function requireAuth() {
    if (!isAuth()) { window.location.href = 'login.html'; return false; }
    return true;
  }
  function redirectIfAuth() {
    if (isAuth()) window.location.href = 'profile.html';
  }

  function showMsg(id, text, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'message ' + (type || 'error') + ' show';
  }
  function hideMsg(id) {
    const el = document.getElementById(id);
    if (el) el.className = 'message';
  }

  function setBtnLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.dataset._t = btn.textContent;
      btn.textContent = 'Уншиж байна...';
    } else {
      btn.disabled = false;
      if (btn.dataset._t) btn.textContent = btn.dataset._t;
    }
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&'"]/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] || c;
    });
  }

  function parseSoap(xml) {
    var doc = new DOMParser().parseFromString(xml, 'text/xml');
    function get(tag) {
      var e = doc.getElementsByTagName('tns:' + tag)[0] || doc.getElementsByTagName(tag)[0];
      return e ? e.textContent : null;
    }
    return {
      success: get('success') === 'true',
      message: get('message'),
      token: get('token'),
      userId: get('userId'),
      role: get('role')
    };
  }

  async function soapRegister(username, password, email) {
    var body = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://localhost:4000/userauth">' +
      '<soap:Body><tns:RegisterUserRequest>' +
      '<tns:username>' + escapeXml(username) + '</tns:username>' +
      '<tns:password>' + escapeXml(password) + '</tns:password>' +
      '<tns:email>' + escapeXml(email) + '</tns:email>' +
      '</tns:RegisterUserRequest></soap:Body></soap:Envelope>';
    var res = await fetch(CONFIG.SOAP_PROXY_URL + '/wsdl', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: 'http://localhost:4000/userauth/RegisterUser'
      },
      body: body
    });
    return parseSoap(await res.text());
  }

  async function soapLogin(username, password) {
    var body = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://localhost:4000/userauth">' +
      '<soap:Body><tns:LoginUserRequest>' +
      '<tns:username>' + escapeXml(username) + '</tns:username>' +
      '<tns:password>' + escapeXml(password) + '</tns:password>' +
      '</tns:LoginUserRequest></soap:Body></soap:Envelope>';
    var res = await fetch(CONFIG.SOAP_PROXY_URL + '/wsdl', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: 'http://localhost:4000/userauth/LoginUser'
      },
      body: body
    });
    return parseSoap(await res.text());
  }

  async function apiRequest(path, method, body) {
    var headers = { 'Content-Type': 'application/json' };
    var t = getToken();
    if (t) headers.Authorization = 'Bearer ' + t;
    var opt = { method: method || 'GET', headers: headers };
    if (body && method !== 'GET') opt.body = JSON.stringify(body);
    var res = await fetch(CONFIG.JSON_API_URL + path, opt);
    if (res.status === 401) {
      logout();
      throw new Error(MSG.session);
    }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || data.message || 'Алдаа');
    return data;
  }

  async function uploadAvatar(file) {
    var t = getToken();
    if (!t) throw new Error('Нэвтэрнэ үү');
    var fd = new FormData();
    fd.append('file', file);
    var res = await fetch(CONFIG.FILE_API_URL + '/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t },
      body: fd
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || data.message || MSG.uploadFail);
    return data.url;
  }

  async function handleRegister(e) {
    e.preventDefault();
    var f = e.target;
    var btn = f.querySelector('button[type="submit"]');
    var u = f.querySelector('#username').value.trim();
    var em = f.querySelector('#email').value.trim();
    var p1 = f.querySelector('#password').value;
    var p2 = f.querySelector('#confirmPassword').value;
    hideMsg('message');
    if (!u || !em || !p1) return showMsg('message', MSG.allFields);
    if (p1 !== p2) return showMsg('message', MSG.pwdMatch);
    if (p1.length < 6) return showMsg('message', MSG.pwdShort);
    setBtnLoading(btn, true);
    try {
      var r = await soapRegister(u, p1, em);
      if (r.success) {
        showMsg('message', MSG.regOk, 'success');
        setTimeout(function () { window.location.href = 'login.html'; }, 1500);
      } else {
        showMsg('message', r.message || MSG.regFail);
      }
    } catch (err) {
      showMsg('message', err.message || MSG.regFail);
    } finally {
      setBtnLoading(btn, false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    var f = e.target;
    var btn = f.querySelector('button[type="submit"]');
    var u = f.querySelector('#username').value.trim();
    var p = f.querySelector('#password').value;
    hideMsg('message');
    if (!u || !p) return showMsg('message', MSG.loginReq);
    setBtnLoading(btn, true);
    try {
      var r = await soapLogin(u, p);
      if (r.success) {
        saveAuth(r.token, r.userId, r.role);
        showMsg('message', MSG.loginOk, 'success');
        setTimeout(function () { window.location.href = 'profile.html'; }, 800);
      } else {
        showMsg('message', r.message || MSG.loginFail);
      }
    } catch (err) {
      showMsg('message', err.message || MSG.loginFail);
    } finally {
      setBtnLoading(btn, false);
    }
  }

  function displayProfile(p) {
    var n = document.getElementById('displayName');
    var em = document.getElementById('displayEmail');
    var bio = document.getElementById('displayBio');
    var ph = document.getElementById('displayPhone');
    var av = document.getElementById('avatarDisplay');
    if (n) n.textContent = p.name || MSG.noName;
    if (em) em.textContent = p.email || '—';
    if (bio) bio.textContent = p.bio || '—';
    if (ph) ph.textContent = p.phone || '—';
    if (av) {
      if (p.avatar_url) {
        av.innerHTML = '<img src="' + String(p.avatar_url).replace(/"/g, '') + '" alt="">';
      } else {
        av.textContent = (p.name || 'Х').charAt(0).toUpperCase();
      }
    }
    var form = document.getElementById('editProfileForm');
    if (form) {
      form.querySelector('#editName').value = p.name || '';
      form.querySelector('#editEmail').value = p.email || '';
      form.querySelector('#editBio').value = p.bio || '';
      form.querySelector('#editPhone').value = p.phone || '';
      form.querySelector('#editAvatar').value = p.avatar_url || '';
    }
  }

  async function initProfile() {
    if (!requireAuth()) return;
    var uid = getUserId();
    try {
      var data = await apiRequest('/users/' + uid, 'GET');
      displayProfile(data.profile);
    } catch (e) {
      if (e.message && e.message.toLowerCase().indexOf('not found') !== -1) {
        showMsg('profileMessage', MSG.welcome, 'success');
        document.getElementById('profileDisplay').style.display = 'none';
        document.getElementById('profileEdit').classList.add('show');
        displayProfile({ name: '', email: '', bio: '', phone: '', avatar_url: '' });
      } else {
        showMsg('profileMessage', e.message, 'error');
        var dn = document.getElementById('displayName');
        if (dn) dn.textContent = MSG.noName;
      }
    }
  }

  function toggleEdit(show) {
    var d = document.getElementById('profileDisplay');
    var e = document.getElementById('profileEdit');
    if (!d || !e) return;
    if (show) {
      d.style.display = 'none';
      e.classList.add('show');
    } else {
      d.style.display = 'block';
      e.classList.remove('show');
    }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    var f = e.target;
    var btn = f.querySelector('button[type="submit"]');
    var uid = getUserId();
    var body = {
      name: f.querySelector('#editName').value.trim(),
      email: f.querySelector('#editEmail').value.trim(),
      bio: f.querySelector('#editBio').value.trim(),
      phone: f.querySelector('#editPhone').value.trim(),
      avatar_url: f.querySelector('#editAvatar').value.trim()
    };
    hideMsg('profileMessage');
    setBtnLoading(btn, true);
    try {
      var data = await apiRequest('/users/' + uid, 'PUT', body);
      displayProfile(data.profile);
      toggleEdit(false);
      showMsg('profileMessage', MSG.profileOk, 'success');
    } catch (err) {
      showMsg('profileMessage', err.message);
    } finally {
      setBtnLoading(btn, false);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var rf = document.getElementById('registerForm');
    if (rf) { redirectIfAuth(); rf.addEventListener('submit', handleRegister); }
    var lf = document.getElementById('loginForm');
    if (lf) { redirectIfAuth(); lf.addEventListener('submit', handleLogin); }
    if (document.getElementById('profilePage')) initProfile();

    var ef = document.getElementById('editProfileForm');
    if (ef) ef.addEventListener('submit', handleProfileSave);
    var eb = document.getElementById('editBtn');
    if (eb) eb.addEventListener('click', function () { toggleEdit(true); });
    var cb = document.getElementById('cancelEditBtn');
    if (cb) cb.addEventListener('click', function () { toggleEdit(false); });
    var lb = document.getElementById('logoutBtn');
    if (lb) lb.addEventListener('click', logout);

    var ub = document.getElementById('uploadAvatarBtn');
    var af = document.getElementById('avatarFile');
    if (ub && af) {
      ub.addEventListener('click', async function () {
        var file = af.files[0];
        if (!file) return alert(MSG.noFile);
        hideMsg('profileMessage');
        try {
          var url = await uploadAvatar(file);
          var form = document.getElementById('editProfileForm');
          if (form) form.querySelector('#editAvatar').value = url;
          showMsg('profileMessage', MSG.uploadOk, 'success');
        } catch (err) {
          showMsg('profileMessage', err.message, 'error');
        }
      });
    }
  });
})();
