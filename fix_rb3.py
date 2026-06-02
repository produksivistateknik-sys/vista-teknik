with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

old = """      const results=await Promise.all([
        supabase.from("mesin").select("*").not("deleted_at","is",null).order("deleted_at",{ascending:false}),
        supabase.from("work_orders").select("*").not("deleted_at","is",null).order("deleted_at",{ascending:false}),
      ]);
      setDeletedMesin(ms??[]);setDeletedWO(wo??[]);setLoading(false);"""

new = """      const cats=["work_orders","mesin","pekerja","raw_schedule","renhar","kendala"];
      const results=await Promise.all(cats.map((t:string)=>supabase.from(t).select("*").not("deleted_at","is",null).order("deleted_at",{ascending:false})));
      const all:any[]=[];
      results.forEach(({data}:any,i:number)=>{(data??[]).forEach((row:any)=>all.push({...row,_cat:cats[i]}));});
      all.sort((a:any,b:any)=>new Date(b.deleted_at).getTime()-new Date(a.deleted_at).getTime());
      setItems(all);setLoading(false);"""

if old in c:
    c = c.replace(old, new)
    print('Replaced!')
else:
    print('Pattern not found, searching...')
    rb_start = c.index('function RecycleBinTab')
    rb_end = c.index('function SystemTab(', rb_start)
    rb = c[rb_start:rb_end]
    for i, line in enumerate(rb.split('\n')[0:30]):
        print(i, ':', line[:80])

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
