# Coloca ?v=<versão> nos arquivos locais (css/js) das páginas, para o navegador
# não misturar uma página nova com um código antigo guardado em cache.
import re, time, pathlib
v = time.strftime('%Y%m%d%H%M')
for p in ['index.html', 'c/index.html']:
    f = pathlib.Path(p); s = f.read_text()
    s = re.sub(r'((?:src|href)="(?:\.\./)?(?:js|css)/[^"?]+\.(?:js|css))(\?v=\d+)?"', lambda m: f'{m.group(1)}?v={v}"', s)
    f.write_text(s)
print(v)
