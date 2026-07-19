/* ============================================================
   Openhouse — tiny Supabase REST client (no SDK needed)
   Reads are public; writes go through password-checked RPCs,
   so the anon key in config.js can't be abused to modify data.
   ============================================================ */
window.OpenhouseDB = (function(){
  const cfg = window.OPENHOUSE_DB || {};
  const ready = !!(cfg.url && cfg.anonKey &&
    !/PASTE_YOUR/.test(cfg.url) && !/PASTE_YOUR/.test(cfg.anonKey));
  const base = ready ? String(cfg.url).replace(/\/+$/, '') : '';

  function headers(){
    return {
      'apikey': cfg.anonKey,
      'Authorization': 'Bearer ' + cfg.anonKey,
      'Content-Type': 'application/json'
    };
  }

  async function rest(path){
    const res = await fetch(base + '/rest/v1/' + path, { headers: headers() });
    if(!res.ok) throw new Error('DB read failed: ' + res.status);
    return res.json();
  }

  async function rpc(fn, args){
    const res = await fetch(base + '/rest/v1/rpc/' + fn, {
      method: 'POST', headers: headers(), body: JSON.stringify(args)
    });
    if(!res.ok){
      const txt = await res.text();
      if(res.status === 404) throw new Error('Database function "' + fn + '" is missing — run the SQL from the README.');
      throw new Error(/unauthorized/i.test(txt) ? 'Wrong password.' : 'DB write failed: ' + res.status);
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  return {
    ready,
    fetchApps:      ()               => rest('apps?select=*&order=created_at.asc'),
    fetchMeta:      ()               => rest('site_meta?select=*'),
    checkPass:      (pass)           => rpc('owner_check',           { p_pass: pass }),
    addApp:         (pass, app)      => rpc('owner_add_app',         { p_pass: pass, p_app: app }),
    deleteApp:      (pass, id)       => rpc('owner_delete_app',      { p_pass: pass, p_id: id }),
    setTags:        (pass, id, tags) => rpc('owner_set_tags',        { p_pass: pass, p_id: id, p_tags: tags }),
    setStar:        (pass, id, on)   => rpc('owner_set_star',        { p_pass: pass, p_id: id, p_on: on }),
    updateApp:      (pass, id, app)  => rpc('owner_update_app',      { p_pass: pass, p_id: id, p_app: app }),
    deleteCategory: (pass, cat)      => rpc('owner_delete_category', { p_pass: pass, p_cat: cat }),
    setMeta:        (pass, key, val) => rpc('owner_set_meta',        { p_pass: pass, p_key: key, p_value: val })
  };
})();
