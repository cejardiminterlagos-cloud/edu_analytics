"""RapidOCR restricted to loopback; images stay in memory and are never saved."""
import io
import json
import os
import re
import sys
import threading
import unicodedata
import warnings
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from rapidocr_onnxruntime import RapidOCR

HOST, PORT = '127.0.0.1', 8766
MAX_BYTES = 20 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 12_000_000
SUBJECTS = ['Arte - 704', 'Ciências - 301', 'Educação Física - 601', 'Geografia - 401',
            'História - 501', 'Leitura Rec Aprend Língua Port - 6505', 'Língua Inglesa - 1347',
            'Língua Portuguesa - 106', 'Matemática - 201', 'Rec Aprend Matemática - 6211']
LEGACY_SUBJECTS = ['Arte','Ciências','Educação Física','Geografia','História',
                   'Leitura Rec Aprend','Língua Inglesa','Língua Portuguesa','Matemática','Rec Aprend']
LEFT = list(zip(range(8), [434,590,746,902,1058,1214,1482,1638]))
RIGHT = list(zip([3,4,5,6,7,8,9], [579,735,891,1159,1315,1492,1648]))
ENGINE = None
BUSY = threading.Lock()

def allowed_origin(origin):
    return origin in ('null', 'http://127.0.0.1:8766', 'https://eduanalytics-seven.vercel.app')

def normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFKD',text.upper()) if c.isalnum())

def identity(text):
    match = re.search(r'(?<!\d)(\d{7,12})[^\w\d]*$',text,flags=re.UNICODE)
    if match:
        return match[1], text[:match.start()].strip().rstrip('-–—').strip()
    return '', text.strip().rstrip('-–—').strip()

def grade(reading):
    text, confidence = reading
    if confidence < .90 or not re.fullmatch(r'(?:10|[0-9])[,.][0-9]',text.strip()): return None
    value=float(text.replace(',','.'))
    return value if value <= 10 else None

def agreed_grade(color, contrast):
    value=grade(color)
    return str(value).replace('.',',') if value is not None and value == grade(contrast) else '?'

def decode_image(payload):
    if not 0 < len(payload) <= MAX_BYTES: raise ValueError('A imagem excede 20 MB ou está vazia.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(payload)) as source:
                if source.format not in ('PNG','JPEG','WEBP') or getattr(source,'n_frames',1)!=1:
                    raise ValueError('Use uma imagem PNG, JPEG ou WebP sem animação.')
                if source.width < 600 or source.height < 70 or source.width*source.height > Image.MAX_IMAGE_PIXELS:
                    raise ValueError('Dimensões da captura fora do limite de 12 milhões de pixels.')
                return ImageOps.exif_transpose(source).convert('RGB')
    except (UnidentifiedImageError,OSError,Image.DecompressionBombError,Image.DecompressionBombWarning) as error:
        raise ValueError('Arquivo de imagem inválido ou com dimensões excessivas.') from error

def prepare(image, contrast=False):
    if contrast:
        array=np.asarray(image).astype(float)
        background=np.median(array.reshape(-1,3),axis=0)
        ink=np.max(abs(array-background),axis=2)
        image=Image.fromarray((255-np.clip(ink*1.3,0,255)).astype('uint8')).convert('RGB')
    return np.asarray(image.resize((image.width*3,image.height*3),Image.Resampling.LANCZOS))[:,:,::-1].copy()

def verify_grid(image,groups):
    pixels=np.asarray(image)[238:890].astype(int)
    colored=(pixels.max(axis=2)-pixels.min(axis=2)>90).mean(axis=0)
    for _,left in groups:
        if min(colored[left+5],colored[left+108])<.15 or colored[left+125]>.1:
            raise ValueError('Posição das colunas não confirmada. Use o enquadramento de referência, sem redimensionar as colunas.')

def recognize(payload):
    image=decode_image(payload)
    # shortcut: only the two verified layouts are accepted; detect the grid before supporting others.
    if abs(image.width/image.height-1920/928)<.005:
        image=image.resize((1920,928),Image.Resampling.LANCZOS)
        header,_=ENGINE(prepare(image.crop((434,191,746,214))),use_cls=False)
        header=normalize(' '.join(item[1] for item in header or []))
        if 'ARTE' in header and 'CIENCIAS' in header: groups=LEFT
        elif 'EDUCACAO' in header and 'GEOGRAFIA' in header: groups=RIGHT
        else: raise ValueError('Cabeçalhos do Power BI não reconhecidos. Use a captura completa, com os cabeçalhos visíveis.')
        verify_grid(image,groups)
        array=np.asarray(image)
        edges=[238]+[y for y in range(239,891) if not np.array_equal(array[y,5],array[y-1,5])]+[890]
        bounds=[(top,bottom) for top,bottom in zip(edges,edges[1:]) if bottom-top>=22 and bottom<=890]
        names=[]; positions=[]
        for i,(top,bottom) in enumerate(bounds):
            for y in range(top,bottom,22):
                if bottom-y>=16:
                    names.append(prepare(image.crop((8,y,431,min(y+22,bottom)))))
                    positions.append(i)
        if not names: raise ValueError('Nenhuma linha completa foi encontrada na captura.')
        readings,_=ENGINE.text_rec(names)
        joined=['']*len(bounds)
        for i,(text,_) in zip(positions,readings): joined[i]+=' '+text
        people=[(*identity(name),top) for name,(top,_) in zip(joined,bounds)]
        bands=[(subject,term,x+term*38+1,x+(term+1)*38-1) for subject,x in groups for term in range(3)]
        subjects=SUBJECTS
        height=20
    elif .55 < image.height/image.width < .57 or .48 < image.height/image.width < .50:
        width=1192
        image=image.resize((width,round(image.height*width/image.width)),Image.Resampling.LANCZOS)
        header,_=ENGINE(prepare(image.crop((208,0,404,36))),use_cls=False)
        header=normalize(' '.join(item[1] for item in header or []))
        if 'ARTE' not in header or 'CIENCIAS' not in header:
            raise ValueError('Cabeçalhos da tabela não reconhecidos. Mantenha a tabela inteira visível.')
        names,_=ENGINE(prepare(image.crop((0,37,208,image.height))),use_cls=False)
        lines=[]
        for box,text,confidence in names or []:
            x,y=np.asarray(box).mean(axis=0)/3
            line=next((line for line in lines if abs(line[0]-y)<5),None)
            if line is None: lines.append([float(y),[(float(x),text)]])
            else: line[1].append((float(x),text))
        people=[]
        for y,words in sorted(lines):
            text=' '.join(text for _,text in sorted(words))
            if not any(c.isalpha() for c in text):
                if people and y+37-(people[-1][2]+6)<18:
                    registration,name=identity(people[-1][1]+' - '+text)
                    if registration: people[-1]=(registration,name,people[-1][2])
                continue
            registration,name=identity(text)
            people.append((registration,name,y+37-6))
        edges=[208,306,404,501,599,696,792,890,987,1084,1188]
        total=[280,378,475,573,670,768,864,962,1058,1156]
        bands=[(d,t,round(edges[d]+t*(total[d]-edges[d])/3)+1,
                round(edges[d]+(t+1)*(total[d]-edges[d])/3)-1) for d in range(10) for t in range(3)]
        subjects=LEGACY_SUBJECTS
        height=12
    else:
        raise ValueError('Formato de captura não reconhecido. Use o Power BI completo ou a tabela no formato de referência.')
    if not people or len(people)>150: raise ValueError('Quantidade de linhas fora do limite da captura.')
    rows=[[registration,name,*(['·']*30)] for registration,name,_ in people]
    crops=[]; cells=[]
    for i,(_,_,top) in enumerate(people):
        top=round(top)
        for subject,term,left,right in bands:
            crop=image.crop((left,top+1,right,top+height+1))
            array=np.asarray(crop).astype(float)
            # A uniform cell is absent; text that failed OCR must stay unknown.
            background=np.median(array.reshape(-1,3),axis=0)
            ink=np.max(abs(array-background),axis=2)>35
            if not ink.any(): rows[i][2+subject*3+term]='';continue
            crops.extend([prepare(crop),prepare(crop,True)])
            cells.append((i,subject,term))
    readings=[]
    for begin in range(0,len(crops),256):
        batch,_=ENGINE.text_rec(crops[begin:begin+256]);readings.extend(batch)
    for i,(row,subject,term) in enumerate(cells):
        rows[row][2+subject*3+term]=agreed_grade(*readings[2*i:2*i+2])
    return dict(engine='RapidOCR',version=1,subjects=subjects,imageRows=rows)

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass

    def authorized(self):
        return (self.headers.get('Host')==f'{HOST}:{PORT}' and
                (self.headers.get('Origin') is None or allowed_origin(self.headers.get('Origin'))))

    def reply(self,status,payload):
        data=json.dumps(payload,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        origin=self.headers.get('Origin')
        if allowed_origin(origin):
            self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Vary','Origin')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers()
        try: self.wfile.write(data)
        except (BrokenPipeError,ConnectionResetError): pass

    def do_OPTIONS(self):
        if not self.authorized() or not allowed_origin(self.headers.get('Origin')) or self.path!='/recognize':
            return self.reply(403,{'error':'Origem não permitida.'})
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin',self.headers['Origin'])
        self.send_header('Vary','Origin')
        self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type, X-EduAnalytics-OCR')
        self.send_header('Access-Control-Allow-Private-Network','true')
        self.end_headers()

    def do_GET(self):
        if not self.authorized(): return self.reply(403,{'error':'Origem não permitida.'})
        if self.path!='/health': return self.reply(404,{'error':'Recurso não encontrado.'})
        self.reply(200,{'engine':'RapidOCR','version':1})

    def do_POST(self):
        if not self.authorized() or self.headers.get('X-EduAnalytics-OCR')!='1':
            return self.reply(403,{'error':'Solicitação não permitida.'})
        if self.path!='/recognize': return self.reply(404,{'error':'Recurso não encontrado.'})
        try: size=int(self.headers.get('Content-Length','0'))
        except ValueError: size=0
        if not 0<size<=MAX_BYTES: return self.reply(413,{'error':'A imagem deve ter até 20 MB.'})
        if self.headers.get('Content-Type')!='application/octet-stream':
            return self.reply(415,{'error':'Formato de envio inválido.'})
        if not BUSY.acquire(blocking=False): return self.reply(503,{'error':'RapidOCR ocupado. Aguarde a leitura atual.'})
        try:
            self.connection.settimeout(30)
            payload=self.rfile.read(size)
            if len(payload)!=size: raise ValueError('Imagem incompleta.')
            result=recognize(payload)
            self.reply(200,result)
        except ValueError as error: self.reply(422,{'error':str(error)})
        except Exception: self.reply(500,{'error':'Falha na leitura local. Verifique a imagem e tente novamente.'})
        finally: BUSY.release()

if __name__=='__main__':
    ENGINE=RapidOCR(intra_op_num_threads=2,inter_op_num_threads=1,rec_batch_num=16,rec_img_shape=[3,48,96])
    server=ThreadingHTTPServer((HOST,PORT),Handler)
    runtime=Path(__file__).resolve().parent/'.runtime';runtime.mkdir(exist_ok=True)
    state=runtime/'service.json'
    state.write_text(json.dumps({'pid':os.getpid(),'startedAt':datetime.now(timezone.utc).isoformat(),
                                'executable':getattr(sys,'_base_executable',sys.executable)}),encoding='utf-8')
    print(f'RapidOCR local: http://{HOST}:{PORT} (sem gravar imagens)',flush=True)
    try: server.serve_forever()
    finally: server.server_close();state.unlink(missing_ok=True)
