import re, base64, os, sys
dist = sys.argv[1]; out = sys.argv[2]
html = open(os.path.join(dist, 'index.html'), encoding='utf-8').read()
def inline_assets(js):
    def rep(m):
        p = m.group(1); f = os.path.join(dist, p.lstrip('/'))
        if not os.path.exists(f): return m.group(0)
        mime = 'font/ttf' if p.endswith('.ttf') else 'image/png'
        return '"data:%s;base64,%s"' % (mime, base64.b64encode(open(f,'rb').read()).decode())
    return re.sub(r'"(/assets/[^"]+\.(?:ttf|png))"', rep, js)
def rep_script(m):
    src = m.group(1); js = open(os.path.join(dist, src.lstrip('/')), encoding='utf-8').read()
    js = inline_assets(js).replace('</script', '<\\/script')
    return '<script>' + js + '</script>'
html = re.sub(r'<script src="([^"]+)" defer></script>', rep_script, html)
html = re.sub(r'<link rel="icon"[^>]*/>', '', html)
open(out, 'w', encoding='utf-8').write(html)
print(len(html)//1024, 'KB', html.count('<script>'))
