from pathlib import Path
from pypdf import PdfReader

root=Path(__file__).resolve().parents[2]/'tmp'/'seliga'
for case,students,pages in [('small',8,1),('large',45,2),('individual',1,1),('roster',40,3)]:
    reader=PdfReader(root/f'compact-{case}.pdf')
    assert len(reader.pages)==pages,(case,len(reader.pages))
    text='\n'.join(page.extract_text() for page in reader.pages)
    for i in range(students):
        assert text.count(str(10000000+i))==1,(case,i,'missing or duplicate student')
    assert all(len(page.extract_text())>150 for page in reader.pages),(case,'blank page')
    if case=='large':
        assert all('Disciplina 15' in page.extract_text() for page in reader.pages),'Missing repeated subject key'
print('PASS: page budgets, every CGM exactly once, no blank pages and repeated subject key.')
