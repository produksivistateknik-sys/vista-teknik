from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix td onClick - handle semua kasus
old_td = '                        <td key={d} onClick={(e:any)=>{if(e.ctrlKey||e.metaKey||e.shiftKey){handleCellClick(row.id,d,e);}}}'
new_td = '                        <td key={d} onClick={(e:any)=>{e.stopPropagation();handleCellClick(row.id,d,e);}}'

if old_td in content:
    content = content.replace(old_td, new_td)
    print("✅ TD onClick fixed")
else:
    print("❌ TD not found")

# Fix div onClick di dalam td - hapus conditional, langsung forward ke handleCellClick
old_div = '                              onClick={(e:any)=>{if(e.shiftKey||e.ctrlKey||e.metaKey){handleCellClick(row.id,d,e);return;}openCellModal(row.id,d);}}\n'
new_div = '                              onClick={(e:any)=>{e.stopPropagation();handleCellClick(row.id,d,e);}}\n'

if old_div in content:
    content = content.replace(old_div, new_div)
    print("✅ Div onClick fixed")
else:
    print("❌ Div not found")

# Update handleCellClick - klik biasa tanpa modifier = buka modal
old_handle_end = """    } else {
      // Single select
      if(copiedCells.length===0){
        // Tidak ada copied → buka modal langsung
        openCellModal(rawId,date);
        return;
      }
      // Ada copied cells → set anchor untuk paste
      setSelectedCells([{rawId,date}]);
      setLastSelected({rawId,date});
    }
  };"""

new_handle_end = """    } else {
      // Klik biasa tanpa modifier
      if(selectedCells.length>0||copiedCells.length>0){
        // Ada selection/copied → clear dan mulai fresh atau buka modal
        if(copiedCells.length>0){
          // Dalam mode paste → set anchor
          setSelectedCells([{rawId,date}]);
          setLastSelected({rawId,date});
        } else {
          // Clear selection, buka modal
          setSelectedCells([]);
          setLastSelected(null);
          openCellModal(rawId,date);
        }
      } else {
        // Tidak ada selection → buka modal
        openCellModal(rawId,date);
      }
    }
  };"""

if old_handle_end in content:
    content = content.replace(old_handle_end, new_handle_end)
    print("✅ handleCellClick end updated")
else:
    print("❌ handleCellClick end not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
