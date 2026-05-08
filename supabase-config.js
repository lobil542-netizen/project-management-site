const SUPABASE_URL = 'https://vvfqnfjnksbrqxtjwopj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dtTPxU9fuyMF2Gq6-FZ8Cg_0rT8Xzdp';
const SUPABASE_REST = SUPABASE_URL + '/rest/v1';

async function supabaseInsert(table, data) {
    const res = await fetch(`${SUPABASE_REST}/${table}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'שגיאה בשמירה');
    }
    return await res.json();
}

async function supabaseSelect(table) {
    const res = await fetch(`${SUPABASE_REST}/${table}?select=*&order=time.desc&limit=200`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY
        }
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'שגיאה בקריאה');
    }
    return await res.json();
}
