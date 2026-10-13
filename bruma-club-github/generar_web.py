from pathlib import Path
import mimetypes,base64
root=Path(__file__).parent
html=(root/'index-src.html').read_text(encoding='utf-8')
css=(root/'styles.css').read_text(encoding='utf-8')
js=(root/'script.js').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="styles.css" />','<style>\n'+css+'\n</style>')
for f in (root/'assets').iterdir():
    if not f.is_file() or f.suffix.lower() not in ('.png','.jpg','.jpeg','.webp'): continue
    data='data:'+(mimetypes.guess_type(f.name)[0] or 'application/octet-stream')+';base64,'+base64.b64encode(f.read_bytes()).decode('ascii')
    source='assets/'+f.name
    html=html.replace('src="'+source+'"','src="'+data+'"').replace('href="'+source+'"','href="'+data+'"')
    if f.name.startswith('crewneck-'): js=js.replace('"'+source+'"','"'+data+'"')
js=js.replace('</script','<\\/script').replace('<!--','<\\!--')
html=html.replace('<script src="script.js"></script>','<script>\n'+js+'\n</script>')
(root/'index.html').write_text(html,encoding='utf-8')
print('Generado:',root/'index.html')
