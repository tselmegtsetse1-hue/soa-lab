# Lab 07 — Frontend integration (profile + upload)

## 1. HTML: `profile.html` (before `</body>`)

`app.js`-ийн өмнө `config.js` ачаална:

```html
<script src="config.js"></script>
<script src="app.js"></script>
```

Профайл засах хэсэгт нэмнэ (жишээ):

```html
<div class="form-group">
  <label>Профайл зураг upload</label>
  <input type="file" id="avatarFile" accept="image/*" />
  <button type="button" id="uploadAvatarBtn" class="btn btn-secondary">Зураг оруулах</button>
</div>
```

## 2. `app.js` — CONFIG болон upload

Файлын эхэнд (эсвэл одоогийн CONFIG):

```javascript
const CONFIG = {
  JSON_API_URL: (window.SOA_CONFIG && window.SOA_CONFIG.JSON_API_URL) || 'http://localhost:3000',
  SOAP_PROXY_URL: (window.SOA_CONFIG && window.SOA_CONFIG.SOAP_PROXY_URL) || 'http://localhost:4000',
  FILE_API_URL: (window.SOA_CONFIG && window.SOA_CONFIG.FILE_API_URL) || 'http://localhost:3001'
};
```

Upload функц (нэмэх):

```javascript
async function uploadAvatar(file) {
  const token = getToken();
  if (!token) throw new Error('Нэвтэрнэ үү');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${CONFIG.FILE_API_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message);
  return data.url;
}
```

Event (DOMContentLoaded дотор):

```javascript
const uploadBtn = document.getElementById('uploadAvatarBtn');
const avatarInput = document.getElementById('avatarFile');
if (uploadBtn && avatarInput) {
  uploadBtn.addEventListener('click', async () => {
    const f = avatarInput.files[0];
    if (!f) return alert('Файл сонгоно уу');
    try {
      const url = await uploadAvatar(f);
      const form = document.getElementById('editProfileForm');
      if (form) form.querySelector('#editAvatar').value = url;
      showMessage('profileMessage', 'Upload амжилттай! Хадгалах дарна уу.', 'success');
    } catch (e) {
      showMessage('profileMessage', e.message, 'error');
    }
  });
}
```

Хэрэглэгч **Хадгалах** дарснаар `PUT /users/:id` нь `avatar_url`-ийг profile DB-д хадгална (Lab 06-ын логик).

## 3. CORS

File Manager дээр `cors()` идэвхтэй; cloud дээр frontend domain-ээ шаардвал `cors({ origin: ['https://your-static-site.ondigitalocean.app'] })` гэж тодорхойлно.
