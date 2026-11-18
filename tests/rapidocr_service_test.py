import importlib.util
import io
import http.client
import threading
from pathlib import Path
import unittest
from PIL import Image
from PIL import ImageDraw

spec=importlib.util.spec_from_file_location('rapid_service',Path(__file__).parents[1]/'rapidocr-local'/'server.py')
service=importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)

class RecognitionTests(unittest.TestCase):
    def test_shifted_columns_are_rejected(self):
        image=Image.new('RGB',(1920,928),'white')
        draw=ImageDraw.Draw(image)
        for _,x in service.LEFT:draw.rectangle((x,238,x+113,889),fill=(0,139,59))
        service.verify_grid(image,service.LEFT)
        shifted=Image.new('RGB',image.size,'white');shifted.paste(image,(10,0))
        with self.assertRaises(ValueError):service.verify_grid(shifted,service.LEFT)

    def test_numbers_require_decimal_confidence_and_agreement(self):
        self.assertEqual(service.agreed_grade(('0,0',.99),('0.0',.99)),'0,0')
        self.assertEqual(service.agreed_grade(('7,3',.99),('73',.99)),'?')
        self.assertEqual(service.agreed_grade(('7,3',.4),('7,3',.99)),'?')
        self.assertEqual(service.agreed_grade(('11,0',.99),('11,0',.99)),'?')

    def test_wrapped_identity_and_no_digit_invention(self):
        self.assertEqual(service.identity('Ana Souza - 1234567890.'),('1234567890','Ana Souza'))
        self.assertEqual(service.identity('Ana Souza - 10213 8483')[0],'')
        self.assertEqual(service.identity('Ana Souza -\n1234567890')[0],'1234567890')

    def test_origin_allowlist_and_header(self):
        self.assertTrue(service.allowed_origin('https://eduanalytics-seven.vercel.app'))
        self.assertTrue(service.allowed_origin('null'))
        self.assertFalse(service.allowed_origin('https://evil.example'))
        self.assertFalse(service.allowed_origin('https://eduanalytics-seven.vercel.app.evil.example'))

    def test_image_validation_before_recognition(self):
        with self.assertRaises(ValueError): service.decode_image(b'not an image')
        payload=io.BytesIO();Image.new('RGB',(40,40)).save(payload,format='PNG')
        with self.assertRaises(ValueError): service.decode_image(payload.getvalue())

    def test_legacy_layout_wrapped_cgm_and_blank_cells(self):
        class FakeEngine:
            calls=0
            def __call__(self,*args,**kwargs):
                self.calls+=1
                if self.calls==1:return [([[0,0],[30,0],[30,15],[0,15]],'ARTE CIENCIAS',.99)],None
                box=lambda y:[[3,3*y],[150,3*y],[150,3*(y+10)],[3,3*(y+10)]]
                return [(box(2),'Ana Souza -',.99),(box(15),'1234567890',.99)],None
            def text_rec(self,crops):return [('7,0',.99)]*len(crops),None
        image=Image.new('RGB',(1192,588),'white')
        ImageDraw.Draw(image).text((213,40),'7,0',fill='black')
        payload=io.BytesIO();image.save(payload,format='PNG')
        previous=service.ENGINE;service.ENGINE=FakeEngine()
        try: result=service.recognize(payload.getvalue())
        finally: service.ENGINE=previous
        self.assertEqual(len(result['imageRows']),1)
        self.assertEqual(result['imageRows'][0][:3],['1234567890','Ana Souza','7,0'])
        self.assertEqual(result['imageRows'][0][3:],['']*29)

class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.old_port=service.PORT
        cls.server=service.ThreadingHTTPServer(('127.0.0.1',0),service.Handler)
        service.PORT=cls.server.server_port
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join();service.PORT=cls.old_port

    def request(self,method,path,body=None,headers=None):
        connection=http.client.HTTPConnection('127.0.0.1',service.PORT,timeout=3)
        connection.request(method,path,body=body,headers=headers or {})
        response=connection.getresponse();payload=response.read();headers=dict(response.getheaders());connection.close()
        return response.status,headers,payload

    def test_origin_host_header_and_size_protection(self):
        self.assertEqual(self.request('POST','/recognize',b'a',{'Origin':'https://evil.example'})[0],403)
        self.assertEqual(self.request('GET','/health',headers={'Host':'evil.example'})[0],403)
        self.assertEqual(self.request('POST','/recognize',b'a',{'Origin':'null'})[0],403)
        self.assertEqual(self.request('POST','/recognize',headers={'Origin':'null','X-EduAnalytics-OCR':'1','Content-Length':str(service.MAX_BYTES+1)})[0],413)

    def test_preflight_and_health(self):
        status,headers,_=self.request('OPTIONS','/recognize',headers={'Origin':'https://eduanalytics-seven.vercel.app'})
        self.assertEqual(status,204)
        self.assertEqual(headers['Access-Control-Allow-Origin'],'https://eduanalytics-seven.vercel.app')
        self.assertEqual(headers['Access-Control-Allow-Private-Network'],'true')
        self.assertEqual(self.request('OPTIONS','/recognize')[0],403)
        status,headers,_=self.request('GET','/health',headers={'Origin':'null'})
        self.assertEqual(status,200);self.assertEqual(headers['Cache-Control'],'no-store')

    def test_invalid_upload_does_not_reach_engine(self):
        status,_,_=self.request('POST','/recognize',b'invalid',{'Origin':'null','X-EduAnalytics-OCR':'1','Content-Type':'application/octet-stream'})
        self.assertEqual(status,422)

if __name__=='__main__':unittest.main()
