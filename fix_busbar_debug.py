from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """                  } else {
                    const res=await createRenhar(renharPayload);
                    if(res?.success&&res?.data) setRenhar((prev:any[])=>[...prev,res.data]);
                  }"""

new = """                  } else {
                    console.log('Creating renhar busbar:', renharPayload);
                    const res=await createRenhar(renharPayload);
                    console.log('Renhar result:', res);
                    if(res?.success&&res?.data) setRenhar((prev:any[])=>[...prev,res.data]);
                  }"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Debug log added!")
else:
    print("❌ Not found!")
