from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix: hapus </div> dan )} yang dobel di baris 3189-3190
old = """                    )}
                  </div>
                  )}
                </div>
              );
            })}
          </Card>"""

new = """                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Card>"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Done! JSX balance fixed.")
else:
    print("❌ Pattern not found, cek manual.")
    # debug: cari konteks sekitar
    lines = content.splitlines()
    for i, l in enumerate(lines[3183:3198], 3184):
        print(f"{i}: {l}")
